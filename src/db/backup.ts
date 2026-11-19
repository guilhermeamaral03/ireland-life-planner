import { db, ensureSeeded, getSettings, TABLE_NAMES, type TableName } from './db'
import type { Settings } from './types'

export const BACKUP_APP_ID = 'ireland-life-planner'
export const SCHEMA_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  tables: Record<TableName, unknown[]>
}

export type ParseResult =
  | { ok: true; data: BackupFile; counts: Record<TableName, number> }
  | { ok: false; error: string }

const NOT_JSON = 'Arquivo inválido: não é um JSON.'
const NOT_BACKUP = 'Arquivo inválido: não é um backup do Ireland Life Planner.'

const table = (name: TableName) => db.table(name)

export async function exportBackup(): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>
  const exportedAt = new Date().toISOString()
  await getSettings() // garante que o registro de configurações exista no arquivo
  await db.transaction('r', TABLE_NAMES.map(table), async () => {
    for (const name of TABLE_NAMES) tables[name] = await table(name).toArray()
  })
  // o arquivo já leva a própria data como "último backup"; o aparelho só marca depois de salvar
  tables.settings = (tables.settings as Settings[]).map((s) => ({ ...s, lastBackupAt: exportedAt }))
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt, tables }
}

/** Registra no aparelho que um backup foi salvo. */
export async function markBackupDone(exportedAt: string): Promise<void> {
  await db.settings.put({ ...(await getSettings()), lastBackupAt: exportedAt })
}

const validDate = (v: unknown): string | null =>
  typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : null

export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: NOT_JSON }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: NOT_BACKUP }
  const obj = raw as Record<string, unknown>
  if (obj.app !== BACKUP_APP_ID || typeof obj.schemaVersion !== 'number') return { ok: false, error: NOT_BACKUP }
  if (obj.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Backup de versão mais nova (v${obj.schemaVersion}). Atualize o app antes de importar.` }
  }
  const src = obj.tables
  if (!src || typeof src !== 'object') return { ok: false, error: NOT_BACKUP }
  const tables = {} as Record<TableName, unknown[]>
  const counts = {} as Record<TableName, number>
  for (const name of TABLE_NAMES) {
    const rows = (src as Record<string, unknown>)[name] ?? []
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object')) return { ok: false, error: NOT_BACKUP }
    tables[name] = rows
    counts[name] = rows.length
  }
  return {
    ok: true,
    data: { app: BACKUP_APP_ID, schemaVersion: obj.schemaVersion, exportedAt: String(obj.exportedAt ?? ''), tables },
    counts,
  }
}

/** Substitui todos os dados do aparelho pelos do backup, numa única transação. */
export async function importBackup(data: BackupFile): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map(table), async () => {
    for (const name of TABLE_NAMES) {
      let rows = data.tables[name] ?? []
      if (name === 'settings') {
        rows = (rows as Settings[]).map((s) => ({ ...s, lastBackupAt: validDate(s.lastBackupAt) }))
      }
      await table(name).clear()
      await table(name).bulkAdd(rows)
    }
  })
  await ensureSeeded()
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map(table), async () => {
    for (const name of TABLE_NAMES) await table(name).clear()
  })
  await ensureSeeded()
}

export async function downloadBackup(): Promise<void> {
  const data = await exportBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ireland-life-planner-backup-${data.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000) // folga para a tela de salvar do iPhone
  await markBackupDone(data.exportedAt)
}

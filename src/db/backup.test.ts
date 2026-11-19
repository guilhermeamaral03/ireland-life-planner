import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeeded } from './db'
import { clearAllData, exportBackup, importBackup, markBackupDone, parseBackup } from './backup'
import type { Scenario } from './types'

const scenario: Scenario = {
  name: 'Dividindo apartamento',
  grossAnnual: null,
  taxStatus: null,
  spouseGrossAnnual: null,
  amounts: { aluguel: 900, contas: 100, alimentacao: 300, transporte: 50, pessoais: 100, outros: 0 },
  initialReserve: null,
}

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
})

describe('backup', () => {
  it('roundtrip: exportar, apagar e importar restaura os dados', async () => {
    await db.expenses.add({ name: 'Internet', categoryId: 4, amount: 40, frequency: 'mensal', kind: 'fixa' })
    await db.scenarios.add({ ...scenario })
    const backup = await exportBackup()
    await clearAllData()
    expect(await db.expenses.count()).toBe(0)
    await importBackup(backup)
    const exp = await db.expenses.toArray()
    expect(exp).toHaveLength(1)
    expect(exp[0].name).toBe('Internet')
    const sc = await db.scenarios.toArray()
    expect(sc[0].amounts.aluguel).toBe(900)
  })

  it('importação substitui os dados existentes', async () => {
    await db.expenses.add({ name: 'B', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' })
    const backup = await exportBackup()
    await db.expenses.clear()
    await db.expenses.add({ name: 'A', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' })
    await importBackup(backup)
    expect((await db.expenses.toArray()).map((e) => e.name)).toEqual(['B'])
  })

  it('gerar o backup NÃO marca backup feito; só markBackupDone marca', async () => {
    const backup = await exportBackup()
    expect((await db.settings.get('main'))?.lastBackupAt ?? null).toBeNull()
    await markBackupDone(backup.exportedAt)
    expect((await db.settings.get('main'))?.lastBackupAt).toBe(backup.exportedAt)
  })

  it('importação descarta lastBackupAt inválido', async () => {
    const backup = await exportBackup()
    backup.tables.settings = [{ ...(backup.tables.settings[0] as object), lastBackupAt: 'abc' }]
    await importBackup(backup)
    expect((await db.settings.get('main'))?.lastBackupAt).toBeNull()
  })

  it('backup importado traz a própria data como último backup', async () => {
    const backup = await exportBackup()
    await clearAllData()
    await importBackup(backup)
    expect((await db.settings.get('main'))?.lastBackupAt).toBe(backup.exportedAt)
  })

  it('falha no meio da importação mantém os dados anteriores', async () => {
    await db.expenses.add({ name: 'Original', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' })
    const backup = await exportBackup()
    // dois registros com a mesma chave primária fazem bulkAdd falhar
    backup.tables.expenses = [
      { id: 7, name: 'X', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' },
      { id: 7, name: 'Y', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' },
    ]
    await expect(importBackup(backup)).rejects.toThrow()
    expect((await db.expenses.toArray()).map((e) => e.name)).toEqual(['Original'])
  })
})

describe('parseBackup', () => {
  it('recusa texto que não é JSON', () => {
    expect(parseBackup('xx')).toEqual({ ok: false, error: 'Arquivo inválido: não é um JSON.' })
  })
  it('recusa JSON que não é backup do app', () => {
    expect(parseBackup('{}')).toEqual({ ok: false, error: 'Arquivo inválido: não é um backup do Ireland Life Planner.' })
    expect(parseBackup('null')).toEqual({ ok: false, error: 'Arquivo inválido: não é um backup do Ireland Life Planner.' })
  })
  it('recusa versão de schema mais nova', () => {
    const text = JSON.stringify({ app: 'ireland-life-planner', schemaVersion: 2, exportedAt: '', tables: {} })
    expect(parseBackup(text)).toEqual({ ok: false, error: 'Backup de versão mais nova (v2). Atualize o app antes de importar.' })
  })
  it('aceita backup válido e conta registros', async () => {
    await db.expenses.add({ name: 'A', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' })
    const r = parseBackup(JSON.stringify(await exportBackup()))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.counts.expenses).toBe(1)
      expect(r.counts.categories).toBe(15)
    }
  })
  it('recusa backup com tabela que não é lista', () => {
    const text = JSON.stringify({ app: 'ireland-life-planner', schemaVersion: 1, exportedAt: '', tables: { expenses: 'x' } })
    expect(parseBackup(text)).toEqual({ ok: false, error: 'Arquivo inválido: não é um backup do Ireland Life Planner.' })
  })
})

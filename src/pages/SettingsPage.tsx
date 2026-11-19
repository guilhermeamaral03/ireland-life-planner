import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { clearAllData, downloadBackup, importBackup, parseBackup, type BackupFile } from '../db/backup'
import { getSettings, type TableName } from '../db/db'
import { formatDateTime } from '../domain/format'

const TABLE_LABELS: Record<TableName, string> = {
  settings: 'Configurações',
  categories: 'Categorias',
  expenses: 'Despesas',
  scenarios: 'Cenários',
  locations: 'Localidades',
  safetyRecords: 'Registros de segurança',
  properties: 'Imóveis',
  crimeStations: 'Dados de ocorrências (CSO)',
}


type Message = { type: 'success' | 'error'; text: string } | null

export function SettingsPage() {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [pending, setPending] = useState<{ data: BackupFile; counts: Record<TableName, number> } | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => getSettings().then((s) => setLastBackupAt(s.lastBackupAt))
  useEffect(() => {
    refresh()
  }, [])

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ type: 'success', text: success })
    } catch (err) {
      setMessage({ type: 'error', text: `Não foi possível concluir: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setPending(null)
    setMessage(null)
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível ler o arquivo escolhido.' })
      return
    }
    const result = parseBackup(text)
    if (result.ok) setPending({ data: result.data, counts: result.counts })
    else setMessage({ type: 'error', text: result.error })
  }

  const confirmImport = () => {
    if (!pending) return
    if (!window.confirm('Isso substituirá todos os dados deste aparelho. Continuar?')) return
    const data = pending.data
    setPending(null)
    run(() => importBackup(data), 'Backup importado com sucesso.')
  }

  const clearAll = () => {
    if (!window.confirm('Apagar todos os dados deste aparelho?')) return
    if (!window.confirm('Esta ação não pode ser desfeita. Recomendamos exportar um backup antes. Apagar mesmo assim?')) return
    run(clearAllData, 'Todos os dados foram apagados.')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Configurações</h1>
        <p>Seus dados ficam somente neste aparelho.</p>
      </header>

      {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}

      <section className="card">
        <h2>Exportar backup</h2>
        <p className="muted">
          Último backup: {lastBackupAt ? formatDateTime(lastBackupAt) : 'Nunca'}
        </p>
        <p className="muted">
          Use o arquivo para guardar uma cópia de segurança ou levar seus dados para outro aparelho.
        </p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(downloadBackup, 'Backup exportado.')}>
          Exportar backup
        </button>
      </section>

      <section className="card">
        <h2>Importar backup</h2>
        <p className="muted">A importação substitui todos os dados deste aparelho pelos dados do arquivo.</p>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <button type="button" className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
          Escolher arquivo…
        </button>

        {pending && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p>
              Backup de{' '}
              {formatDateTime(pending.data.exportedAt)}
              . Conteúdo:
            </p>
            <div className="table-wrap">
              <table>
                <tbody>
                  {(Object.keys(TABLE_LABELS) as TableName[]).map((name) => (
                    <tr key={name}>
                      <td>{TABLE_LABELS[name]}</td>
                      <td className="num">{pending.counts[name]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 'var(--space-3)' }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={confirmImport}>
                Importar e substituir
              </button>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Apagar todos os dados</h2>
        <p className="muted">Remove despesas, cenários, localidades, imóveis e configurações deste aparelho.</p>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={clearAll}>
          Apagar todos os dados
        </button>
      </section>
    </div>
  )
}

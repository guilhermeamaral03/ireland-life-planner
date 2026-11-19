import { Loading } from '../components/Loading'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinanceData } from '../app/useFinanceData'
import { ScenarioCompare } from '../components/ScenarioCompare'
import { ScenarioEditor } from '../components/ScenarioEditor'
import { db } from '../db/db'
import type { Scenario } from '../db/types'
import { assignColorSlots, pruneSelection, toggleCompare } from '../domain/compare'
import { formatEUR } from '../domain/format'
import { amountsFromExpenses, computeScenario, emptyScenario } from '../domain/scenarios'
import './IncomePage.css'
import './ScenariosPage.css'

export function ScenariosPage() {
  const { data, error } = useFinanceData()
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null)
  const [editing, setEditing] = useState<Scenario | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [slots, setSlots] = useState<Record<number, number>>({})
  const [compareError, setCompareError] = useState<string | null>(null)

  const loadScenarios = useCallback(async () => {
    const list = await db.scenarios.orderBy('id').toArray()
    setScenarios(list)
    // cenário excluído sai da comparação
    setSelected((sel) => pruneSelection(sel, list.map((x) => x.id!)))
  }, [])
  useEffect(() => {
    loadScenarios()
  }, [loadScenarios])

  const results = useMemo(
    () => (data && scenarios ? new Map(scenarios.map((s) => [s.id!, computeScenario(s, data.settings)])) : null),
    [data, scenarios],
  )

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data || !scenarios || !results) return <Loading />

  const pick = (id: number) => {
    const r = toggleCompare(selected, id)
    setCompareError(r.error)
    setSelected(r.selected)
    setSlots((prev) => assignColorSlots(prev, r.selected))
  }

  const startNew = (fromExpenses: boolean) => {
    const s = emptyScenario(fromExpenses ? 'Minhas despesas atuais' : '')
    if (fromExpenses) s.amounts = amountsFromExpenses(data.expenses, data.categories)
    setEditing(s)
    setMessage(null)
  }

  const save = async (s: Scenario) => {
    await db.scenarios.put(s)
    setEditing(null)
    setMessage('Cenário salvo.')
    await loadScenarios()
  }

  const duplicate = async (s: Scenario) => {
    const { id: _omit, ...rest } = s
    await db.scenarios.add({ ...rest, name: `${s.name} (cópia)` })
    setMessage('Cenário duplicado.')
    await loadScenarios()
  }

  const remove = async (s: Scenario) => {
    if (!window.confirm(`Excluir o cenário "${s.name}"?`)) return
    await db.scenarios.delete(s.id!)
    setMessage('Cenário excluído.')
    await loadScenarios()
  }

  if (editing) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Cenários</h1>
          <p>Os resultados são recalculados enquanto você digita.</p>
        </header>
        <ScenarioEditor initial={editing} base={data.settings} onSave={save} onCancel={() => setEditing(null)} />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Cenários</h1>
        <p>Simule condições de vida diferentes — morando sozinho, dividindo apartamento, com ou sem carro.</p>
      </header>
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {data.settings.grossAnnual === null && (
        <p className="muted">
          Dica: informe seu salário no <Link to="/renda">simulador de renda</Link> ou dentro de cada cenário.
        </p>
      )}

      {compareError && <div className="alert alert-warning" role="status">{compareError}</div>}
      <div className="row scenario-actions">
        <button type="button" className="btn btn-primary" onClick={() => startNew(false)}>
          Novo cenário
        </button>
        <button type="button" className="btn" onClick={() => startNew(true)} disabled={data.expenses.length === 0}>
          Novo a partir das minhas despesas
        </button>
      </div>

      {scenarios.length === 0 ? (
        <section className="card empty-state">
          <h2>Nenhum cenário salvo</h2>
          <p>Crie um cenário em branco ou comece pelas suas despesas atuais e ajuste os valores.</p>
        </section>
      ) : (
        <div className="scenario-grid">
          {scenarios.map((s) => {
            const r = results.get(s.id!)!
            return (
              <article className={`card scenario-card${selected.includes(s.id!) ? ' selected' : ''}`} key={s.id}>
                <h2>{s.name}</h2>
                <label className="compare-pick">
                  <input type="checkbox" checked={selected.includes(s.id!)} onChange={() => pick(s.id!)} />
                  Comparar
                </label>
                {r.tax.ok ? (
                  <dl className="scenario-figures">
                    <dt>Líquido mensal</dt>
                    <dd>{formatEUR(r.tax.netMonthly)}</dd>
                    <dt>Despesas</dt>
                    <dd>{formatEUR(r.totalMonthly)}</dd>
                    <dt>Saldo</dt>
                    <dd className={r.balance! < 0 ? 'negative' : ''}>{formatEUR(r.balance)}</dd>
                  </dl>
                ) : (
                  <p className="muted">{r.tax.reason}</p>
                )}
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(s)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => duplicate(s)}>
                    Duplicar
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(s)}>
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selected.length === 1 && <p className="muted">Selecione pelo menos 2 cenários para comparar.</p>}
      {selected.length >= 2 && (
        <ScenarioCompare
          scenarios={selected.map((id) => scenarios.find((x) => x.id === id)!).filter(Boolean)}
          results={results}
          slots={slots}
          base={data.settings}
        />
      )}
    </div>
  )
}

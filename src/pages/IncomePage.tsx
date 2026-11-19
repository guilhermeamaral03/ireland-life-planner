import { Link } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { useMemo, useRef, useState } from 'react'
import { useFinanceData } from '../app/useFinanceData'
import { NumberField } from '../components/NumberField'
import { TaxBreakdown } from '../components/TaxBreakdown'
import { getTaxRules, ruleSources, TAX_YEARS } from '../data/tax'
import { saveSettings } from '../db/db'
import type { Settings, TaxStatus } from '../db/types'
import { monthlyRentFromExpenses } from '../domain/expenses'
import {
  computeTax,
  effectiveYear,
  ESTIMATE_DISCLAIMER,
  RULES_STATUS_LABELS,
  TAX_STATUS_LABELS,
} from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/format'
import './IncomePage.css'

export function IncomePage() {
  const { data, setData, error } = useFinanceData()
  // campos com texto inválido: o valor não é salvo e o resultado fica oculto até a correção
  const invalidRef = useRef(new Set<string>())
  const [invalidCount, setInvalidCount] = useState(0)
  const validity = (key: string) => (bad: boolean) => {
    if (bad) invalidRef.current.add(key)
    else invalidRef.current.delete(key)
    setInvalidCount(invalidRef.current.size)
  }
  const guard =
    <T,>(key: string, fn: (v: T) => void) =>
    (v: T) => {
      if (!invalidRef.current.has(key)) fn(v)
    }

  const update = async (patch: Partial<Settings>) => {
    setData((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))
    await saveSettings(patch)
  }

  const result = useMemo(() => (data ? computeTax(data.settings, data.expenses, data.categories) : null), [data])

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data) return <Loading />

  const s = data.settings
  const year = effectiveYear(s)
  const rules = getTaxRules(year)
  const rentFromExpenses = monthlyRentFromExpenses(data.expenses, data.categories)

  return (
    <div className="page">
      <header className="page-header">
        <h1>Simulador de renda</h1>
        <p>Salário líquido estimado pelas regras fiscais da Irlanda (Income Tax, USC e PRSI).</p>
      </header>

      <div className="income-layout">
        <section className="card">
          <h2>Seus dados</h2>
          <div className="form-stack">
            <div className="field">
              <label htmlFor="tax-year">Ano fiscal</label>
              <select
                id="tax-year"
                className="input"
                value={year}
                onChange={(e) => update({ taxYear: Number(e.target.value) })}
              >
                {TAX_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y} — {getTaxRules(y)!.status === 'oficial' ? 'oficial' : 'proposto'}
                  </option>
                ))}
              </select>
            </div>

            <NumberField
              label="Salário bruto anual"
              value={s.grossAnnual}
              min={0}
              suffix="€/ano"
              onValidityChange={validity('gross')}
              onChange={guard('gross', (v: number | null) => update({ grossAnnual: v }))}
            />

            <div className="field">
              <label htmlFor="tax-status">Situação fiscal</label>
              <select
                id="tax-status"
                className="input"
                value={s.taxStatus ?? 'solteiro'}
                onChange={(e) => update({ taxStatus: e.target.value as TaxStatus })}
              >
                {(Object.keys(TAX_STATUS_LABELS) as TaxStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {TAX_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                Casados podem ser tributados em conjunto, dependendo da residência dos dois. Troque para comparar.
              </span>
            </div>

            {s.taxStatus === 'casado_duas_rendas' && (
              <NumberField
                label="Renda bruta anual do cônjuge"
                value={s.spouseGrossAnnual}
                min={0}
                suffix="€/ano"
                onValidityChange={validity('spouse')}
                onChange={guard('spouse', (v: number | null) => update({ spouseGrossAnnual: v }))}
              />
            )}

            <p className="field-hint">
              Rent Tax Credit: usa o aluguel cadastrado em Despesas ({formatEUR(rentFromExpenses)}/mês).{' '}
              <Link to="/despesas">Editar em Despesas</Link>
            </p>

            <label className="check">
              <input
                type="checkbox"
                checked={s.uscReducedRate}
                onChange={(e) => update({ uscReducedRate: e.target.checked })}
              />
              <span>
                Tenho direito à taxa reduzida de USC
                <span className="field-hint" style={{ display: 'block' }}>
                  Cartão médico completo (medical card) ou 70 anos ou mais, com renda até € 60.000.
                </span>
              </span>
            </label>

            <ExtraCredits
              value={s.extraCredits}
              onChange={(extraCredits) => update({ extraCredits })}
              validity={validity}
              guard={guard}
            />

            <h3 className="form-subtitle">Planejamento</h3>
            <NumberField
              label="Reserva financeira atual"
              value={s.initialReserve}
              min={0}
              suffix="€"
              hint="Usada na projeção do Dashboard."
              onValidityChange={validity('reserve')}
              onChange={guard('reserve', (v: number | null) => update({ initialReserve: v }))}
            />
            <NumberField
              label="Meses de projeção"
              value={s.projectionMonths}
              min={1}
              onValidityChange={validity('months')}
              onChange={guard('months', (v: number | null) => v !== null && v >= 1 && update({ projectionMonths: Math.round(v) }))}
            />
          </div>
        </section>

        <section>
          {rules && (
            <p>
              <span className={`badge badge-${rules.status}`}>{RULES_STATUS_LABELS[rules.status]}</span>
            </p>
          )}
          {invalidCount > 0 && <div className="alert alert-error">Corrija os campos marcados como inválidos.</div>}
          {invalidCount === 0 && result === null && (
            <div className="card empty-state">
              <p>Informe o salário bruto anual para calcular.</p>
            </div>
          )}
          {invalidCount === 0 && result && !result.ok && <div className="alert alert-warning">{result.reason}</div>}
          {invalidCount === 0 && result?.ok && (
            <>
              <div className="kpis">
                <div className="kpi kpi-primary">
                  <div className="kpi-label">Líquido mensal</div>
                  <div className="kpi-value">{formatEUR(result.netMonthly)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Líquido anual</div>
                  <div className="kpi-value">{formatEUR(result.netAnnual)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Líquido semanal</div>
                  <div className="kpi-value">{formatEUR(result.netWeekly)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Total descontado</div>
                  <div className="kpi-value">{formatPercent(result.effectiveRate)}</div>
                  <div className="kpi-sub">{formatEUR(result.totalDeductions)} por ano</div>
                </div>
              </div>
              <div className="card">
                <h2>Detalhamento</h2>
                <TaxBreakdown
                  r={result}
                  gross={s.grossAnnual ?? 0}
                  spouse={s.taxStatus === 'casado_duas_rendas' ? s.spouseGrossAnnual : null}
                />
              </div>
            </>
          )}

          <div className="card">
            <p className="disclaimer">
              <strong>{ESTIMATE_DISCLAIMER}</strong> O cálculo considera um empregado PAYE, classe A de PRSI, sem
              pensão, benefícios ou outras rendas.
            </p>
            {rules && (
              <>
                {rules.notes.length > 0 && (
                  <ul className="disclaimer">
                    <li>{rules.statusNote}</li>
                    {rules.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <p className="disclaimer">Fontes ({rules.year}):</p>
                <ul className="sources">
                  {ruleSources(rules).map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ExtraCredits({
  value,
  onChange,
  validity,
  guard,
}: {
  value: Settings['extraCredits']
  onChange(v: Settings['extraCredits']): void
  validity(key: string): (bad: boolean) => void
  guard<T>(key: string, fn: (v: T) => void): (v: T) => void
}) {
  // remontar as linhas após remover: índices mudam e a validade é zerada junto com o texto
  const [generation, setGeneration] = useState(0)
  const set = (i: number, patch: Partial<Settings['extraCredits'][number]>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <div className="field">
      <span className="field-label">Outros créditos fiscais</span>
      <span className="field-hint">Só se você souber que tem direito (ex.: créditos informados pela Revenue).</span>
      {value.map((c, i) => (
        <div className="extra-credit" key={`${generation}-${i}`}>
          <input
            className="input"
            aria-label="Nome do crédito"
            placeholder="Nome"
            value={c.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <NumberField
            label="Valor anual"
            value={c.amount}
            min={0}
            suffix="€"
            onValidityChange={validity(`credit-${i}`)}
            onChange={guard(`credit-${i}`, (v: number | null) => set(i, { amount: v ?? 0 }))}
          />
          <button type="button" className="btn btn-danger" onClick={() => {
              value.forEach((_, j) => validity(`credit-${j}`)(false))
              setGeneration((g) => g + 1)
              onChange(value.filter((_, j) => j !== i))
            }}>
            Remover
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...value, { name: '', amount: 0 }])}>
        Adicionar crédito
      </button>
    </div>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import type { Scenario, Settings, TaxStatus } from '../db/types'
import { ESTIMATE_DISCLAIMER, TAX_STATUS_LABELS } from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/format'
import { computeScenario, emptyScenario, SCENARIO_KEYS, SCENARIO_LABELS, validateScenario } from '../domain/scenarios'
import { NumberField } from './NumberField'

interface Props {
  initial: Scenario
  base: Settings
  onSave(s: Scenario): Promise<void>
  onCancel(): void
}

export function ScenarioEditor({ initial, base, onSave, onCancel }: Props) {
  // normaliza registros antigos (ex.: backup sem os campos novos)
  const [s, setS] = useState<Scenario>(() => ({
    ...emptyScenario(''),
    ...initial,
    name: initial.name ?? '',
    grossAnnual: initial.grossAnnual ?? null,
    taxStatus: initial.taxStatus ?? null,
    spouseGrossAnnual: initial.spouseGrossAnnual ?? null,
    initialReserve: initial.initialReserve ?? null,
    amounts: { ...emptyScenario('').amounts, ...initial.amounts },
  }))
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const validity = (field: string) => (bad: boolean) =>
    setInvalid((prev) => {
      const next = new Set(prev)
      if (bad) next.add(field)
      else next.delete(field)
      return next
    })
  const hasInvalid = invalid.size > 0
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const r = useMemo(() => computeScenario(s, base), [s, base])

  const effectiveStatus: TaxStatus = s.taxStatus ?? base.taxStatus ?? 'solteiro'
  const inheritedStatusLabel = TAX_STATUS_LABELS[base.taxStatus ?? 'solteiro']

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (hasInvalid) return
    const err = validateScenario(s)
    setError(err)
    if (err) return
    setSaving(true)
    try {
      await onSave({ ...s, name: s.name.trim() })
    } catch (x) {
      setError(`Não foi possível salvar: ${String(x)}`)
      setSaving(false)
    }
  }

  return (
    <form className="scenario-editor" onSubmit={submit} noValidate>
      <section className="card">
        <h2>{initial.id ? 'Editar cenário' : 'Novo cenário'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-stack">
          <div className="field">
            <label htmlFor="sc-name">Nome do cenário</label>
            <input
              id="sc-name"
              className="input"
              placeholder="Ex.: Dividindo apartamento em Ballincollig"
              value={s.name}
              onChange={(e) => setS({ ...s, name: e.target.value })}
            />
          </div>

          <h3 className="form-subtitle">Renda</h3>
          <NumberField
            label="Salário bruto anual"
            value={s.grossAnnual}
            min={0}
            suffix="€/ano"
            hint={`Em branco = usar o do simulador (${formatEUR(base.grossAnnual)}).`}
            onValidityChange={validity('grossAnnual')}
            onChange={(grossAnnual) => setS({ ...s, grossAnnual })}
          />
          <div className="field">
            <label htmlFor="sc-status">Situação fiscal</label>
            <select
              id="sc-status"
              className="input"
              value={s.taxStatus ?? ''}
              onChange={(e) => setS({ ...s, taxStatus: e.target.value === '' ? null : (e.target.value as TaxStatus) })}
            >
              <option value="">Igual ao simulador ({inheritedStatusLabel})</option>
              {(Object.keys(TAX_STATUS_LABELS) as TaxStatus[]).map((k) => (
                <option key={k} value={k}>
                  {TAX_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          {effectiveStatus === 'casado_duas_rendas' &&
            (s.taxStatus !== null ? (
              <NumberField
                label="Renda bruta anual do cônjuge"
                value={s.spouseGrossAnnual}
                min={0}
                suffix="€/ano"
                onValidityChange={validity('spouse')}
                onChange={(spouseGrossAnnual) => setS({ ...s, spouseGrossAnnual })}
              />
            ) : (
              <p className="field-hint">Renda do cônjuge: a do simulador ({formatEUR(base.spouseGrossAnnual)}).</p>
            ))}

          <h3 className="form-subtitle">Despesas mensais</h3>
          <div className="form-grid">
            {SCENARIO_KEYS.map((k) => (
              <NumberField
                key={k}
                label={SCENARIO_LABELS[k]}
                value={s.amounts[k]}
                min={0}
                suffix="€/mês"
                hint={k === 'aluguel' ? 'Sem contas. Usado no Rent Tax Credit.' : undefined}
                onValidityChange={validity(k)}
                onChange={(v) => setS({ ...s, amounts: { ...s.amounts, [k]: v ?? 0 } })}
              />
            ))}
          </div>

          <h3 className="form-subtitle">Reserva</h3>
          <NumberField
            label="Reserva inicial"
            value={s.initialReserve}
            min={0}
            suffix="€"
            hint={`Em branco = usar a do simulador (${base.initialReserve === null ? 'não informada' : formatEUR(base.initialReserve)}).`}
            onValidityChange={validity('reserve')}
            onChange={(initialReserve) => setS({ ...s, initialReserve })}
          />
        </div>
      </section>

      <section className="card scenario-live" aria-live="polite">
        <h2>Resultado</h2>
        {hasInvalid ? (
          <div className="alert alert-error">Corrija os campos marcados como inválidos.</div>
        ) : !r.tax.ok ? (
          <div className="alert alert-warning">{r.tax.reason}</div>
        ) : (
          <table>
            <tbody>
              <tr>
                <td>Renda líquida mensal</td>
                <td className="num">{formatEUR(r.tax.netMonthly)}</td>
              </tr>
              <tr>
                <td>Despesas totais</td>
                <td className="num">{formatEUR(r.totalMonthly)}</td>
              </tr>
              <tr className="subtotal">
                <td>Saldo mensal</td>
                <td className={`num${r.balance! < 0 ? ' negative' : ''}`}>{formatEUR(r.balance)}</td>
              </tr>
              <tr>
                <td>Economia mensal</td>
                <td className="num">
                  {formatEUR(r.savingMonthly)} <span className="muted">({formatPercent(r.savingRate)})</span>
                </td>
              </tr>
              <tr>
                <td>Economia anual</td>
                <td className="num">{formatEUR(r.savingAnnual)}</td>
              </tr>
              <tr>
                <td>Reserva em {base.projectionMonths} meses</td>
                <td className="num">
                  {r.projection ? formatEUR(r.projection[r.projection.length - 1].value) : 'Informe a reserva'}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="disclaimer">{ESTIMATE_DISCLAIMER}</p>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={saving || hasInvalid}>
            Salvar cenário
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </section>
    </form>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import type { Location, Property } from '../db/types'
import { ESTIMATE_DISCLAIMER } from '../domain/finance'
import { formatEUR } from '../domain/format'
import { propertyCost, type BaselineExpenses, type NetInput } from '../domain/housing'
import { emptyProperty, PROPERTY_TYPES, validateProperty } from '../domain/properties'
import { PartText, RangeText } from './HousingFormat'
import { NumberField } from './NumberField'

interface Props {
  initial: Property
  locations: Location[]
  base: BaselineExpenses
  netFor: NetInput
  onSave(p: Property): Promise<void>
  onCancel(): void
}

export function PropertyForm({ initial, locations, base, netFor, onSave, onCancel }: Props) {
  const [p, setP] = useState<Property>({ ...emptyProperty(), ...initial })
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const validity = (k: string) => (bad: boolean) =>
    setInvalid((prev) => {
      const n = new Set(prev)
      if (bad) n.add(k)
      else n.delete(k)
      return n
    })
  const num = (k: keyof Property, label: string, extra: Partial<Parameters<typeof NumberField>[0]> = {}) => (
    <NumberField
      label={label}
      value={p[k] as number | null}
      min={0}
      onValidityChange={validity(k)}
      onChange={(v) => setP((cur) => ({ ...cur, [k]: v }))}
      {...extra}
    />
  )

  const cost = useMemo(() => (p.rent > 0 ? propertyCost(p, base, netFor) : null), [p, base, netFor])
  const hasInvalid = invalid.size > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (hasInvalid) return setError('Corrija os campos marcados como inválidos.')
    const err = validateProperty(p)
    if (err) return setError(err)
    setError(null)
    setSaving(true)
    try {
      await onSave(p)
    } catch (x) {
      setError(`Não foi possível salvar: ${String(x)}`)
      setSaving(false)
    }
  }

  return (
    <form className="property-form" onSubmit={submit} noValidate>
      <section className="card">
        <h2>{initial.id ? 'Editar imóvel' : 'Novo imóvel'}</h2>
        <div className="form-stack">
          <div className="field">
            <label htmlFor="pr-title">Título do anúncio</label>
            <input id="pr-title" className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pr-url">Link do anúncio</label>
            <input id="pr-url" className="input" inputMode="url" placeholder="https://" value={p.url} onChange={(e) => setP({ ...p, url: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pr-type">Tipo</label>
              <select id="pr-type" className="input" value={p.type} onChange={(e) => setP({ ...p, type: e.target.value as Property['type'] })}>
                {(Object.keys(PROPERTY_TYPES) as Property['type'][]).map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPES[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pr-loc">Localidade</label>
              <select
                id="pr-loc"
                className="input"
                value={p.locationId ?? ''}
                onChange={(e) => setP({ ...p, locationId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Nenhuma</option>
                {p.locationId !== null && !locations.some((l) => l.id === p.locationId) && (
                  <option value={p.locationId}>Localidade excluída</option>
                )}
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pr-addr">Endereço</label>
            <input id="pr-addr" className="input" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </div>

          <h3 className="form-subtitle">Valores</h3>
          <div className="form-grid">
            {num('rent', 'Aluguel mensal (a sua parte)', { suffix: '€/mês', value: p.rent || null, onChange: (v) => setP((c) => ({ ...c, rent: v ?? 0 })) })}
            {num('deposit', 'Depósito', { suffix: '€' })}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={p.billsIncluded}
              onChange={(e) => {
                // o campo de contas some: ele não pode continuar bloqueando o salvamento
                if (e.target.checked) validity('billsMonthly')(false)
                setP({ ...p, billsIncluded: e.target.checked, billsMonthly: e.target.checked ? null : p.billsMonthly })
              }}
            />
            Contas incluídas no aluguel
          </label>
          {!p.billsIncluded &&
            num('billsMonthly', 'Contas por mês (a sua parte)', {
              suffix: '€/mês',
              hint: 'Vazio = usar as contas das suas despesas atuais.',
            })}
          <div className="form-grid">
            {num('transportMonthly', 'Transporte por mês', { suffix: '€/mês', hint: 'Vazio = usar o transporte das suas despesas.' })}
            {num('residents', 'Número de moradores', { hint: 'Só informativo.' })}
          </div>

          <h3 className="form-subtitle">Deslocamento</h3>
          <div className="form-grid">
            <NumberField
              label="Latitude"
              decimal
              value={p.lat}
              onValidityChange={validity('lat')}
              onChange={(lat) => setP((c) => ({ ...c, lat }))}
            />
            <NumberField
              label="Longitude"
              decimal
              value={p.lng}
              onValidityChange={validity('lng')}
              onChange={(lng) => setP((c) => ({ ...c, lng }))}
              hint="Opcional. Com a posição, o app calcula a rota de carro até Cork City."
            />
          </div>
          <div className="form-grid">
            <NumberField
              label="Transporte público até Cork City"
              value={p.transitMinutes.value}
              min={0}
              suffix="min"
              onValidityChange={validity('transit')}
              onChange={(value) => setP((c) => ({ ...c, transitMinutes: { ...c.transitMinutes, value } }))}
            />
            <div className="field">
              <label htmlFor="pr-transit-status">Status</label>
              <select
                id="pr-transit-status"
                className="input"
                value={p.transitMinutes.status ?? 'estimado'}
                onChange={(e) =>
                  setP({ ...p, transitMinutes: { ...p.transitMinutes, status: e.target.value as 'confirmado' | 'estimado' } })
                }
              >
                <option value="estimado">Estimado</option>
                <option value="confirmado">Confirmado</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pr-transit-src">Fonte</label>
              <input
                id="pr-transit-src"
                className="input"
                value={p.transitMinutes.source ?? ''}
                onChange={(e) => setP({ ...p, transitMinutes: { ...p.transitMinutes, source: e.target.value || null } })}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="pr-date">Data do anúncio ou da consulta</label>
              <input id="pr-date" type="date" className="input" value={p.listedAt ?? ''} onChange={(e) => setP({ ...p, listedAt: e.target.value || null })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pr-notes">Observações</label>
            <textarea id="pr-notes" className="input" rows={3} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={p.favorite} onChange={(e) => setP({ ...p, favorite: e.target.checked })} />
            Favorito
          </label>
        </div>
      </section>

      <section className="card property-live" aria-live="polite">
        <h2>Custo e impacto</h2>
        {hasInvalid ? (
          <div className="alert alert-error">Corrija os campos marcados como inválidos.</div>
        ) : !cost ? (
          <p className="muted">Informe o aluguel para ver o custo.</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <td>Aluguel</td>
                <td className="num">{formatEUR(p.rent)}</td>
              </tr>
              <tr>
                <td>Contas</td>
                <td className="num">
                  <PartText p={cost.bills} itemLabel="do imóvel" />
                </td>
              </tr>
              <tr>
                <td>Transporte</td>
                <td className="num">
                  <PartText p={cost.transport} itemLabel="do imóvel" />
                </td>
              </tr>
              <tr>
                <td>Outras despesas</td>
                <td className="num">
                  {formatEUR(cost.other)} <span className="origin">das suas despesas</span>
                </td>
              </tr>
              <tr className="subtotal">
                <td>Custo total mensal</td>
                <td className="num">
                  <RangeText r={cost.total} />
                </td>
              </tr>
              <tr>
                <td>Líquido (com Rent Tax Credit)</td>
                <td className="num">{cost.net ? formatEUR(cost.net.atMinRent) : 'Não disponível'}</td>
              </tr>
              <tr className="subtotal">
                <td>Saldo mensal</td>
                <td className={`num${cost.balance && cost.balance.min < 0 ? ' negative' : ''}`}>
                  <RangeText r={cost.balance} />
                </td>
              </tr>
              <tr>
                <td>Economia mensal</td>
                <td className="num">
                  <RangeText r={cost.saving} />
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <p className="disclaimer">{ESTIMATE_DISCLAIMER}</p>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={saving || hasInvalid}>
            Salvar imóvel
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </section>
    </form>
  )
}

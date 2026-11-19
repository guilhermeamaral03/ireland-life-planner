import { useState, type FormEvent } from 'react'
import type { Location, Property } from '../db/types'
import { emptyProperty, PROPERTY_TYPES, validateProperty } from '../domain/properties'
import { NumberField } from './NumberField'

interface Props {
  initial: Property
  locations: Location[]
  onSave(p: Property): Promise<void>
  onCancel(): void
}

/** Cadastro enxuto de anúncio — só para controle (as contas ficam no Dashboard). */
export function PropertyForm({ initial, locations, onSave, onCancel }: Props) {
  // campos antigos (depósito, posição…) continuam guardados, só não aparecem
  const [p, setP] = useState<Property>({ ...emptyProperty(), ...initial })
  const [rentInvalid, setRentInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (rentInvalid) return setError('Corrija o valor do aluguel.')
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

  const dangling = p.locationId !== null && !locations.some((l) => l.id === p.locationId)

  return (
    <form className="card property-form-lean" onSubmit={submit} noValidate>
      <h2>{initial.id ? 'Editar imóvel' : 'Novo imóvel'}</h2>
      <div className="form-stack">
        <div className="field">
          <label htmlFor="pr-title">Título do anúncio</label>
          <input id="pr-title" className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pr-url">Link do anúncio</label>
          <input
            id="pr-url"
            className="input"
            inputMode="url"
            placeholder="https://"
            value={p.url}
            onChange={(e) => setP({ ...p, url: e.target.value })}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pr-loc">Localidade</label>
            <select
              id="pr-loc"
              className="input"
              value={p.locationId ?? ''}
              onChange={(e) => setP({ ...p, locationId: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Nenhuma</option>
              {dangling && <option value={p.locationId!}>Localidade excluída</option>}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
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
          <NumberField
            label="Aluguel mensal (a sua parte)"
            value={p.rent || null}
            min={0}
            suffix="€/mês"
            onValidityChange={setRentInvalid}
            onChange={(v) => setP((c) => ({ ...c, rent: v ?? 0 }))}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={p.billsIncluded} onChange={(e) => setP({ ...p, billsIncluded: e.target.checked })} />
          Contas incluídas no aluguel
        </label>
        <div className="field">
          <label htmlFor="pr-notes">Observações</label>
          <textarea id="pr-notes" className="input" rows={3} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
        </div>
        <label className="check">
          <input type="checkbox" checked={p.favorite} onChange={(e) => setP({ ...p, favorite: e.target.checked })} />
          Favorito
        </label>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 'var(--space-3)' }}>{error}</div>}
      <div className="row" style={{ marginTop: 'var(--space-4)' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          Salvar imóvel
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

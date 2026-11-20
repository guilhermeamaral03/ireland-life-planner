import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Location, Property } from '../db/types'
import { fillFromListing, parseListingText, parseListingUrl } from '../domain/listing'
import { emptyProperty, PROPERTY_TYPES, validateProperty } from '../domain/properties'
import { NumberField } from './NumberField'

interface Props {
  initial: Property
  locations: Location[]
  /** Texto recebido pelo botão Compartilhar do celular — preenche o formulário ao abrir. */
  sharedText?: string
  onSave(p: Property): Promise<void>
  onCancel(): void
}

type Info = { filled: string[]; notes: string[]; source: string } | null

/** Cadastro enxuto de anúncio — só para controle (as contas ficam no Dashboard). */
export function PropertyForm({ initial, locations, sharedText, onSave, onCancel }: Props) {
  // campos antigos (depósito, posição…) continuam guardados, só não aparecem
  const [p, setP] = useState<Property>({ ...emptyProperty(), ...initial })
  const [rentInvalid, setRentInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pasted, setPasted] = useState(sharedText ?? '')
  const [info, setInfo] = useState<Info>(null)
  // campos que você mexeu à mão nunca são trocados pela leitura automática
  const touched = useRef(new Set<string>(initial.id ? ['type', 'billsIncluded'] : []))

  const applyText = (text: string, base: Property) => {
    const fromText = parseListingText(text)
    const url = base.url.trim() || fromText.url || ''
    const fromUrl = url ? parseListingUrl(url, locations) : null
    const r = fillFromListing(base, fromUrl, fromText, touched.current)
    setP(r.property)
    setInfo({ filled: r.filled, notes: fromText.notes, source: 'texto do anúncio' })
  }

  // conteúdo compartilhado pelo celular: preenche uma vez ao abrir
  const sharedApplied = useRef(false)
  useEffect(() => {
    if (sharedText && !sharedApplied.current) {
      sharedApplied.current = true
      applyText(sharedText, p)
    }
  }, [sharedText]) // eslint-disable-line react-hooks/exhaustive-deps

  const onUrl = (url: string) => {
    const base = { ...p, url }
    const fromUrl = parseListingUrl(url, locations)
    if (!fromUrl) {
      setP(base)
      return
    }
    const r = fillFromListing(base, fromUrl, null, touched.current)
    setP(r.property)
    setInfo({ filled: r.filled, notes: [], source: `link (${fromUrl.portal})` })
  }

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
          <label htmlFor="pr-url">Link do anúncio</label>
          <input
            id="pr-url"
            className="input"
            inputMode="url"
            placeholder="https://www.daft.ie/…"
            value={p.url}
            onChange={(e) => onUrl(e.target.value)}
          />
          <span className="field-hint">Cole o link: título, tipo e localidade são preenchidos a partir dele.</span>
        </div>

        <details className="paste-box" open={!!sharedText}>
          <summary>Colar o texto do anúncio (para preencher o aluguel e as contas)</summary>
          <div className="field">
            <label htmlFor="pr-paste">Texto copiado da página do anúncio</label>
            <textarea
              id="pr-paste"
              className="input"
              rows={4}
              placeholder="Ex.: €1,100 per month · Double room · All bills included"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          </div>
          <button type="button" className="btn" onClick={() => applyText(pasted, p)} disabled={!pasted.trim()}>
            Preencher com o texto
          </button>
        </details>

        {info && (
          <div className={`alert ${info.filled.length ? 'alert-success' : 'alert-warning'}`} role="status">
            {info.filled.length
              ? `Preenchido pelo ${info.source}: ${info.filled.join(', ')}. Confira antes de salvar.`
              : `Nada novo encontrado no ${info.source} (campos já preenchidos não são trocados).`}
            {info.notes.map((n) => (
              <span key={n} className="field-hint" style={{ display: 'block' }}>
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="pr-title">Título do anúncio</label>
          <input id="pr-title" className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
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
            <select
              id="pr-type"
              className="input"
              value={p.type}
              onChange={(e) => {
                touched.current.add('type')
                setP({ ...p, type: e.target.value as Property['type'] })
              }}
            >
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
          <input
            type="checkbox"
            checked={p.billsIncluded}
            onChange={(e) => {
              touched.current.add('billsIncluded')
              setP({ ...p, billsIncluded: e.target.checked })
            }}
          />
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

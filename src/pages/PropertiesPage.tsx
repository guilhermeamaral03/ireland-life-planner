import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { PropertyForm } from '../components/PropertyForm'
import { db } from '../db/db'
import { applyRentToExpenses } from '../db/rent'
import type { Location, Property } from '../db/types'
import { formatEUR } from '../domain/format'
import { normalizeLocation } from '../domain/locations'
import { emptyProperty, PROPERTY_TYPES } from '../domain/properties'
import './PropertiesPage.css'

const RESULT_TEXT = {
  criada: 'Despesa de aluguel criada com este valor.',
  atualizada: 'Despesa de aluguel atualizada com este valor.',
  substituidas: 'As despesas de aluguel foram substituídas por este valor.',
} as const

export function PropertiesPage() {
  const [properties, setProperties] = useState<Property[] | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [editing, setEditing] = useState<Property | null>(null)
  const [onlyFav, setOnlyFav] = useState(false)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; toExpenses?: boolean } | null>(null)

  const load = useCallback(async () => {
    const [ps, ls] = await Promise.all([db.properties.orderBy('id').toArray(), db.locations.toArray()])
    setProperties(ps.map((p) => ({ ...emptyProperty(), ...p })))
    setLocations(ls.map(normalizeLocation).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (!properties) return <Loading />

  const locName = (p: Property) =>
    p.locationId === null ? null : (locations.find((l) => l.id === p.locationId)?.name ?? 'Localidade excluída')

  const save = async (p: Property) => {
    await db.properties.put({ ...p, title: p.title.trim(), url: p.url.trim() })
    setEditing(null)
    setMessage({ type: 'success', text: 'Imóvel salvo.' })
    await load()
  }

  const remove = async (p: Property) => {
    if (!window.confirm(`Excluir o imóvel "${p.title}"?`)) return
    await db.properties.delete(p.id!)
    setMessage({ type: 'success', text: 'Imóvel excluído.' })
    await load()
  }

  const useRent = async (p: Property) => {
    if (applying) return
    setApplying(true)
    try {
      const r = await applyRentToExpenses(p.rent, p.title, (n) =>
        window.confirm(`Você tem ${n} despesas de aluguel. Substituir todas por ${formatEUR(p.rent)}/mês deste imóvel?`),
      )
      if (r === 'cancelado') return
      setMessage({ type: 'success', text: RESULT_TEXT[r], toExpenses: true })
    } catch (x) {
      setMessage({ type: 'error', text: x instanceof Error ? x.message : String(x) })
    } finally {
      setApplying(false)
    }
  }

  if (editing) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Imóveis</h1>
        </header>
        <PropertyForm initial={editing} locations={locations} onSave={save} onCancel={() => setEditing(null)} />
      </div>
    )
  }

  const shown = properties
    .filter((p) => !onlyFav || p.favorite)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.rent - b.rent)

  return (
    <div className="page">
      <header className="page-header">
        <h1>Imóveis</h1>
        <p>Anúncios que você encontrou, para controle. Quando escolher um, use o aluguel dele nas suas despesas.</p>
      </header>
      {message && (
        <div className={`alert alert-${message.type}`} role="status">
          {message.text} {message.toExpenses && <Link to="/">Ver no Dashboard</Link>}
        </div>
      )}

      <div className="row prop-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(emptyProperty())
            setMessage(null)
          }}
        >
          Novo imóvel
        </button>
        <label className="check">
          <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} />
          Só favoritos
        </label>
      </div>

      {shown.length === 0 ? (
        <section className="card empty-state">
          <h2>{properties.length === 0 ? 'Nenhum imóvel cadastrado' : 'Nenhum favorito'}</h2>
          <p>Cadastre os anúncios que encontrar (Daft, Rent.ie, grupos) para não perder de vista.</p>
        </section>
      ) : (
        <div className="prop-grid">
          {shown.map((p) => (
            <article className="card prop-card" key={p.id}>
              <h2>
                {p.favorite ? '★ ' : ''}
                {p.title}
              </h2>
              <p className="muted prop-sub">
                {PROPERTY_TYPES[p.type]}
                {locName(p) ? ` · ${locName(p)}` : ''}
              </p>
              <p className="prop-rent">
                {formatEUR(p.rent)}
                <span className="muted">/mês{p.billsIncluded ? ' · contas incluídas' : ''}</span>
              </p>
              {p.notes && <p className="prop-notes">{p.notes}</p>}
              <div className="row">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => useRent(p)} disabled={applying}>
                  Usar este aluguel nas minhas despesas
                </button>
              </div>
              <div className="row">
                {p.url && (
                  <a className="btn btn-sm" href={p.url} target="_blank" rel="noreferrer">
                    Ver anúncio
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setEditing(p)
                    setMessage(null)
                  }}
                >
                  Editar
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

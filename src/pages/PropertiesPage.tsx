import { Loading } from '../components/Loading'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFinanceData } from '../app/useFinanceData'
import { PartText, RangeText } from '../components/HousingFormat'
import { PropertyForm } from '../components/PropertyForm'
import { db } from '../db/db'
import type { Location, Property } from '../db/types'
import { assignColorSlots, COMPARE_COLORS, pruneSelection, toggleCompare } from '../domain/compare'
import { computeTax, ESTIMATE_DISCLAIMER, netMonthlyForRent } from '../domain/finance'
import { formatDateTime, formatEUR, formatKm, NOT_AVAILABLE } from '../domain/format'
import { baselineFromExpenses, bestBy, propertyCost, type HousingCost } from '../domain/housing'
import { normalizeLocation } from '../domain/locations'
import { emptyProperty, prepareProperty, PROPERTY_TYPES } from '../domain/properties'
import { fetchCarRoute, routeToSourced } from '../services/osrm'
import './IncomePage.css'
import './ScenariosPage.css'
import './PropertiesPage.css'

export function PropertiesPage() {
  const { data, error } = useFinanceData()
  const [properties, setProperties] = useState<Property[] | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [editing, setEditing] = useState<Property | null>(null)
  const [onlyFav, setOnlyFav] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [slots, setSlots] = useState<Record<number, number>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null)

  const load = useCallback(async () => {
    const [ps, ls] = await Promise.all([db.properties.orderBy('id').toArray(), db.locations.toArray()])
    setProperties(ps.map((p) => ({ ...emptyProperty(), ...p })))
    setLocations(ls.map(normalizeLocation).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    setSelected((sel) => pruneSelection(sel, ps.map((p) => p.id!)))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const ctx = useMemo(() => {
    if (!data) return null
    return {
      tax: computeTax(data.settings, data.expenses, data.categories),
      netFor: netMonthlyForRent(data.settings, data.expenses, data.categories),
      base: baselineFromExpenses(data.expenses, data.categories),
    }
  }, [data])

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data || !ctx || !properties) return <Loading />

  const reference = locations.find((l) => l.isReference)
  const locName = (p: Property) =>
    p.locationId === null ? '—' : (locations.find((l) => l.id === p.locationId)?.name ?? 'Localidade excluída')
  const costOf = (p: Property) => propertyCost(p, ctx.base, ctx.netFor)

  const save = async (draft: Property) => {
    const current = draft.id ? (properties.find((x) => x.id === draft.id) ?? null) : null
    const p = prepareProperty(current, draft)
    const id = (await db.properties.put(p)) as number
    setEditing(null)
    let text = 'Imóvel salvo.'
    let type: 'success' | 'warning' = 'success'
    if (p.lat !== null && p.lng !== null && !p.carRoute.value && reference) {
      const r = await fetchCarRoute({ lat: p.lat, lng: p.lng }, reference)
      if (r.ok) await db.properties.update(id, { carRoute: routeToSourced(r, new Date().toISOString()) })
      else {
        text = `Imóvel salvo, mas a rota de carro não foi calculada: ${r.reason}`
        type = 'warning'
      }
    }
    setMessage({ type, text })
    await load()
  }

  const remove = async (p: Property) => {
    if (!window.confirm(`Excluir o imóvel "${p.title}"?`)) return
    await db.properties.delete(p.id!)
    setMessage({ type: 'success', text: 'Imóvel excluído.' })
    await load()
  }

  const pick = (id: number) => {
    const r = toggleCompare(selected, id)
    if (r.error) setMessage({ type: 'warning', text: r.error })
    setSelected(r.selected)
    setSlots((prev) => assignColorSlots(prev, r.selected))
  }

  if (editing) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Imóveis</h1>
          <p>O custo e o impacto no seu saldo são recalculados enquanto você digita.</p>
        </header>
        <PropertyForm
          initial={editing}
          locations={locations}
          base={ctx.base}
          netFor={ctx.netFor}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  const shown = properties.filter((p) => !onlyFav || p.favorite)
  const compared = selected.map((id) => properties.find((p) => p.id === id)!).filter(Boolean)

  return (
    <div className="page">
      <header className="page-header">
        <h1>Imóveis</h1>
        <p>Anúncios que você encontrou, com custo total e impacto no seu salário líquido. Cadastro manual.</p>
      </header>
      {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}
      {ctx.tax === null && (
        <p className="muted">
          Para ver saldo e economia, <Link to="/renda">informe seu salário no simulador</Link>.
        </p>
      )}
      {ctx.tax && !ctx.tax.ok && <p className="muted">Renda indisponível: {ctx.tax.reason}</p>}

      <div className="row scenario-actions">
        <button type="button" className="btn btn-primary" onClick={() => { setEditing(emptyProperty()); setMessage(null) }}>
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
          <p>Cadastre os anúncios que você encontrar (Daft, Rent.ie, grupos) para comparar o custo real de cada um.</p>
        </section>
      ) : (
        <div className="scenario-grid">
          {shown.map((p) => {
            const c = costOf(p)
            return (
              <article className={`card scenario-card${selected.includes(p.id!) ? ' selected' : ''}`} key={p.id}>
                <h2>
                  {p.favorite ? '★ ' : ''}
                  {p.title}
                </h2>
                <p className="muted prop-sub">
                  {PROPERTY_TYPES[p.type]} · {locName(p)}
                </p>
                <label className="compare-pick">
                  <input type="checkbox" checked={selected.includes(p.id!)} onChange={() => pick(p.id!)} />
                  Comparar
                </label>
                <dl className="scenario-figures">
                  <dt>Aluguel</dt>
                  <dd>{formatEUR(p.rent)}</dd>
                  <dt>Custo total</dt>
                  <dd><RangeText r={c.total} /></dd>
                  <dt>Saldo</dt>
                  <dd className={c.balance && c.balance.min < 0 ? 'negative' : ''}><RangeText r={c.balance} /></dd>
                </dl>
                <div className="row">
                  {p.url && (
                    <a className="btn btn-sm" href={p.url} target="_blank" rel="noreferrer">
                      Ver anúncio
                    </a>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => { setEditing(p); setMessage(null) }}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                    Excluir
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selected.length === 1 && <p className="muted">Selecione pelo menos 2 imóveis para comparar.</p>}
      {compared.length >= 2 && (
        <PropertyCompare items={compared} costOf={costOf} slots={slots} locName={locName} />
      )}
    </div>
  )
}

function PropertyCompare({
  items,
  costOf,
  slots,
  locName,
}: {
  items: Property[]
  costOf(p: Property): HousingCost
  slots: Record<number, number>
  locName(p: Property): string
}) {
  const costs = new Map(items.map((p) => [p, costOf(p)]))
  const bestTotal = bestBy(items, (p) => costs.get(p)!.total?.max ?? null, 'min')
  const bestBalance = bestBy(items, (p) => costs.get(p)!.balance?.min ?? null, 'max')
  const rows: { label: string; cell(p: Property, c: HousingCost): ReactNode; best?: Set<Property> }[] = [
    { label: 'Tipo', cell: (p) => PROPERTY_TYPES[p.type] },
    { label: 'Localidade', cell: (p) => locName(p) },
    { label: 'Endereço', cell: (p) => p.address || NOT_AVAILABLE },
    { label: 'Aluguel (sua parte)', cell: (p) => formatEUR(p.rent) },
    { label: 'Depósito', cell: (p) => formatEUR(p.deposit) },
    { label: 'Contas', cell: (_p, c) => <PartText p={c.bills} itemLabel="do imóvel" /> },
    { label: 'Transporte', cell: (_p, c) => <PartText p={c.transport} itemLabel="do imóvel" /> },
    { label: 'Outras despesas', cell: (_p, c) => <>{formatEUR(c.other)} <span className="origin">das suas despesas</span></> },
    { label: 'Custo total mensal', best: bestTotal, cell: (_p, c) => <strong><RangeText r={c.total} /></strong> },
    { label: 'Líquido (com Rent Tax Credit)', cell: (_p, c) => (c.net ? formatEUR(c.net.atMinRent) : NOT_AVAILABLE) },
    { label: 'Saldo mensal', best: bestBalance, cell: (_p, c) => <RangeText r={c.balance} /> },
    { label: 'Economia mensal', cell: (_p, c) => <RangeText r={c.saving} /> },
    {
      label: 'De carro até Cork City',
      cell: (p) =>
        p.carRoute.value ? (
          <>
            {formatKm(p.carRoute.value.km)} · {Math.round(p.carRoute.value.minutes)} min
            <span className="origin">sem trânsito — OSRM, {formatDateTime(p.carRoute.date)}</span>
          </>
        ) : (
          NOT_AVAILABLE
        ),
    },
    {
      label: 'Transporte público',
      cell: (p) =>
        p.transitMinutes.value !== null
          ? `${Math.round(p.transitMinutes.value)} min (${p.transitMinutes.status === 'confirmado' ? 'confirmado' : 'estimado'})`
          : NOT_AVAILABLE,
    },
    { label: 'Moradores', cell: (p) => (p.residents ?? NOT_AVAILABLE) as ReactNode },
    { label: 'Data do anúncio', cell: (p) => (p.listedAt ? p.listedAt.split('-').reverse().join('/') : NOT_AVAILABLE) },
    { label: 'Observações', cell: (p) => p.notes || '—' },
  ]

  return (
    <section className="card compare">
      <h2>Comparação</h2>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              {items.map((p) => (
                <th key={p.id} className="num">
                  <span className="swatch" style={{ background: COMPARE_COLORS[slots[p.id!] ?? 0] }} aria-hidden="true" />
                  {p.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                {items.map((p) => (
                  <td key={p.id} className={`num${r.best?.has(p) ? ' best-cell' : ''}`}>
                    {r.cell(p, costs.get(p)!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="disclaimer">
        Fundo verde: menor custo total e maior saldo entre os imóveis com dado. Sem nota final. {ESTIMATE_DISCLAIMER}
      </p>
    </section>
  )
}

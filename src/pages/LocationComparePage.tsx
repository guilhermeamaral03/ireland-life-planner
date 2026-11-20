import { Loading } from '../components/Loading'
import { useEffect, useState, type ReactNode } from 'react'
import { useSafety } from '../app/useSafety'
import { SafetyBadge } from '../components/SafetyBadge'
import { SAFETY_LABELS, STATION_AREA_NOTE } from '../domain/safety'
import { db } from '../db/db'
import type { Location } from '../db/types'
import { bestBy, compareText, toggleCompare } from '../domain/compare'
import { formatEUR, formatKm, NOT_AVAILABLE } from '../domain/format'
import { haversineKm } from '../domain/geo'
import { normalizeLocation, propertiesByLocation, routesSummary, sortLocations, type LocationSort } from '../domain/locations'
import { savedText } from '../components/LocationSheet'
import { fillMissingRoutes } from '../db/routes'
import './LocationComparePage.css'

const DEP = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const

const rentRange = (r: { min: number; max: number } | null) =>
  r === null ? NOT_AVAILABLE : r.min === r.max ? formatEUR(r.min) : `${formatEUR(r.min)} – ${formatEUR(r.max)}`

interface Row {
  label: string
  cell(l: Location): ReactNode
  /** Texto para o resumo compartilhado (quando a célula não é texto simples). */
  text?(l: Location): string
  best?: Set<Location>
}

export function LocationComparePage() {
  const safety = useSafety()
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [warn, setWarn] = useState<string | null>(null)
  const [routeMsg, setRouteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [routing, setRouting] = useState(false)
  const [shareMsg, setShareMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sortBy, setSortBy] = useState<LocationSort>('nome')
  const [saved, setSaved] = useState<ReturnType<typeof propertiesByLocation>>(new Map())

  const load = () =>
    db.locations
      .toArray()
      .then((ls) =>
        setLocations(ls.map(normalizeLocation)),
      )
  useEffect(() => {
    load()
    db.properties
      .toArray()
      .then((ps) => setSaved(propertiesByLocation(ps)))
      .catch(() => setSaved(new Map()))
  }, [])

  const calcRoutes = async () => {
    setRouting(true)
    const r = await fillMissingRoutes()
    setRouting(false)
    setRouteMsg(r.ok ? { ok: true, text: routesSummary(r.filled, r.failed) } : { ok: false, text: r.reason })
    await load()
  }

  if (!locations) return <Loading />

  const reference = locations.find((l) => l.isReference)
  const chosen = selected.map((id) => locations.find((l) => l.id === id)!).filter(Boolean)
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = sortLocations(locations, sortBy).filter((l) => fold(l.name).includes(fold(query.trim())))

  const pick = (id: number) => {
    const r = toggleCompare(selected, id)
    setWarn(r.error)
    setSelected(r.selected)
  }

  const bestRent = bestBy(chosen, (l) => l.rentRange.value?.max ?? null, 'min')
  const bestCar = bestBy(chosen, (l) => (l.isReference ? null : (l.carRoute.value?.minutes ?? null)), 'min')

  const rows: Row[] = [
    {
      label: 'Aluguel',
      best: bestRent,
      text: (l) => rentRange(l.rentRange.value),
      cell: (l) => (
        <>
          {rentRange(l.rentRange.value)}
          {l.rentRange.source && <span className="origin">Fonte: {l.rentRange.source}</span>}
        </>
      ),
    },
    {
      label: 'Até Cork City (linha reta)',
      cell: (l) => (l.isReference ? 'Referência' : reference ? formatKm(haversineKm(l, reference)) : NOT_AVAILABLE),
    },
    {
      label: 'De carro (sem trânsito, OSRM)',
      best: bestCar,
      text: (l) =>
        l.isReference ? '—' : l.carRoute.value ? `${formatKm(l.carRoute.value.km)} · ${Math.round(l.carRoute.value.minutes)} min` : NOT_AVAILABLE,
      cell: (l) =>
        l.isReference ? '—' : l.carRoute.value ? `${formatKm(l.carRoute.value.km)} · ${Math.round(l.carRoute.value.minutes)} min` : (
            <button type="button" className="btn btn-sm" onClick={calcRoutes} disabled={routing}>
              {routing ? 'Calculando…' : 'Calcular rotas'}
            </button>
          ),
    },
    {
      label: 'Imóveis que você salvou',
      cell: (l) => savedText(saved.get(l.id!)),
    },
    {
      label: 'Transporte público',
      cell: (l) =>
        l.transitMinutes.value !== null
          ? `${Math.round(l.transitMinutes.value)} min (${l.transitMinutes.status === 'confirmado' ? 'confirmado' : 'estimado'})`
          : NOT_AVAILABLE,
    },
    { label: 'Dependência de carro', cell: (l) => (l.carDependency.value ? DEP[l.carDependency.value] : NOT_AVAILABLE) },
    { label: 'Transporte público (notas)', cell: (l) => l.publicTransport || NOT_AVAILABLE },
    { label: 'Infraestrutura', cell: (l) => l.infrastructure || NOT_AVAILABLE },
    { label: 'Serviços', cell: (l) => l.services || NOT_AVAILABLE },
    { label: 'Supermercados', cell: (l) => l.supermarkets || NOT_AVAILABLE },
    {
      label: 'Segurança (tendência)',
      text: (l) => SAFETY_LABELS[safety.classify(l).level],
      cell: (l) => {
        const r = safety.classify(l)
        return (
          <>
            <SafetyBadge level={r.level} />
            <span className="origin">{r.reason}</span>
          </>
        )
      },
    },
  ]

  const share = async () => {
    const text = compareText(
      chosen.map((l) => l.name),
      rows.map((r) => ({
        label: r.label,
        values: chosen.map((l) => {
          if (r.text) return r.text(l)
          const c = r.cell(l)
          return typeof c === 'string' ? c : NOT_AVAILABLE
        }),
        best: chosen.flatMap((l, i) => (r.best?.has(l) ? [i] : [])),
      })),
    )
    try {
      if (navigator.share) {
        await navigator.share({ text })
        setShareMsg(null)
      } else {
        await navigator.clipboard.writeText(text)
        setShareMsg({ ok: true, text: 'Resumo copiado — cole no WhatsApp ou onde quiser.' })
      }
    } catch (e) {
      // fechar a janela de compartilhar não é erro
      if (e instanceof DOMException && e.name === 'AbortError') return
      setShareMsg({ ok: false, text: 'Não foi possível compartilhar neste navegador.' })
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Comparador de localidades</h1>
        <p>Compare aluguel, acesso, segurança e estrutura de 2 a 4 localidades. Sem nota final — você decide o peso de cada critério.</p>
      </header>

      <section className="card">
        <div className="field">
          <label htmlFor="lc-search">Escolha as localidades</label>
          <input id="lc-search" className="input" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lc-sort">Ordenar por</label>
          <select id="lc-sort" className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as LocationSort)}>
            <option value="nome">Nome</option>
            <option value="tempo">Tempo de carro até Cork City</option>
          </select>
        </div>
        {warn && <div className="alert alert-warning">{warn}</div>}
        <ul className="lc-pick">
          {list.map((l) => (
            <li key={l.id}>
              <label className="check">
                <input type="checkbox" checked={selected.includes(l.id!)} onChange={() => pick(l.id!)} />
                {l.name}
                {!l.isReference && l.carRoute.value && <span className="muted"> · {Math.round(l.carRoute.value.minutes)} min</span>}
                {l.rentRange.value ? '' : <span className="muted"> · sem aluguel</span>}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {chosen.length < 2 ? (
        <p className="muted">Selecione pelo menos 2 localidades.</p>
      ) : (
        <section className="card">
          {routeMsg && (
            <div className={`alert ${routeMsg.ok ? 'alert-success' : 'alert-error'}`} role="status">
              {routeMsg.text}
            </div>
          )}
          <div className="table-wrap">
            <table className="lc-table">
              <thead>
                <tr>
                  <th />
                  {chosen.map((l) => (
                    <th key={l.id}>{l.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {chosen.map((l) => (
                      <td key={l.id} className={r.best?.has(l) ? 'best-cell' : ''}>
                        {r.cell(l)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn btn-primary" onClick={share}>
              Enviar comparação
            </button>
            <span className="muted">Resumo em texto, pronto para o WhatsApp.</span>
          </div>
          {shareMsg && (
            <div className={`alert ${shareMsg.ok ? 'alert-success' : 'alert-error'}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
              {shareMsg.text}
            </div>
          )}
          <p className="disclaimer">
            Fundo verde: melhor da linha entre as localidades com dado (menor aluguel máximo, menor tempo de carro).
            Segurança: avaliação do app sobre a tendência da estação, não estatística oficial; {STATION_AREA_NOTE.toLowerCase()}
          </p>
        </section>
      )}
    </div>
  )
}

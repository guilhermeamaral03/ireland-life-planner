import { Loading } from '../components/Loading'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useSafety } from '../app/useSafety'
import { LocationSheet } from '../components/LocationSheet'
import { db } from '../db/db'
import type { Location } from '../db/types'
import { formatKm } from '../domain/format'
import { haversineKm } from '../domain/geo'
import { filterLocations, newLocation, normalizeLocation } from '../domain/locations'
import { fetchCarRoute, routeToSourced } from '../services/osrm'
import './MapPage.css'

type RouteStatus = 'idle' | 'loading' | { error: string }
const CORK: [number, number] = [51.9, -8.47]

export function MapPage() {
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ favorites: false, withRent: false, query: '' })
  const [withSafety, setWithSafety] = useState(false)
  const safety = useSafety()
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [tilesFailed, setTilesFailed] = useState(false)
  const [routeStatus, setRouteStatus] = useState<Record<number, RouteStatus>>({})
  const [message, setMessage] = useState<string | null>(null)
  const attempted = useRef(new Set<number>())

  const load = useCallback(async () => setLocations((await db.locations.orderBy('id').toArray()).map(normalizeLocation)), [])
  useEffect(() => {
    load()
  }, [load])

  const reference = locations?.find((l) => l.isReference)
  const selected = locations?.find((l) => l.id === selectedId) ?? null
  useEffect(() => {
    if (selectedId !== null) setMessage(null)
  }, [selectedId])
  const visible = useMemo(
    () =>
      locations
        ? filterLocations(locations, filters)
            .filter((l) => !withSafety || safety.classify(l).level !== 'insuficiente')
            .sort(
            (a, b) => Number(b.isReference) - Number(a.isReference) || a.name.localeCompare(b.name, 'pt-BR'),
          )
        : [],
    [locations, filters, withSafety, safety],
  )

  const latestRouteReq = useRef(new Map<number, number>())
  const recalc = useCallback(
    async (l: Location) => {
      if (!reference || l.isReference || l.id === undefined) return
      // só a consulta mais recente de cada localidade pode gravar (evita rota da posição antiga)
      const req = (latestRouteReq.current.get(l.id) ?? 0) + 1
      latestRouteReq.current.set(l.id, req)
      setRouteStatus((s) => ({ ...s, [l.id!]: 'loading' }))
      const r = await fetchCarRoute(l, reference)
      if (latestRouteReq.current.get(l.id) !== req) return
      if (r.ok) {
        try {
          await db.locations.update(l.id, { carRoute: routeToSourced(r, new Date().toISOString()) })
          setRouteStatus((s) => ({ ...s, [l.id!]: 'idle' }))
          await load()
        } catch (e) {
          setRouteStatus((s) => ({ ...s, [l.id!]: { error: `Não foi possível salvar a rota: ${e instanceof Error ? e.message : String(e)}` } }))
        }
      } else {
        setRouteStatus((s) => ({ ...s, [l.id!]: { error: r.reason } }))
      }
    },
    [reference, load],
  )

  // primeira vez que uma localidade sem rota é aberta: consulta o OSRM uma vez
  useEffect(() => {
    if (selected?.id !== undefined && !selected.isReference && !selected.carRoute.value && !attempted.current.has(selected.id)) {
      attempted.current.add(selected.id)
      recalc(selected)
    }
  }, [selected, recalc])

  if (!locations) return <Loading />

  const save = async (l: Location) => {
    const before = locations.find((x) => x.id === l.id)
    await db.locations.put(l)
    await load()
    if (before && (before.lat !== l.lat || before.lng !== l.lng)) recalc(l)
  }

  const remove = async (l: Location) => {
    await db.locations.delete(l.id!)
    setSelectedId(null)
    setMessage(`"${l.name}" excluída.`)
    await load()
  }

  const confirmAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!pending || !newName.trim()) return
    const id = (await db.locations.add(newLocation(newName, pending.lat, pending.lng))) as number
    setPending(null)
    setNewName('')
    setAdding(false)
    await load()
    setSelectedId(id) // o efeito acima consulta a rota de carro
  }

  return (
    <div className="page page-wide">
      <header className="page-header">
        <h1>Mapa de Cork</h1>
        <p>Localidades do County Cork, distância até Cork City e informações que você reunir.</p>
      </header>
      {message && <div className="alert alert-success" role="status">{message}</div>}

      <div className="map-layout">
        <div className="map-col">
          <div className="row map-toolbar">
            <button
              type="button"
              className={`btn${adding ? ' btn-primary' : ''}`}
              onClick={() => {
                setAdding(!adding)
                setPending(null)
              }}
            >
              {adding ? 'Cancelar' : 'Adicionar localidade'}
            </button>
            {adding && !pending && <span className="muted">Clique no mapa no ponto da nova localidade.</span>}
          </div>
          {pending && (
            <form className="card add-form" onSubmit={confirmAdd}>
              <div className="field">
                <label htmlFor="new-loc">Nome da localidade</label>
                <input id="new-loc" className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="row">
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
                  Adicionar
                </button>
                <button type="button" className="btn" onClick={() => setPending(null)}>
                  Escolher outro ponto
                </button>
              </div>
            </form>
          )}
          {tilesFailed && (
            <div className="alert alert-warning">
              Mapa indisponível sem internet. Os dados das localidades continuam acessíveis na lista.
            </div>
          )}
          <div className={`map-box${adding ? ' adding' : ''}`}>
            <MapContainer
              {...(locations.length > 1
                ? { bounds: locations.map((l) => [l.lat, l.lng] as [number, number]), boundsOptions: { padding: [30, 30] } }
                : { center: CORK, zoom: 10 })}
              scrollWheelZoom
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }}
              />
              <ClickToAdd active={adding} onPick={(p) => setPending(p)} />
              <FlyTo target={selected} />
              {visible.map((l) => (
                <CircleMarker
                  key={l.id}
                  center={[l.lat, l.lng]}
                  radius={l.isReference ? 8 : 6}
                  pathOptions={{
                    color: l.id === selectedId ? '#1d1d1a' : '#1F4D3A',
                    weight: l.id === selectedId ? 4 : 2,
                    fillColor: l.favorite || l.isReference ? '#1f8a5a' : '#ffffff',
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => !adding && setSelectedId(l.id!) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    {l.name}
                  </Tooltip>
                </CircleMarker>
              ))}
              {pending && (
                <CircleMarker center={[pending.lat, pending.lng]} radius={8} pathOptions={{ color: '#b3261e', weight: 3, fillOpacity: 0.3 }} />
              )}
            </MapContainer>
          </div>
          <p className="disclaimer">Preenchido = favorita (ou Cork City, a referência). Vazio = demais localidades.</p>
        </div>

        <aside className="side-col">
          <section className="card loc-list">
            <div className="field">
              <label htmlFor="loc-search">Buscar</label>
              <input
                id="loc-search"
                className="input"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
            </div>
            <div className="row">
              <label className="check">
                <input type="checkbox" checked={filters.favorites} onChange={(e) => setFilters({ ...filters, favorites: e.target.checked })} />
                Favoritas
              </label>
              <label className="check">
                <input type="checkbox" checked={filters.withRent} onChange={(e) => setFilters({ ...filters, withRent: e.target.checked })} />
                Com aluguel informado
              </label>
              <label className="check">
                <input type="checkbox" checked={withSafety} onChange={(e) => setWithSafety(e.target.checked)} />
                Com dados de segurança
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="muted">Nenhuma localidade com esses filtros.</p>
            ) : (
              <ul>
                {visible.map((l) => (
                  <li key={l.id}>
                    <button type="button" className={`loc-item${l.id === selectedId ? ' active' : ''}`} onClick={() => setSelectedId(l.id!)}>
                      <span>
                        {l.favorite ? '★ ' : ''}
                        {l.name}
                      </span>
                      <span className="muted">
                        {l.isReference ? 'referência' : reference ? `${formatKm(haversineKm(l, reference))} em linha reta` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selected ? (
            <LocationSheet
              location={selected}
              reference={reference}
              routeStatus={routeStatus[selected.id!] ?? 'idle'}
              onSave={save}
              onDelete={remove}
              onRecalc={recalc}
              safety={safety.classify(selected)}
            />
          ) : (
            <section className="card">
              <p className="muted">Selecione uma localidade no mapa ou na lista para ver a ficha.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ClickToAdd({ active, onPick }: { active: boolean; onPick(p: { lat: number; lng: number }): void }) {
  useMapEvents({
    click(e) {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function FlyTo({ target }: { target: Location | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.panTo([target.lat, target.lng])
  }, [map, target?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

import type { Route, Sourced } from '../db/types'
import type { LatLng } from '../domain/geo'

/** Servidor público de demonstração do OSRM (dados OpenStreetMap). Só coordenadas são enviadas. */
export const OSRM_SOURCE = 'https://router.project-osrm.org'

export type CarRouteResult = { ok: true; km: number; minutes: number } | { ok: false; reason: string }

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>

const UNAVAILABLE = 'Serviço de rotas indisponível (sem internet ou fora do ar).'

export async function fetchCarRoute(
  from: LatLng,
  to: LatLng,
  fetchFn: FetchFn = fetch,
  timeoutMs = 10_000,
): Promise<CarRouteResult> {
  const url = `${OSRM_SOURCE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchFn(url, { signal: ctrl.signal })
    // o OSRM responde "sem rota" com HTTP 400 e um code no corpo
    const body = ((await res.json().catch(() => ({}))) ?? {}) as { code?: string; routes?: { distance: number; duration: number }[] }
    if (!res.ok && !body.code) return { ok: false, reason: UNAVAILABLE }
    const route = body.code === 'Ok' ? body.routes?.[0] : undefined
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      return { ok: false, reason: 'Rota não encontrada.' }
    }
    return { ok: true, km: route.distance / 1000, minutes: route.duration / 60 }
  } catch {
    return { ok: false, reason: UNAVAILABLE }
  } finally {
    clearTimeout(timer)
  }
}

export type CarTableResult = { ok: true; routes: (Route | null)[] } | { ok: false; reason: string }

/**
 * Tempo/distância de várias origens até um destino numa única consulta (serviço "table" do OSRM).
 * Resultado na mesma ordem de `points`; origem sem rota vira null.
 */
export async function fetchCarTable(
  points: LatLng[],
  to: LatLng,
  fetchFn: FetchFn = fetch,
  timeoutMs = 15_000,
): Promise<CarTableResult> {
  if (points.length === 0) return { ok: true, routes: [] }
  const coords = [to, ...points].map((p) => `${p.lng},${p.lat}`).join(';')
  const sources = points.map((_, i) => i + 1).join(';')
  const url = `${OSRM_SOURCE}/table/v1/driving/${coords}?sources=${sources}&destinations=0&annotations=duration,distance`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchFn(url, { signal: ctrl.signal })
    const body = ((await res.json().catch(() => ({}))) ?? {}) as {
      code?: string
      durations?: (number | null)[][]
      distances?: (number | null)[][]
    }
    if (body.code !== 'Ok' || !body.durations || !body.distances) {
      return { ok: false, reason: !res.ok && !body.code ? UNAVAILABLE : 'Rota não encontrada.' }
    }
    const routes = points.map((_, i) => {
      const s = body.durations?.[i]?.[0]
      const m = body.distances?.[i]?.[0]
      return typeof s === 'number' && typeof m === 'number' && Number.isFinite(s) && Number.isFinite(m)
        ? { km: m / 1000, minutes: s / 60 }
        : null
    })
    return { ok: true, routes }
  } catch {
    return { ok: false, reason: UNAVAILABLE }
  } finally {
    clearTimeout(timer)
  }
}

export function routeToSourced(r: CarRouteResult, date: string): Sourced<Route> {
  return r.ok
    ? { value: { km: r.km, minutes: r.minutes }, source: OSRM_SOURCE, date, status: 'estimado' }
    : { value: null, source: null, date: null }
}

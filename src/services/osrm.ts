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

export function routeToSourced(r: CarRouteResult, date: string): Sourced<Route> {
  return r.ok
    ? { value: { km: r.km, minutes: r.minutes }, source: OSRM_SOURCE, date, status: 'estimado' }
    : { value: null, source: null, date: null }
}

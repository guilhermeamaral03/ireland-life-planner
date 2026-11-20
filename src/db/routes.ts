import { normalizeLocation } from '../domain/locations'
import { fetchCarTable, routeToSourced } from '../services/osrm'
import { db } from './db'

export type FillRoutesResult = { ok: true; filled: number; failed: string[] } | { ok: false; reason: string }

/**
 * Calcula de uma vez (uma consulta ao OSRM) a rota de carro até a referência
 * de todas as localidades que ainda não têm. Quem já tem rota não é alterado.
 */
export async function fillMissingRoutes(
  fetchFn?: Parameters<typeof fetchCarTable>[2],
  date = new Date().toISOString(),
): Promise<FillRoutesResult> {
  const all = (await db.locations.toArray()).map(normalizeLocation)
  const reference = all.find((l) => l.isReference)
  if (!reference) return { ok: false, reason: 'Sem localidade de referência (Cork City).' }
  const missing = all.filter((l) => !l.isReference && !l.carRoute.value && l.id !== undefined)
  if (missing.length === 0) return { ok: true, filled: 0, failed: [] }

  const r = await fetchCarTable(missing, reference, fetchFn)
  if (!r.ok) return r

  const failed: string[] = []
  let filled = 0
  await db.transaction('rw', db.locations, async () => {
    for (const [i, l] of missing.entries()) {
      const route = r.routes[i]
      if (!route) {
        failed.push(l.name)
        continue
      }
      // relê: se a posição mudou ou já ganhou rota enquanto consultávamos, não grava
      const cur = await db.locations.get(l.id!)
      if (!cur || cur.lat !== l.lat || cur.lng !== l.lng || cur.carRoute?.value) continue
      await db.locations.update(l.id!, { carRoute: routeToSourced({ ok: true, ...route }, date) })
      filled++
    }
  })
  return { ok: true, filled, failed }
}

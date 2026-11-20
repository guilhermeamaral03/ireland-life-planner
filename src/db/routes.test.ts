import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ensureSeeded } from './db'
import { fillMissingRoutes } from './routes'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
})

const tableFor = (n: number, nullAt = -1) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: 'Ok',
      durations: Array.from({ length: n }, (_, i) => [i === nullAt ? null : 600 + i]),
      distances: Array.from({ length: n }, (_, i) => [i === nullAt ? null : 5000 + i]),
    }),
  })

describe('fillMissingRoutes', () => {
  it('uma consulta para todas as localidades sem rota (menos a referência) e grava estimado OSRM', async () => {
    const missing = (await db.locations.toArray()).filter((l) => !l.isReference && !l.carRoute.value)
    const f = tableFor(missing.length)
    const r = await fillMissingRoutes(f, '2026-11-20')
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: true, filled: missing.length, failed: [] })
    const after = await db.locations.toArray()
    expect(after.filter((l) => !l.isReference).every((l) => l.carRoute.value && l.carRoute.status === 'estimado')).toBe(true)
    expect(after.find((l) => l.isReference)!.carRoute.value).toBeNull()
  })
  it('não refaz quem já tem rota', async () => {
    const first = (await db.locations.toArray()).find((l) => !l.isReference)!
    await db.locations.update(first.id!, { carRoute: { value: { km: 1, minutes: 1 }, source: 'x', date: 'd', status: 'estimado' } })
    const missing = (await db.locations.toArray()).filter((l) => !l.isReference && !l.carRoute.value)
    const f = tableFor(missing.length)
    await fillMissingRoutes(f, '2026-11-20')
    expect((await db.locations.get(first.id!))!.carRoute.value).toEqual({ km: 1, minutes: 1 })
  })
  it('localidade sem rota fica na lista de falhas', async () => {
    const missing = (await db.locations.toArray()).filter((l) => !l.isReference && !l.carRoute.value)
    const r = await fillMissingRoutes(tableFor(missing.length, 0), '2026-11-20')
    expect(r.ok && r.failed).toEqual([missing[0].name])
  })
  it('nada faltando → nenhuma consulta', async () => {
    const f = tableFor(0)
    await fillMissingRoutes(tableFor(99), '2026-11-20')
    expect(await fillMissingRoutes(f, '2026-11-20')).toEqual({ ok: true, filled: 0, failed: [] })
    expect(f).not.toHaveBeenCalled()
  })
  it('serviço fora do ar → motivo, nada gravado', async () => {
    const r = await fillMissingRoutes(vi.fn().mockRejectedValue(new TypeError('x')), '2026-11-20')
    expect(r.ok).toBe(false)
    expect((await db.locations.toArray()).every((l) => !l.carRoute.value)).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fetchCarRoute, fetchCarTable, OSRM_SOURCE, routeToSourced } from './osrm'

const from = { lat: 51.8882643, lng: -8.5918414 }
const to = { lat: 51.8985136, lng: -8.4726423 }
const respond = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body })

describe('fetchCarRoute', () => {
  it('converte metros/segundos em km/minutos e usa lng,lat na URL', async () => {
    const f = respond({ code: 'Ok', routes: [{ distance: 9270.4, duration: 830.6 }] })
    const r = await fetchCarRoute(from, to, f)
    expect(r).toEqual({ ok: true, km: expect.closeTo(9.2704, 4), minutes: expect.closeTo(13.843, 3) })
    expect(f.mock.calls[0][0]).toBe(`${OSRM_SOURCE}/route/v1/driving/-8.5918414,51.8882643;-8.4726423,51.8985136?overview=false`)
  })

  it('sem rota', async () => {
    expect(await fetchCarRoute(from, to, respond({ code: 'NoRoute', routes: [] }))).toEqual({
      ok: false,
      reason: 'Rota não encontrada.',
    })
  })

  it('erro de rede', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await fetchCarRoute(from, to, f)).toEqual({
      ok: false,
      reason: 'Serviço de rotas indisponível (sem internet ou fora do ar).',
    })
  })

  it('"sem rota" do OSRM vem como HTTP 400 com code', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: 'NoRoute' }) })
    expect(await fetchCarRoute(from, to, f)).toEqual({ ok: false, reason: 'Rota não encontrada.' })
  })

  it('HTTP com erro', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    expect((await fetchCarRoute(from, to, f)).ok).toBe(false)
  })
})

describe('routeToSourced', () => {
  it('rota ok → estimado com fonte e data; falha → vazio', () => {
    expect(routeToSourced({ ok: true, km: 9.27, minutes: 13.8 }, '2026-11-19')).toEqual({
      value: { km: 9.27, minutes: 13.8 },
      source: OSRM_SOURCE,
      date: '2026-11-19',
      status: 'estimado',
    })
    expect(routeToSourced({ ok: false, reason: 'x' }, '2026-11-19').value).toBeNull()
  })
})

describe('fetchCarTable (várias localidades numa consulta)', () => {
  const cork = { lat: 51.8985136, lng: -8.4726423 }
  const pts = [
    { lat: 51.8882643, lng: -8.5918414 },
    { lat: 51.8502284, lng: -8.2950649 },
  ]
  it('uma consulta, destino Cork, resultados na ordem das origens', async () => {
    const f = respond({ code: 'Ok', durations: [[830.6], [1578.2]], distances: [[9270.4], [22493.1]] })
    const r = await fetchCarTable(pts, cork, f)
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toBe(
      `${OSRM_SOURCE}/table/v1/driving/-8.4726423,51.8985136;-8.5918414,51.8882643;-8.2950649,51.8502284?sources=1;2&destinations=0&annotations=duration,distance`,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.routes[0]).toEqual({ km: expect.closeTo(9.2704, 4), minutes: expect.closeTo(13.843, 3) })
      expect(r.routes[1]?.km).toBeCloseTo(22.4931, 4)
    }
  })
  it('origem sem rota (null) vira null, as outras continuam', async () => {
    const r = await fetchCarTable(pts, cork, respond({ code: 'Ok', durations: [[null], [1578.2]], distances: [[null], [22493.1]] }))
    expect(r.ok && r.routes[0]).toBeNull()
    expect(r.ok && r.routes[1]?.minutes).toBeCloseTo(26.3, 1)
  })
  it('sem internet → mensagem', async () => {
    const r = await fetchCarTable(pts, cork, vi.fn().mockRejectedValue(new TypeError('x')))
    expect(r).toEqual({ ok: false, reason: 'Serviço de rotas indisponível (sem internet ou fora do ar).' })
  })
  it('lista vazia → nada a consultar', async () => {
    const f = vi.fn()
    expect(await fetchCarTable([], cork, f)).toEqual({ ok: true, routes: [] })
    expect(f).not.toHaveBeenCalled()
  })
})

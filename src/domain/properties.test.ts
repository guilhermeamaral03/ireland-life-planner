import { describe, expect, it } from 'vitest'
import type { Property } from '../db/types'
import { emptyProperty, prepareProperty, validateProperty } from './properties'

const ok: Property = { ...emptyProperty(), title: 'Quarto em Douglas', rent: 850 }

describe('validateProperty', () => {
  it('válido', () => {
    expect(validateProperty(ok)).toBeNull()
    expect(validateProperty({ ...ok, url: 'https://www.daft.ie/x', lat: 51.87, lng: -8.43 })).toBeNull()
  })
  it('título e aluguel', () => {
    expect(validateProperty({ ...ok, title: '  ' })).toBe('Informe o título do anúncio.')
    expect(validateProperty({ ...ok, rent: 0 })).toBe('Informe o aluguel mensal (a sua parte).')
  })
  it('valores negativos', () => {
    expect(validateProperty({ ...ok, deposit: -1 })).toBe('Valores não podem ser negativos.')
    expect(validateProperty({ ...ok, billsMonthly: -5 })).toBe('Valores não podem ser negativos.')
  })
  it('posição: as duas coordenadas e válidas', () => {
    expect(validateProperty({ ...ok, lat: 51.87 })).toBe('Informe latitude e longitude (ou deixe as duas vazias).')
    expect(validateProperty({ ...ok, lat: 99, lng: -8 })).toMatch(/^Coordenadas inválidas/)
  })
  it('link precisa ser http(s)', () => {
    expect(validateProperty({ ...ok, url: 'ftp://x' })).toBe('O link deve começar com http:// ou https://.')
  })
})

describe('prepareProperty', () => {
  const route = { value: { km: 7, minutes: 9 }, source: 'x', date: 'd', status: 'estimado' as const }
  it('mover a posição apaga a rota antiga; tirar a posição também', () => {
    const cur = { ...ok, lat: 51.87, lng: -8.43, carRoute: route }
    expect(prepareProperty(cur, { ...cur, notes: 'x' }).carRoute).toEqual(route)
    expect(prepareProperty(cur, { ...cur, lat: 51.88 }).carRoute.value).toBeNull()
    expect(prepareProperty(cur, { ...cur, lat: null, lng: null }).carRoute.value).toBeNull()
  })
})

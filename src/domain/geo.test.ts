import { describe, expect, it } from 'vitest'
import { haversineKm, validCoords } from './geo'

const cork = { lat: 51.8985136, lng: -8.4726423 }

describe('haversineKm', () => {
  it('distância em linha reta até Cork City', () => {
    expect(haversineKm({ lat: 51.8882643, lng: -8.5918414 }, cork)).toBeCloseTo(8.259, 2) // Ballincollig
    expect(haversineKm({ lat: 51.7461712, lng: -8.7369303 }, cork)).toBeCloseTo(24.837, 2) // Bandon
    expect(haversineKm(cork, cork)).toBe(0)
  })
})

describe('validCoords', () => {
  it('aceita só latitude/longitude válidas', () => {
    expect(validCoords(51.9, -8.5)).toBe(true)
    expect(validCoords(91, 0)).toBe(false)
    expect(validCoords(0, -181)).toBe(false)
    expect(validCoords(NaN, 0)).toBe(false)
  })
})

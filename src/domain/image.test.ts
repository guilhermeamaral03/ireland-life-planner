import { describe, expect, it } from 'vitest'
import { initials, squareCrop } from './image'

describe('squareCrop', () => {
  it('recorte central em quadrado', () => {
    expect(squareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000 })
    expect(squareCrop(300, 600)).toEqual({ sx: 0, sy: 150, side: 300 })
    expect(squareCrop(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 })
  })
})

describe('initials', () => {
  it('iniciais do nome para o avatar sem foto', () => {
    expect(initials('Guilherme Amaral')).toBe('GA')
    expect(initials('  ana  ')).toBe('A')
    expect(initials('Maria da Silva Souza')).toBe('MS')
    expect(initials('')).toBe('')
  })
})

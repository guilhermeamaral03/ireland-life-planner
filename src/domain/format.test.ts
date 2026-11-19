import { describe, expect, it } from 'vitest'
import { formatDateTime, formatEUR, formatKm } from './format'

const norm = (s: string) => s.replace(/\s/g, ' ')

describe('formatEUR', () => {
  it('formata em euros no padrão pt-BR', () => {
    expect(norm(formatEUR(1234.5))).toBe('€ 1.234,50')
  })
  it('mostra "Não disponível" para valores ausentes', () => {
    expect(formatEUR(null)).toBe('Não disponível')
    expect(formatEUR(undefined)).toBe('Não disponível')
    expect(formatEUR(NaN)).toBe('Não disponível')
  })
})

describe('formatDateTime', () => {
  it('formata data ISO válida', () => {
    expect(formatDateTime('2026-11-19T12:00:00Z')).toMatch(/19\/11\/2026/)
  })
  it('mostra "Não disponível" para datas inválidas ou ausentes, sem lançar erro', () => {
    expect(formatDateTime('abc')).toBe('Não disponível')
    expect(formatDateTime(null)).toBe('Não disponível')
    expect(formatDateTime('')).toBe('Não disponível')
  })
})

describe('formatKm', () => {
  it('formata com 1 casa decimal', () => {
    expect(norm(formatKm(12.34))).toBe('12,3 km')
  })
  it('mostra "Não disponível" para valores ausentes', () => {
    expect(formatKm(undefined)).toBe('Não disponível')
    expect(formatKm(null)).toBe('Não disponível')
  })
})

import { describe, expect, it } from 'vitest'
import { getTaxRules, TAX_YEARS } from './index'

/** Percorre o objeto e devolve todos os nós com formato de Param. */
function collectParams(obj: unknown, path = ''): { path: string; p: { value: unknown; status: string; source: string } }[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return []
  const o = obj as Record<string, unknown>
  if ('status' in o && 'source' in o && 'value' in o) {
    return [{ path, p: o as { value: unknown; status: string; source: string } }]
  }
  return Object.entries(o).flatMap(([k, v]) => collectParams(v, `${path}.${k}`))
}

describe('regras fiscais', () => {
  it('2026 e 2027 disponíveis', () => {
    expect(TAX_YEARS).toEqual([2026, 2027])
    expect(getTaxRules(2030)).toBeNull()
  })

  it('faixa de 20% para solteiro', () => {
    expect(getTaxRules(2026)!.incomeTax.bands.solteiro.value).toBe(44000)
    expect(getTaxRules(2027)!.incomeTax.bands.solteiro.value).toBe(46500)
  })

  it('faixa de 2% do USC', () => {
    expect(getTaxRules(2026)!.usc.bands.value).toContainEqual({ upTo: 28700, rate: 0.02 })
    expect(getTaxRules(2027)!.usc.bands.value).toContainEqual({ upTo: 30300, rate: 0.02 })
  })

  it('casados em 2027 não disponíveis', () => {
    const r = getTaxRules(2027)!
    expect(r.incomeTax.bands.casado_uma_renda.status).toBe('nao_disponivel')
    expect(r.incomeTax.bands.casado_uma_renda.value).toBeNull()
    expect(r.status).toBe('proposto')
    expect(getTaxRules(2026)!.status).toBe('oficial')
  })

  it.each(TAX_YEARS)('%i: todo parâmetro disponível tem valor e fonte https', (year) => {
    const params = collectParams(getTaxRules(year))
    expect(params.length).toBeGreaterThan(15)
    for (const { path, p } of params) {
      expect(['oficial', 'proposto', 'nao_disponivel'], path).toContain(p.status)
      expect(p.source, path).toMatch(/^https:\/\//)
      if (p.status !== 'nao_disponivel') expect(p.value, path).not.toBeNull()
      else expect(p.value, path).toBeNull()
    }
  })
})

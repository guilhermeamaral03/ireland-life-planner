import { describe, expect, it } from 'vitest'
import { getTaxRules } from '../data/tax'
import { calcNetPay, type TaxInput, type TaxResult } from './tax'

const base: TaxInput = {
  grossAnnual: 50000,
  status: 'solteiro',
  spouseGrossAnnual: null,
  annualRent: 0,
  uscReducedRate: false,
  extraCredits: 0,
}

function calc(year: number, input: Partial<TaxInput>): TaxResult {
  const r = calcNetPay({ ...base, ...input }, getTaxRules(year)!)
  if (!r.ok) throw new Error(`esperava ok, veio: ${r.reason}`)
  return r
}

/** Garante que nenhum número do resultado é NaN/Infinity. */
function assertFinite(obj: unknown, path = 'r'): void {
  if (typeof obj === 'number') expect(Number.isFinite(obj), path).toBe(true)
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) assertFinite(v, `${path}.${k}`)
  }
}

// Valores esperados calculados à mão a partir das regras oficiais (spec §13).
describe('calcNetPay — 2026', () => {
  it('solteiro €50.000', () => {
    const r = calc(2026, {})
    expect(r.incomeTax.grossTax).toBeCloseTo(11200, 2)
    expect(r.incomeTax.total).toBeCloseTo(7200, 2)
    expect(r.usc.total).toBeCloseTo(1032.82, 2)
    expect(r.prsi.total).toBeCloseTo(2118.9, 1)
    expect(r.netAnnual).toBeCloseTo(39648.28, 1)
    expect(r.netMonthly).toBeCloseTo(39648.28 / 12, 1)
    expect(r.rulesStatus).toBe('oficial')
  })

  it('USC: isento até €13.000; acima disso, sobre a renda toda', () => {
    const at = calc(2026, { grossAnnual: 13000 })
    expect(at.usc.total).toBe(0)
    expect(at.usc.exempt).toBe(true)
    const above = calc(2026, { grossAnnual: 13001 })
    expect(above.usc.total).toBeCloseTo(79.84, 2)
    expect(above.incomeTax.total).toBe(0) // créditos maiores que o imposto: nunca negativo
    expect(above.prsi.total).toBe(0) // €250/semana ≤ €352
  })

  it('PRSI com crédito reduzido (€377/semana)', () => {
    const r = calc(2026, { grossAnnual: 377 * 52 })
    expect(r.prsi.weeklyCredit).toBeCloseTo(7.835, 3)
    expect(r.prsi.total).toBeCloseTo(423.36, 1)
    expect(r.prsi.periods).toHaveLength(2)
    expect(r.prsi.periods[0].days).toBe(273)
    expect(r.prsi.periods[1].days).toBe(92)
  })

  it('PRSI: exatamente €352/semana é isento', () => {
    expect(calc(2026, { grossAnnual: 352 * 52 }).prsi.total).toBe(0)
  })

  it('pai/mãe solteiro €50.000', () => {
    const r = calc(2026, { status: 'pai_mae_solteiro' })
    expect(r.incomeTax.band).toBe(48000)
    expect(r.incomeTax.total).toBeCloseTo(4500, 2)
  })

  it('USC reduzida só até o limite de €60.000', () => {
    const r = calc(2026, { grossAnnual: 30000, uscReducedRate: true })
    expect(r.usc.reduced).toBe(true)
    expect(r.usc.total).toBeCloseTo(419.82, 2)
    expect(calc(2026, { grossAnnual: 61000, uscReducedRate: true }).usc.reduced).toBe(false)
  })

  it('casado, duas rendas: imposto do casal alocado proporcionalmente', () => {
    const r = calc(2026, { grossAnnual: 60000, status: 'casado_duas_rendas', spouseGrossAnnual: 20000 })
    expect(r.incomeTax.band).toBe(73000)
    expect(r.incomeTax.coupleTotal).toBeCloseTo(9400, 2)
    expect(r.incomeTax.total).toBeCloseTo(7050, 2)
    expect(r.usc.total).toBeCloseTo(1332.82, 2)
    expect(r.prsi.total).toBeCloseTo(2542.68, 1)
  })

  it('casado, uma renda', () => {
    const r = calc(2026, { status: 'casado_uma_renda' })
    expect(r.incomeTax.band).toBe(53000)
    // 50000×20% − (4000 + 2000)
    expect(r.incomeTax.total).toBeCloseTo(4000, 2)
  })

  it('crédito de empregado limitado a 20% da renda PAYE de cada um', () => {
    // band 53000 + 5000 = 58000; imposto 11600 + 2800 = 14400
    // créditos: casado 4000 + empregado 2000 (você) + 1000 (cônjuge: 20% de 5000) = 7000 → 7400
    const r = calc(2026, { grossAnnual: 60000, status: 'casado_duas_rendas', spouseGrossAnnual: 5000 })
    expect(r.incomeTax.coupleTotal).toBeCloseTo(7400, 2)
    expect(r.incomeTax.total).toBeCloseTo(7400 * (60000 / 65000), 2)
    const low = calc(2026, { grossAnnual: 5000 })
    expect(low.incomeTax.credits.find((c) => c.label.startsWith('Crédito de empregado'))?.amount).toBeCloseTo(1000, 2)
  })

  it('casado, duas rendas sem renda do cônjuge → indisponível', () => {
    const r = calcNetPay({ ...base, status: 'casado_duas_rendas' }, getTaxRules(2026)!)
    expect(r).toEqual({ ok: false, reason: 'Informe a renda do cônjuge.' })
  })

  it('Rent Tax Credit limitado ao imposto devido', () => {
    const r = calc(2026, { grossAnnual: 21000, annualRent: 12000 })
    expect(r.incomeTax.grossTax).toBeCloseTo(4200, 2)
    expect(r.incomeTax.rentCredit).toBeCloseTo(200, 2)
    expect(r.incomeTax.total).toBe(0)
  })

  it('créditos extras reduzem o imposto', () => {
    expect(calc(2026, { extraCredits: 500 }).incomeTax.total).toBeCloseTo(6700, 2)
  })

  it('salário 0 não gera NaN', () => {
    const r = calc(2026, { grossAnnual: 0 })
    expect(r.netAnnual).toBe(0)
    expect(r.effectiveRate).toBe(0)
    assertFinite(r)
  })
})

describe('calcNetPay — 2027 (proposto)', () => {
  it('solteiro €50.000 pagando €1.500/mês de aluguel', () => {
    const r = calc(2027, { annualRent: 18000 })
    expect(r.incomeTax.grossTax).toBeCloseTo(10700, 2)
    expect(r.incomeTax.rentCredit).toBeCloseTo(1150, 2)
    expect(r.incomeTax.total).toBeCloseTo(5300, 2)
    expect(r.usc.total).toBeCloseTo(1016.82, 2)
    expect(r.prsi.total).toBeCloseTo(2175, 1)
    expect(r.netAnnual).toBeCloseTo(41508.18, 1)
    expect(r.rulesStatus).toBe('proposto')
  })

  it('casado em 2027 → parâmetros não publicados', () => {
    const r = calcNetPay({ ...base, status: 'casado_uma_renda' }, getTaxRules(2027)!)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('ainda não foram publicados')
  })
})

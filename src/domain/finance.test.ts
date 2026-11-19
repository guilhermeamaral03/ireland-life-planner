import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/db'
import type { Category, Expense } from '../db/types'
import { computeTax, netMonthlyForRent, rentMonthlyFor } from './finance'

const categories: Category[] = [{ id: 1, name: 'Aluguel', group: 'moradia', builtIn: true }]
const expenses: Expense[] = [{ id: 1, name: 'Apto', categoryId: 1, amount: 1500, frequency: 'mensal', kind: 'fixa' }]

describe('computeTax', () => {
  it('sem salário → null', () => {
    expect(computeTax(DEFAULT_SETTINGS, expenses, categories)).toBeNull()
  })

  it('usa 2027 por padrão e o aluguel das despesas', () => {
    const r = computeTax({ ...DEFAULT_SETTINGS, grossAnnual: 50000 }, expenses, categories)
    expect(r?.ok).toBe(true)
    if (r?.ok) {
      expect(r.year).toBe(2027)
      expect(r.incomeTax.rentCredit).toBeCloseTo(1150, 2)
    }
  })

  it('aluguel informado no simulador tem prioridade', () => {
    const s = { ...DEFAULT_SETTINGS, grossAnnual: 50000, rentMonthlyOverride: 0 }
    expect(rentMonthlyFor(s, expenses, categories)).toBe(0)
    const r = computeTax(s, expenses, categories)
    if (r?.ok) expect(r.incomeTax.rentCredit).toBe(0)
  })

  it('líquido em função do aluguel aplica o Rent Tax Credit daquele aluguel', () => {
    const netFor = netMonthlyForRent({ ...DEFAULT_SETTINGS, grossAnnual: 50000, taxYear: 2026 }, [], categories)
    // 2026 solteiro €50.000: sem aluguel 39648,28/ano; com aluguel ≥ €5.000/ano crédito de €1.000
    expect(netFor(0)).toBeCloseTo(39648.28 / 12, 1)
    expect(netFor(1200)).toBeCloseTo(40648.28 / 12, 1)
    expect(netMonthlyForRent(DEFAULT_SETTINGS, [], categories)(1000)).toBeNull()
  })

  it('situação não informada é tratada como solteiro', () => {
    const r = computeTax({ ...DEFAULT_SETTINGS, grossAnnual: 50000, taxYear: 2026 }, [], categories)
    if (r?.ok) expect(r.incomeTax.band).toBe(44000)
  })
})

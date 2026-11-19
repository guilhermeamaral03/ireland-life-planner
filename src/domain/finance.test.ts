import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/db'
import type { Category, Expense } from '../db/types'
import { computeTax } from './finance'

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

  it('aluguel vem só de Despesas: valor antigo digitado no simulador é ignorado', () => {
    const s = { ...DEFAULT_SETTINGS, grossAnnual: 50000, rentMonthlyOverride: 0 }
    const r = computeTax(s, expenses, categories)
    expect(r?.ok && r.incomeTax.rentCredit).toBeCloseTo(1150, 2)
  })

  it('situação não informada é tratada como solteiro', () => {
    const r = computeTax({ ...DEFAULT_SETTINGS, grossAnnual: 50000, taxYear: 2026 }, [], categories)
    if (r?.ok) expect(r.incomeTax.band).toBe(44000)
  })
})

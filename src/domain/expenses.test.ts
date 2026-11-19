import { describe, expect, it } from 'vitest'
import type { Category, Expense } from '../db/types'
import { monthlyRentFromExpenses, projectReserve, summarizeExpenses, toMonthly, validateExpense } from './expenses'

const categories: Category[] = [
  { id: 1, name: 'Aluguel', group: 'moradia', builtIn: true },
  { id: 2, name: 'Seguro automóvel', group: 'transporte', builtIn: true },
  { id: 3, name: 'Mercado', group: 'outros', builtIn: true },
]
const expenses: Expense[] = [
  { id: 1, name: 'Apartamento', categoryId: 1, amount: 1000, frequency: 'mensal', kind: 'fixa' },
  { id: 2, name: 'Seguro', categoryId: 2, amount: 600, frequency: 'anual', kind: 'fixa' },
  { id: 3, name: 'Compras', categoryId: 3, amount: 100, frequency: 'semanal', kind: 'variavel' },
]

describe('toMonthly', () => {
  it('converte frequências', () => {
    expect(toMonthly(100, 'semanal')).toBeCloseTo(433.33, 2)
    expect(toMonthly(100, 'mensal')).toBe(100)
    expect(toMonthly(300, 'trimestral')).toBe(100)
    expect(toMonthly(1200, 'anual')).toBe(100)
  })
})

describe('summarizeExpenses', () => {
  it('totais, participação na renda e saldo', () => {
    const s = summarizeExpenses(expenses, categories, 3000)
    expect(s.totalMonthly).toBeCloseTo(1483.33, 2)
    expect(s.totalAnnual).toBeCloseTo(17800, 1)
    expect(s.fixedMonthly).toBeCloseTo(1050, 2)
    expect(s.variableMonthly).toBeCloseTo(433.33, 2)
    expect(s.incomeShare).toBeCloseTo(0.4944, 4)
    expect(s.balance).toBeCloseTo(1516.67, 2)
    expect(s.savingRate).toBeCloseTo(0.5056, 4)
    expect(s.byCategory[0].name).toBe('Aluguel')
    expect(s.byCategory).toHaveLength(3)
  })

  it('sem renda: participação, saldo e economia indisponíveis', () => {
    const s = summarizeExpenses(expenses, categories, null)
    expect(s.totalMonthly).toBeCloseTo(1483.33, 2)
    expect(s.incomeShare).toBeNull()
    expect(s.balance).toBeNull()
    expect(s.savingRate).toBeNull()
    expect(summarizeExpenses(expenses, categories, 0).balance).toBeNull()
  })

  it('saldo negativo: taxa de economia 0', () => {
    const s = summarizeExpenses(expenses, categories, 1000)
    expect(s.balance).toBeCloseTo(-483.33, 2)
    expect(s.savingRate).toBe(0)
  })

  it('sem despesas', () => {
    const s = summarizeExpenses([], categories, 3000)
    expect(s.totalMonthly).toBe(0)
    expect(s.byCategory).toEqual([])
    expect(s.balance).toBe(3000)
  })
})

describe('monthlyRentFromExpenses', () => {
  it('soma a categoria Aluguel', () => {
    expect(monthlyRentFromExpenses(expenses, categories)).toBe(1000)
    expect(monthlyRentFromExpenses([], categories)).toBe(0)
  })
})

describe('validateExpense', () => {
  const ok = { name: 'Netflix', categoryId: 3, amount: 13, frequency: 'mensal' as const, kind: 'fixa' as const }
  it('despesa válida', () => {
    expect(validateExpense(ok)).toEqual({})
  })
  it('exige nome, categoria e valor positivo', () => {
    expect(validateExpense({ ...ok, name: '  ' })).toEqual({ name: 'Informe o nome.' })
    expect(validateExpense({ ...ok, categoryId: null })).toEqual({ categoryId: 'Escolha a categoria.' })
    expect(validateExpense({ ...ok, amount: null })).toEqual({ amount: 'Informe um valor maior que zero.' })
    expect(validateExpense({ ...ok, amount: 0 })).toEqual({ amount: 'Informe um valor maior que zero.' })
  })
})

describe('projectReserve', () => {
  it('projeção linear mês a mês', () => {
    const p = projectReserve(1000, 500, 24)
    expect(p).toHaveLength(25)
    expect(p[0]).toEqual({ month: 0, value: 1000 })
    expect(p[24].value).toBe(13000)
  })
})

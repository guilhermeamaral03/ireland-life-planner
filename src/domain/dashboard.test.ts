import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/db'
import type { Category, Expense, Settings } from '../db/types'
import { buildDashboard } from './dashboard'

const categories: Category[] = [
  { id: 1, name: 'Aluguel', group: 'moradia', builtIn: true },
  { id: 2, name: 'Mercado', group: 'outros', builtIn: true },
]
const expenses: Expense[] = [{ id: 1, name: 'Mercado', categoryId: 2, amount: 1000, frequency: 'mensal', kind: 'variavel' }]
const configured: Settings = { ...DEFAULT_SETTINGS, taxYear: 2026, grossAnnual: 50000, initialReserve: 1000, projectionMonths: 24 }

describe('buildDashboard', () => {
  it('sem salário → vazio', () => {
    expect(buildDashboard(DEFAULT_SETTINGS, expenses, categories)).toEqual({ empty: true })
  })

  it('indicadores e projeção', () => {
    const d = buildDashboard(configured, expenses, categories)
    if ('empty' in d) throw new Error('não deveria estar vazio')
    expect(d.grossMonthly).toBeCloseTo(4166.67, 2)
    expect(d.summary.balance).toBeCloseTo(2304.02, 1)
    expect(d.projection).toHaveLength(25)
    expect(d.projection![24].value).toBeCloseTo(1000 + 24 * 2304.02, 0)
  })

  it('sem reserva informada → sem projeção', () => {
    const d = buildDashboard({ ...configured, initialReserve: null }, expenses, categories)
    if ('empty' in d) throw new Error('não deveria estar vazio')
    expect(d.projection).toBeNull()
  })

  it('saldo negativo → reserva cai na projeção', () => {
    const big: Expense[] = [{ ...expenses[0], amount: 5000 }]
    const d = buildDashboard(configured, big, categories)
    if ('empty' in d) throw new Error('não deveria estar vazio')
    const balance = d.summary.balance!
    expect(balance).toBeLessThan(0)
    expect(d.projection![24].value).toBeCloseTo(1000 + 24 * balance, 2)
  })

  it('imposto indisponível (2027 casado) → sem exceção e sem projeção', () => {
    const d = buildDashboard({ ...configured, taxYear: 2027, taxStatus: 'casado_uma_renda' }, expenses, categories)
    if ('empty' in d) throw new Error('não deveria estar vazio')
    expect(d.tax.ok).toBe(false)
    expect(d.projection).toBeNull()
    expect(d.summary.balance).toBeNull()
  })
})

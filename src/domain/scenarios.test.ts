import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/db'
import type { Category, Expense, Scenario, Settings } from '../db/types'
import { amountsFromExpenses, computeScenario, emptyScenario, validateScenario } from './scenarios'

const cats: Category[] = [
  { id: 1, name: 'Aluguel', group: 'moradia', builtIn: true },
  { id: 2, name: 'Internet', group: 'moradia', builtIn: true },
  { id: 3, name: 'Mercado', group: 'outros', builtIn: true },
  { id: 4, name: 'Combustível', group: 'transporte', builtIn: true },
  { id: 5, name: 'Lazer', group: 'outros', builtIn: true },
  { id: 6, name: 'Academia', group: 'outros', builtIn: false },
  { id: 7, name: 'Condomínio', group: 'moradia', builtIn: false },
]
const exp = (categoryId: number, amount: number, frequency: Expense['frequency'] = 'mensal'): Expense => ({
  name: 'x',
  categoryId,
  amount,
  frequency,
  kind: 'fixa',
})

describe('amountsFromExpenses', () => {
  it('agrupa as categorias nos 6 grupos do cenário', () => {
    const a = amountsFromExpenses(
      [exp(1, 1000), exp(2, 50), exp(3, 100, 'semanal'), exp(4, 1200, 'anual'), exp(5, 80), exp(6, 40), exp(7, 60)],
      cats,
    )
    expect(a.aluguel).toBe(1000)
    expect(a.contas).toBe(110)
    expect(a.alimentacao).toBeCloseTo(433.33, 2)
    expect(a.transporte).toBe(100)
    expect(a.pessoais).toBe(80)
    expect(a.outros).toBe(40)
  })
})

describe('computeScenario', () => {
  const base: Settings = { ...DEFAULT_SETTINGS, taxYear: 2026, grossAnnual: 50000, initialReserve: 1000 }
  const s: Scenario = { ...emptyScenario('Teste'), amounts: { ...emptyScenario('x').amounts, aluguel: 1000, alimentacao: 400 } }

  it('usa o salário do simulador e o aluguel do cenário', () => {
    const r = computeScenario(s, base)
    expect(r.tax.ok).toBe(true)
    if (!r.tax.ok) return
    expect(r.tax.incomeTax.rentCredit).toBeCloseTo(1000, 2)
    expect(r.totalMonthly).toBe(1400)
    expect(r.balance).toBeCloseTo(r.tax.netMonthly - 1400, 6)
    expect(r.savingAnnual).toBeCloseTo(r.balance! * 12, 6)
    expect(r.projection).toHaveLength(25)
    expect(r.projection![24].value).toBeCloseTo(1000 + 24 * r.balance!, 6)
  })

  it('salário e situação do cenário sobrepõem o simulador', () => {
    const r = computeScenario({ ...s, grossAnnual: 60000, taxStatus: 'casado_uma_renda' }, base)
    if (!r.tax.ok) throw new Error(r.tax.reason)
    expect(r.tax.incomeTax.band).toBe(53000)
    expect(r.tax.netAnnual).toBeGreaterThan(0)
  })

  it('sem salário em lugar nenhum → indisponível', () => {
    const r = computeScenario(s, { ...base, grossAnnual: null })
    expect(r.tax).toEqual({ ok: false, reason: 'Informe o salário (no cenário ou no simulador).' })
    expect(r.balance).toBeNull()
    expect(r.projection).toBeNull()
  })

  it('valores inválidos contam como zero', () => {
    const r = computeScenario({ ...s, amounts: { ...s.amounts, outros: NaN } }, base)
    expect(r.totalMonthly).toBe(1400)
  })

  it('saldo negativo: economia 0, projeção cai', () => {
    const r = computeScenario({ ...s, amounts: { ...s.amounts, aluguel: 5000 } }, base)
    expect(r.balance!).toBeLessThan(0)
    expect(r.savingMonthly).toBe(0)
    expect(r.projection![24].value).toBeLessThan(1000)
  })
})

describe('validateScenario', () => {
  it('valida nome e valores', () => {
    expect(validateScenario({ ...emptyScenario('  ') })).toBe('Informe o nome do cenário.')
    const neg = emptyScenario('A')
    neg.amounts.aluguel = -1
    expect(validateScenario(neg)).toBe('Valores não podem ser negativos.')
    expect(validateScenario(emptyScenario('A'))).toBeNull()
  })
})

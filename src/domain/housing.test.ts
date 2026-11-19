import { describe, expect, it } from 'vitest'
import { INITIAL_LOCATIONS } from '../data/seed/locations'
import type { Category, Expense, Location, Property } from '../db/types'
import { baselineFromExpenses, bestBy, housingCost, locationCost, propertyCost } from './housing'
import { emptyProperty } from './properties'

const base = { bills: 150, transport: 100, other: 400 }
const loc = (patch: Partial<Location>): Location => ({ ...INITIAL_LOCATIONS[1], ...patch })

describe('baselineFromExpenses', () => {
  it('separa contas (moradia sem aluguel), transporte e outras', () => {
    const cats: Category[] = [
      { id: 1, name: 'Aluguel', group: 'moradia', builtIn: true },
      { id: 2, name: 'Internet', group: 'moradia', builtIn: true },
      { id: 3, name: 'Eletricidade', group: 'moradia', builtIn: true },
      { id: 4, name: 'Combustível', group: 'transporte', builtIn: true },
      { id: 5, name: 'Mercado', group: 'outros', builtIn: true },
    ]
    const e = (categoryId: number, amount: number): Expense => ({ name: 'x', categoryId, amount, frequency: 'mensal', kind: 'fixa' })
    expect(baselineFromExpenses([e(1, 1000), e(2, 50), e(3, 100), e(4, 100), e(5, 400)], cats)).toEqual({ bills: 150, transport: 100, other: 400 })
  })
})

describe('housingCost', () => {
  it('faixa de aluguel gera faixa de custo, saldo e economia', () => {
    const r = housingCost({ rent: { min: 1200, max: 1500 }, bills: null, transport: null }, base, 3000)
    expect(r.total).toEqual({ min: 1850, max: 2150 })
    expect(r.balance).toEqual({ min: 850, max: 1150 })
    expect(r.saving).toEqual({ min: 850, max: 1150 })
    expect(r.bills).toEqual({ value: 150, origin: 'despesas' })
  })

  it('sem renda: custo sim, saldo não', () => {
    const r = housingCost({ rent: { min: 1000, max: 1000 }, bills: null, transport: null }, base, null)
    expect(r.total).toEqual({ min: 1650, max: 1650 })
    expect(r.balance).toBeNull()
    expect(r.saving).toBeNull()
  })

  it('líquido pode depender do aluguel (Rent Tax Credit)', () => {
    // líquido fictício de teste: 3000 + 10% do aluguel
    const netFor = (rent: number) => 3000 + rent * 0.1
    const r = housingCost({ rent: { min: 1200, max: 1500 }, bills: null, transport: null }, base, netFor)
    // pior caso: aluguel 1500 → líquido 3150 − custo 2150 = 1000; melhor: 1200 → 3120 − 1850 = 1270
    expect(r.balance).toEqual({ min: 1000, max: 1270 })
    expect(r.net).toEqual({ atMinRent: 3120, atMaxRent: 3150 })
  })

  it('saldo negativo: economia 0', () => {
    const r = housingCost({ rent: { min: 3000, max: 3000 }, bills: null, transport: null }, base, 3000)
    expect(r.balance).toEqual({ min: -650, max: -650 })
    expect(r.saving).toEqual({ min: 0, max: 0 })
  })
})

describe('locationCost', () => {
  it('com transporte da localidade', () => {
    const l = loc({ rentRange: { value: { min: 1200, max: 1500 }, source: 'x', date: null }, transportMonthly: { value: 140, source: 'Leap', date: null } })
    const r = locationCost(l, base, 3000)
    expect(r.total).toEqual({ min: 1890, max: 2190 })
    expect(r.transport).toEqual({ value: 140, origin: 'item' })
  })

  it('sem faixa de aluguel → custo indisponível', () => {
    const r = locationCost(loc({}), base, 3000)
    expect(r.total).toBeNull()
    expect(r.balance).toBeNull()
  })

  it('registro antigo sem transportMonthly → usa despesas, sem NaN', () => {
    const old = loc({ rentRange: { value: { min: 1000, max: 1000 }, source: null, date: null } })
    delete (old as Partial<Location>).transportMonthly
    const r = locationCost(old, base, 3000)
    expect(r.transport).toEqual({ value: 100, origin: 'despesas' })
    expect(r.total).toEqual({ min: 1650, max: 1650 })
  })
})

describe('propertyCost', () => {
  const p = (patch: Partial<Property>): Property => ({ ...emptyProperty(), title: 'Apto', rent: 1300, ...patch })

  it('contas incluídas e transporte das despesas', () => {
    const r = propertyCost(p({ billsIncluded: true }), base, 3000)
    expect(r.bills).toEqual({ value: 0, origin: 'incluidas' })
    expect(r.transport).toEqual({ value: 100, origin: 'despesas' })
    expect(r.total).toEqual({ min: 1800, max: 1800 })
  })

  it('contas não incluídas sem valor → contas das despesas', () => {
    expect(propertyCost(p({ billsIncluded: false, billsMonthly: null }), base, 3000).bills).toEqual({ value: 150, origin: 'despesas' })
  })

  it('valores do imóvel', () => {
    const r = propertyCost(p({ billsIncluded: false, billsMonthly: 90, transportMonthly: 0 }), base, 3000)
    expect(r.bills).toEqual({ value: 90, origin: 'item' })
    expect(r.transport).toEqual({ value: 0, origin: 'item' })
    expect(r.total).toEqual({ min: 1790, max: 1790 })
  })
})

describe('bestBy', () => {
  it('melhor por critério, empates incluídos, ignora sem dado', () => {
    const items = [{ v: 3 }, { v: 1 }, { v: null }, { v: 1 }]
    expect([...bestBy(items, (i) => i.v, 'min')]).toEqual([items[1], items[3]])
    expect([...bestBy(items, (i) => i.v, 'max')]).toEqual([items[0]])
    expect(bestBy([{ v: 1 }, { v: null }], (i) => i.v, 'min').size).toBe(0)
  })
})

describe('bestBy — sem diferença não há destaque', () => {
  it('todos iguais (ex.: economia 0 em todos) → nenhum destaque', () => {
    expect(bestBy([{ v: 0 }, { v: 0 }, { v: 0 }], (i) => i.v, 'max').size).toBe(0)
  })
})

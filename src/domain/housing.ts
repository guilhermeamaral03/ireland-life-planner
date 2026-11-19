import type { Category, Expense, Location, Property } from '../db/types'
import { toMonthly } from './expenses'

/** Despesas atuais do usuário usadas quando o imóvel/localidade não informa o valor. */
export interface BaselineExpenses {
  bills: number
  transport: number
  other: number
}

export function baselineFromExpenses(expenses: Expense[], categories: Category[]): BaselineExpenses {
  const cat = new Map(categories.map((c) => [c.id, c]))
  const out = { bills: 0, transport: 0, other: 0 }
  for (const e of expenses) {
    const c = cat.get(e.categoryId)
    const m = toMonthly(e.amount, e.frequency)
    if (!c) out.other += m
    else if (c.group === 'moradia') {
      if (c.name !== 'Aluguel') out.bills += m
    } else if (c.group === 'transporte') out.transport += m
    else out.other += m
  }
  return out
}

export type Origin = 'item' | 'despesas' | 'incluidas'
export interface Part {
  value: number
  origin: Origin
}
export type Range = { min: number; max: number }

export interface HousingCost {
  rent: Range | null
  bills: Part
  transport: Part
  other: number
  total: Range | null
  /** Líquido mensal usado (pode variar com o aluguel por causa do Rent Tax Credit). */
  net: { atMinRent: number; atMaxRent: number } | null
  balance: Range | null
  saving: Range | null
}

const known = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** Líquido fixo, ou função do aluguel mensal (para aplicar o Rent Tax Credit daquele aluguel). */
export type NetInput = number | null | ((rentMonthly: number) => number | null)

export function housingCost(
  input: { rent: Range | null; bills: number | 'incluidas' | null; transport: number | null },
  base: BaselineExpenses,
  netInput: NetInput,
): HousingCost {
  const netAt = (rent: number) => (typeof netInput === 'function' ? netInput(rent) : netInput)
  const bills: Part =
    input.bills === 'incluidas'
      ? { value: 0, origin: 'incluidas' }
      : known(input.bills)
        ? { value: input.bills, origin: 'item' }
        : { value: base.bills, origin: 'despesas' }
  const transport: Part = known(input.transport)
    ? { value: input.transport, origin: 'item' }
    : { value: base.transport, origin: 'despesas' }
  const fixed = bills.value + transport.value + base.other
  const total = input.rent ? { min: input.rent.min + fixed, max: input.rent.max + fixed } : null
  const nMin = input.rent ? netAt(input.rent.min) : null
  const nMax = input.rent ? netAt(input.rent.max) : null
  const net = known(nMin) && known(nMax) && nMin > 0 && nMax > 0 ? { atMinRent: nMin, atMaxRent: nMax } : null
  // pior caso: aluguel máximo; melhor caso: aluguel mínimo
  const balance = total && net ? { min: net.atMaxRent - total.max, max: net.atMinRent - total.min } : null
  const saving = balance ? { min: Math.max(balance.min, 0), max: Math.max(balance.max, 0) } : null
  return { rent: input.rent, bills, transport, other: base.other, total, net, balance, saving }
}

export function locationCost(l: Location, base: BaselineExpenses, netInput: NetInput): HousingCost {
  return housingCost(
    { rent: l.rentRange?.value ?? null, bills: null, transport: l.transportMonthly?.value ?? null },
    base,
    netInput,
  )
}

export function propertyCost(p: Property, base: BaselineExpenses, netInput: NetInput): HousingCost {
  return housingCost(
    {
      rent: known(p.rent) ? { min: p.rent, max: p.rent } : null,
      bills: p.billsIncluded ? 'incluidas' : p.billsMonthly,
      transport: p.transportMonthly,
    },
    base,
    netInput,
  )
}

/** Melhor(es) item(ns) por um critério; ignora quem não tem dado; precisa de ≥ 2 com dado e alguma diferença. */
export function bestBy<T>(items: T[], score: (t: T) => number | null, prefer: 'min' | 'max'): Set<T> {
  const scored = items.map((t) => [t, score(t)] as const).filter((x): x is readonly [T, number] => known(x[1]))
  if (scored.length < 2) return new Set()
  // todos iguais: não há "melhor" a destacar
  if (scored.every((x) => x[1] === scored[0][1])) return new Set()
  const target = prefer === 'min' ? Math.min(...scored.map((x) => x[1])) : Math.max(...scored.map((x) => x[1]))
  return new Set(scored.filter((x) => x[1] === target).map((x) => x[0]))
}

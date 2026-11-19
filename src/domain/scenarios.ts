import { getTaxRules } from '../data/tax'
import type { Category, Expense, Scenario, ScenarioKey, Settings } from '../db/types'
import { projectReserve, toMonthly } from './expenses'
import { effectiveYear } from './finance'
import { calcNetPay, type TaxResult, type TaxUnavailable } from './tax'

export const SCENARIO_KEYS: ScenarioKey[] = ['aluguel', 'contas', 'alimentacao', 'transporte', 'pessoais', 'outros']

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  aluguel: 'Aluguel',
  contas: 'Contas da casa',
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  pessoais: 'Despesas pessoais',
  outros: 'Outros',
}

/** Categorias iniciais → grupo do cenário. Personalizadas seguem o grupo da categoria. */
const BY_NAME: Record<string, ScenarioKey> = {
  Aluguel: 'aluguel',
  Eletricidade: 'contas',
  Gás: 'contas',
  Internet: 'contas',
  Celular: 'contas',
  Mercado: 'alimentacao',
  Restaurantes: 'alimentacao',
  'Transporte público': 'transporte',
  Combustível: 'transporte',
  'Seguro automóvel': 'transporte',
  'Manutenção automóvel': 'transporte',
  Saúde: 'pessoais',
  Lazer: 'pessoais',
  Compras: 'pessoais',
  Outros: 'outros',
}
const BY_GROUP: Record<Category['group'], ScenarioKey> = { moradia: 'contas', transporte: 'transporte', outros: 'outros' }

const zeroAmounts = (): Record<ScenarioKey, number> =>
  Object.fromEntries(SCENARIO_KEYS.map((k) => [k, 0])) as Record<ScenarioKey, number>

export function emptyScenario(name: string): Scenario {
  return { name, grossAnnual: null, taxStatus: null, spouseGrossAnnual: null, amounts: zeroAmounts(), initialReserve: null }
}

export function amountsFromExpenses(expenses: Expense[], categories: Category[]): Record<ScenarioKey, number> {
  const keyOf = new Map(
    categories.map((c) => [c.id, (c.builtIn ? BY_NAME[c.name] : undefined) ?? BY_GROUP[c.group]]),
  )
  const out = zeroAmounts()
  for (const e of expenses) out[keyOf.get(e.categoryId) ?? 'outros'] += toMonthly(e.amount, e.frequency)
  return out
}

export function validateScenario(s: Scenario): string | null {
  if (!s.name.trim()) return 'Informe o nome do cenário.'
  if (SCENARIO_KEYS.some((k) => s.amounts[k] < 0)) return 'Valores não podem ser negativos.'
  return null
}

export interface ScenarioResult {
  tax: TaxResult | TaxUnavailable
  totalMonthly: number
  balance: number | null
  savingMonthly: number | null
  savingAnnual: number | null
  savingRate: number | null
  reserve: number | null
  projection: { month: number; value: number }[] | null
}

const safe = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

export function computeScenario(s: Scenario, base: Settings): ScenarioResult {
  const totalMonthly = SCENARIO_KEYS.reduce((sum, k) => sum + safe(s.amounts[k]), 0)
  const gross = s.grossAnnual ?? base.grossAnnual
  const reserve = s.initialReserve ?? base.initialReserve
  const empty = { totalMonthly, balance: null, savingMonthly: null, savingAnnual: null, savingRate: null, reserve, projection: null }

  if (gross === null) return { tax: { ok: false, reason: 'Informe o salário (no cenário ou no simulador).' }, ...empty }
  const year = effectiveYear(base)
  const rules = getTaxRules(year)
  if (!rules) return { tax: { ok: false, reason: `Não há regras fiscais cadastradas para ${year}.` }, ...empty }

  const tax = calcNetPay(
    {
      grossAnnual: gross,
      status: s.taxStatus ?? base.taxStatus ?? 'solteiro',
      spouseGrossAnnual: (s.taxStatus ?? null) !== null ? (s.spouseGrossAnnual ?? null) : base.spouseGrossAnnual,
      annualRent: safe(s.amounts.aluguel) * 12,
      uscReducedRate: base.uscReducedRate,
      extraCredits: base.extraCredits.reduce((sum, c) => sum + safe(c.amount), 0),
    },
    rules,
  )
  if (!tax.ok) return { tax, ...empty }

  const balance = tax.netMonthly - totalMonthly
  const savingMonthly = Math.max(balance, 0)
  return {
    tax,
    totalMonthly,
    balance,
    savingMonthly,
    savingAnnual: savingMonthly * 12,
    savingRate: tax.netMonthly > 0 ? savingMonthly / tax.netMonthly : null,
    reserve,
    projection: reserve !== null ? projectReserve(reserve, balance, base.projectionMonths) : null,
  }
}

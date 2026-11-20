import { getTaxRules } from '../data/tax'
import type { Category, Expense, Settings, TaxStatus } from '../db/types'
import { monthlyRentFromExpenses, summarizeExpenses } from './expenses'
import { calcNetPay, type TaxResult, type TaxUnavailable } from './tax'

export const DEFAULT_TAX_YEAR = 2027

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  solteiro: 'Solteiro(a)',
  pai_mae_solteiro: 'Pai/mãe solteiro(a) (com dependente)',
  casado_uma_renda: 'Casado(a) — só eu tenho renda',
  casado_duas_rendas: 'Casado(a) — os dois têm renda',
}

export const RULES_STATUS_LABELS = {
  oficial: 'Oficial',
  proposto: 'Proposto — Finance (No.2) Bill 2026 ainda não promulgado',
} as const

export const ESTIMATE_DISCLAIMER = 'Estimativa. Sua situação individual pode alterar os resultados.'

export function effectiveYear(settings: Settings): number {
  return settings.taxYear ?? DEFAULT_TAX_YEAR
}

/** Calcula o líquido a partir das configurações. null quando o salário não foi informado. */
export function computeTax(
  settings: Settings,
  expenses: Expense[],
  categories: Category[],
): TaxResult | TaxUnavailable | null {
  if (settings.grossAnnual === null) return null
  const year = effectiveYear(settings)
  const rules = getTaxRules(year)
  if (!rules) return { ok: false, reason: `Não há regras fiscais cadastradas para ${year}.` }
  return calcNetPay(
    {
      grossAnnual: settings.grossAnnual,
      status: settings.taxStatus ?? 'solteiro',
      spouseGrossAnnual: settings.spouseGrossAnnual,
      // fonte única: o aluguel cadastrado em Despesas (o antigo campo do simulador é ignorado)
      annualRent: monthlyRentFromExpenses(expenses, categories) * 12,
      uscReducedRate: settings.uscReducedRate,
      extraCredits: settings.extraCredits.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0),
    },
    rules,
  )
}

export type WithRentResult =
  | { ok: true; netMonthly: number; expensesMonthly: number; balance: number }
  | { ok: false; reason: string }

/**
 * "E se eu alugar este imóvel?": troca o aluguel cadastrado em Despesas por `rentMonthly`
 * e recalcula o líquido (o Rent Tax Credit muda) e o saldo. Nada é gravado.
 */
export function withRent(
  settings: Settings,
  expenses: Expense[],
  categories: Category[],
  rentMonthly: number,
): WithRentResult | null {
  const rentIds = new Set(categories.filter((c) => c.name === 'Aluguel').map((c) => c.id))
  const rentCat = categories.find((c) => c.name === 'Aluguel')
  if (rentCat?.id === undefined) return { ok: false, reason: 'Categoria Aluguel não encontrada.' }
  const others = expenses.filter((e) => !rentIds.has(e.categoryId))
  const simulated: Expense[] = [...others, { name: 'Aluguel', categoryId: rentCat.id, amount: rentMonthly, frequency: 'mensal', kind: 'fixa' }]
  const tax = computeTax(settings, simulated, categories)
  if (tax === null) return null
  if (!tax.ok) return tax
  const expensesMonthly = summarizeExpenses(simulated, categories, tax.netMonthly).totalMonthly
  return { ok: true, netMonthly: tax.netMonthly, expensesMonthly, balance: tax.netMonthly - expensesMonthly }
}

import type { Category, Expense, Settings } from '../db/types'
import { projectReserve, summarizeExpenses, type ExpenseSummary } from './expenses'
import { computeTax } from './finance'
import type { TaxResult, TaxUnavailable } from './tax'

export interface DashboardData {
  grossAnnual: number
  grossMonthly: number
  tax: TaxResult | TaxUnavailable
  summary: ExpenseSummary
  reserve: number | null
  projection: { month: number; value: number }[] | null
}

export function buildDashboard(
  settings: Settings,
  expenses: Expense[],
  categories: Category[],
): DashboardData | { empty: true } {
  const tax = computeTax(settings, expenses, categories)
  if (tax === null || settings.grossAnnual === null) return { empty: true }
  const summary = summarizeExpenses(expenses, categories, tax.ok ? tax.netMonthly : null)
  const reserve = settings.initialReserve
  const projection =
    tax.ok && reserve !== null && summary.balance !== null
      ? projectReserve(reserve, summary.balance, settings.projectionMonths) // saldo negativo consome a reserva
      : null
  return {
    grossAnnual: settings.grossAnnual,
    grossMonthly: settings.grossAnnual / 12,
    tax,
    summary,
    reserve,
    projection,
  }
}

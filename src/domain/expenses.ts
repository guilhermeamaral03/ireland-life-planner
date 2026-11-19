import type { Category, Expense, Frequency } from '../db/types'

const PER_MONTH: Record<Frequency, number> = {
  semanal: 52 / 12,
  mensal: 1,
  trimestral: 1 / 3,
  anual: 1 / 12,
}

export function toMonthly(amount: number, frequency: Frequency): number {
  return amount * PER_MONTH[frequency]
}

export interface ExpenseSummary {
  totalMonthly: number
  totalAnnual: number
  fixedMonthly: number
  variableMonthly: number
  byCategory: { categoryId: number; name: string; monthly: number }[]
  /** Fração da renda líquida mensal (0–1+). null sem renda. */
  incomeShare: number | null
  /** Renda líquida mensal − despesas. null sem renda. */
  balance: number | null
  /** Saldo positivo / renda. null sem renda. */
  savingRate: number | null
}

export function summarizeExpenses(
  expenses: Expense[],
  categories: Category[],
  netMonthly: number | null,
): ExpenseSummary {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const perCategory = new Map<number, number>()
  let fixed = 0
  let variable = 0
  for (const e of expenses) {
    const m = toMonthly(e.amount, e.frequency)
    perCategory.set(e.categoryId, (perCategory.get(e.categoryId) ?? 0) + m)
    if (e.kind === 'fixa') fixed += m
    else variable += m
  }
  const totalMonthly = fixed + variable
  const byCategory = [...perCategory.entries()]
    .filter(([, monthly]) => monthly > 0)
    .map(([categoryId, monthly]) => ({ categoryId, name: names.get(categoryId) ?? 'Sem categoria', monthly }))
    .sort((a, b) => b.monthly - a.monthly)

  const hasIncome = netMonthly !== null && netMonthly > 0
  const balance = hasIncome ? netMonthly - totalMonthly : null
  return {
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    fixedMonthly: fixed,
    variableMonthly: variable,
    byCategory,
    incomeShare: hasIncome ? totalMonthly / netMonthly : null,
    balance,
    savingRate: hasIncome && balance !== null ? Math.max(balance, 0) / netMonthly : null,
  }
}

export function monthlyRentFromExpenses(expenses: Expense[], categories: Category[]): number {
  const rentIds = new Set(categories.filter((c) => c.name === 'Aluguel').map((c) => c.id))
  return expenses.filter((e) => rentIds.has(e.categoryId)).reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
}

export interface ExpenseDraft {
  name: string
  categoryId: number | null
  amount: number | null
  frequency: Frequency
  kind: Expense['kind']
}

export type ExpenseErrors = Partial<Record<'name' | 'categoryId' | 'amount', string>>

export function validateExpense(d: ExpenseDraft): ExpenseErrors {
  const errors: ExpenseErrors = {}
  if (!d.name.trim()) errors.name = 'Informe o nome.'
  if (d.categoryId === null) errors.categoryId = 'Escolha a categoria.'
  if (d.amount === null || !(d.amount > 0)) errors.amount = 'Informe um valor maior que zero.'
  return errors
}

export function projectReserve(initial: number, monthlySaving: number, months: number) {
  return Array.from({ length: months + 1 }, (_, month) => ({ month, value: initial + monthlySaving * month }))
}

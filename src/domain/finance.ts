import { getTaxRules } from '../data/tax'
import type { Category, Expense, Settings, TaxStatus } from '../db/types'
import { monthlyRentFromExpenses } from './expenses'
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

/** Aluguel mensal usado no Rent Tax Credit: o informado no simulador ou o das despesas. */
export function rentMonthlyFor(settings: Settings, expenses: Expense[], categories: Category[]): number {
  return settings.rentMonthlyOverride ?? monthlyRentFromExpenses(expenses, categories)
}

/** Líquido mensal se o aluguel fosse `rentMonthly` (aplica o Rent Tax Credit desse aluguel). null se indisponível. */
export function netMonthlyForRent(settings: Settings, expenses: Expense[], categories: Category[]) {
  const cache = new Map<number, number | null>()
  return (rentMonthly: number): number | null => {
    if (!cache.has(rentMonthly)) {
      const r = computeTax({ ...settings, rentMonthlyOverride: rentMonthly }, expenses, categories)
      cache.set(rentMonthly, r?.ok ? r.netMonthly : null)
    }
    return cache.get(rentMonthly)!
  }
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
      annualRent: rentMonthlyFor(settings, expenses, categories) * 12,
      uscReducedRate: settings.uscReducedRate,
      extraCredits: settings.extraCredits.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0),
    },
    rules,
  )
}

import type { Band, Param, TaxRules } from '../data/tax/types'
import type { TaxStatus } from '../db/types'

export interface TaxInput {
  grossAnnual: number
  status: TaxStatus
  /** Só para casado com duas rendas. */
  spouseGrossAnnual: number | null
  /** Aluguel pago no ano (sem contas), para o Rent Tax Credit. */
  annualRent: number
  uscReducedRate: boolean
  /** Soma de outros créditos fiscais informados pelo usuário. */
  extraCredits: number
}

export interface TaxResult {
  ok: true
  year: number
  rulesStatus: 'oficial' | 'proposto'
  incomeTax: {
    band: number
    standardRate: number
    higherRate: number
    grossTax: number
    credits: { label: string; amount: number }[]
    rentCredit: number
    /** Parte do usuário. */
    total: number
    /** Imposto do casal (só casado com duas rendas). */
    coupleTotal: number | null
  }
  usc: {
    exempt: boolean
    reduced: boolean
    lines: { from: number; to: number; rate: number; amount: number }[]
    total: number
  }
  prsi: {
    weeklyEarnings: number
    weeklyCredit: number
    periods: { from: string; to: string; days: number; rate: number; amount: number }[]
    total: number
  }
  totalDeductions: number
  netAnnual: number
  netMonthly: number
  netWeekly: number
  effectiveRate: number
}

export interface TaxUnavailable {
  ok: false
  reason: string
}

class MissingParam extends Error {}

function need<T>(p: Param<T>): T {
  if (p.value === null) throw new MissingParam()
  return p.value
}

/** Aplica faixas acumuladas a um valor. */
export function applyBands(amount: number, bands: Band[]) {
  const lines: { from: number; to: number; rate: number; amount: number }[] = []
  let lower = 0
  for (const b of bands) {
    if (amount <= lower) break
    const upper = b.upTo === null ? amount : Math.min(amount, b.upTo)
    lines.push({ from: lower, to: upper, rate: b.rate, amount: (upper - lower) * b.rate })
    if (b.upTo === null) break
    lower = b.upTo
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) }
}

const DAY_MS = 86_400_000
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function prsiForYear(gross: number, year: number, rules: TaxRules['prsi']) {
  const weekly = gross / 52
  const exemption = need(rules.weeklyExemption)
  const creditMax = need(rules.creditMax)
  const taperFrom = need(rules.creditTaperFrom)
  const creditUpTo = need(rules.creditUpTo)
  const divisor = need(rules.creditTaperDivisor)
  const ratePeriods = need(rules.ratePeriods)

  const weeklyCredit =
    weekly > exemption && weekly <= creditUpTo ? Math.max(0, creditMax - Math.max(0, weekly - taperFrom) / divisor) : 0

  const yearStart = Date.UTC(year, 0, 1)
  const yearEnd = Date.UTC(year + 1, 0, 1)
  const daysInYear = (yearEnd - yearStart) / DAY_MS

  const periods = ratePeriods.map((p, i) => {
    const start = Math.max(utc(p.from), yearStart)
    const end = i + 1 < ratePeriods.length ? utc(ratePeriods[i + 1].from) : yearEnd
    const days = Math.round((end - start) / DAY_MS)
    const weeklyCharge = weekly > exemption ? Math.max(0, weekly * p.rate - weeklyCredit) : 0
    return {
      from: isoDay(start),
      to: isoDay(end - DAY_MS),
      days,
      rate: p.rate,
      amount: weeklyCharge * 52 * (days / daysInYear),
    }
  })
  return { weeklyEarnings: weekly, weeklyCredit, periods, total: periods.reduce((s, p) => s + p.amount, 0) }
}

export function calcNetPay(input: TaxInput, rules: TaxRules): TaxResult | TaxUnavailable {
  const gross = Math.max(0, input.grossAnnual)
  if (input.status === 'casado_duas_rendas' && input.spouseGrossAnnual === null) {
    return { ok: false, reason: 'Informe a renda do cônjuge.' }
  }
  try {
    const it = rules.incomeTax
    const married = input.status === 'casado_uma_renda' || input.status === 'casado_duas_rendas'
    const spouse = input.status === 'casado_duas_rendas' ? Math.max(0, input.spouseGrossAnnual ?? 0) : 0

    let band: number
    const credits: { label: string; amount: number }[] = []
    /** Crédito de empregado de uma pessoa: o menor entre o máximo e a fração da renda PAYE. */
    const employeeCredit = (income: number) =>
      Math.min(need(it.credits.employee), need(it.credits.employee_income_rate) * income)
    switch (input.status) {
      case 'solteiro':
        band = need(it.bands.solteiro)
        credits.push({ label: 'Crédito pessoal', amount: need(it.credits.personal_single) })
        credits.push({ label: 'Crédito de empregado (PAYE)', amount: employeeCredit(gross) })
        break
      case 'pai_mae_solteiro':
        band = need(it.bands.pai_mae_solteiro)
        credits.push({ label: 'Crédito pessoal', amount: need(it.credits.personal_single) })
        credits.push({ label: 'Crédito de empregado (PAYE)', amount: employeeCredit(gross) })
        credits.push({ label: 'Single Person Child Carer Credit', amount: need(it.credits.spcc) })
        break
      case 'casado_uma_renda':
        band = need(it.bands.casado_uma_renda)
        credits.push({ label: 'Crédito pessoal (casado)', amount: need(it.credits.personal_married) })
        credits.push({ label: 'Crédito de empregado (PAYE)', amount: employeeCredit(gross) })
        break
      case 'casado_duas_rendas':
        band = need(it.bands.casado_duas_rendas_base) + Math.min(spouse, need(it.bands.casado_duas_rendas_max_increase))
        credits.push({ label: 'Crédito pessoal (casado)', amount: need(it.credits.personal_married) })
        credits.push({ label: 'Crédito de empregado (PAYE) — você', amount: employeeCredit(gross) })
        credits.push({ label: 'Crédito de empregado (PAYE) — cônjuge', amount: employeeCredit(spouse) })
        break
    }
    if (input.extraCredits > 0) credits.push({ label: 'Outros créditos informados', amount: input.extraCredits })

    const taxable = gross + spouse
    const standardRate = need(it.standardRate)
    const higherRate = need(it.higherRate)
    const grossTax = Math.min(taxable, band) * standardRate + Math.max(0, taxable - band) * higherRate
    const creditTotal = credits.reduce((s, c) => s + c.amount, 0)
    const afterCredits = Math.max(0, grossTax - creditTotal)
    const rentCap = married ? need(it.rentCredit.max_couple) : need(it.rentCredit.max_single)
    const rentCredit = Math.min(Math.max(0, input.annualRent) * need(it.rentCredit.rate), rentCap, afterCredits)
    const householdTax = afterCredits - rentCredit
    const userTax = spouse > 0 ? householdTax * (gross / taxable) : householdTax

    // USC — individual
    const exemption = need(rules.usc.exemption)
    const reduced = input.uscReducedRate && gross <= need(rules.usc.reducedIncomeLimit)
    const exempt = gross <= exemption
    const usc = exempt
      ? { lines: [], total: 0 }
      : applyBands(gross, reduced ? need(rules.usc.reducedBands) : need(rules.usc.bands))

    const prsi = prsiForYear(gross, rules.year, rules.prsi)

    const totalDeductions = userTax + usc.total + prsi.total
    const netAnnual = gross - totalDeductions
    return {
      ok: true,
      year: rules.year,
      rulesStatus: rules.status,
      incomeTax: {
        band,
        standardRate,
        higherRate,
        grossTax,
        credits,
        rentCredit,
        total: userTax,
        coupleTotal: input.status === 'casado_duas_rendas' ? householdTax : null,
      },
      usc: { exempt, reduced, lines: usc.lines, total: usc.total },
      prsi,
      totalDeductions,
      netAnnual,
      netMonthly: netAnnual / 12,
      netWeekly: netAnnual / 52,
      effectiveRate: gross > 0 ? totalDeductions / gross : 0,
    }
  } catch (e) {
    if (e instanceof MissingParam) {
      return { ok: false, reason: `Os parâmetros fiscais de ${rules.year} para esta situação ainda não foram publicados.` }
    }
    throw e
  }
}

import rules2026 from './2026.json'
import rules2027 from './2027.json'
import type { TaxRules } from './types'

/**
 * Regras fiscais por ano. Para atualizar valores (ex.: quando o Finance Bill for promulgado),
 * edite o JSON do ano — o código não precisa mudar.
 */
const RULES: Record<number, TaxRules> = {
  2026: rules2026 as TaxRules,
  2027: rules2027 as TaxRules,
}

export const TAX_YEARS: number[] = Object.keys(RULES).map(Number).sort()

export function getTaxRules(year: number): TaxRules | null {
  return RULES[year] ?? null
}

/** URLs únicas citadas nas regras de um ano. */
export function ruleSources(rules: TaxRules): string[] {
  const found = new Set<string>()
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o)) {
      if (k === 'source' && typeof v === 'string') found.add(v)
      else walk(v)
    }
  }
  walk(rules)
  return [...found]
}

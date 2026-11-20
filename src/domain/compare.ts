export const MAX_COMPARE = 4

export function toggleCompare(
  selected: number[],
  id: number,
  max = MAX_COMPARE,
): { selected: number[]; error: string | null } {
  if (selected.includes(id)) return { selected: selected.filter((x) => x !== id), error: null }
  if (selected.length >= max) return { selected, error: `Compare no máximo ${max} cenários.` }
  return { selected: [...selected, id], error: null }
}

export function pruneSelection(selected: number[], existingIds: number[]): number[] {
  const exists = new Set(existingIds)
  return selected.filter((id) => exists.has(id))
}

/** Melhor(es) item(ns) por um critério; ignora quem não tem dado; precisa de ≥ 2 com dado e alguma diferença. */
export function bestBy<T>(items: T[], score: (t: T) => number | null, prefer: 'min' | 'max'): Set<T> {
  const scored = items
    .map((t) => [t, score(t)] as const)
    .filter((x): x is readonly [T, number] => typeof x[1] === 'number' && Number.isFinite(x[1]))
  if (scored.length < 2) return new Set()
  if (scored.every((x) => x[1] === scored[0][1])) return new Set()
  const target = prefer === 'min' ? Math.min(...scored.map((x) => x[1])) : Math.max(...scored.map((x) => x[1]))
  return new Set(scored.filter((x) => x[1] === target).map((x) => x[0]))
}

const NA = 'Não disponível'

/** Resumo em texto (formato do WhatsApp) da comparação; linhas sem nenhum dado são omitidas. */
export function compareText(names: string[], rows: { label: string; values: string[]; best?: number[] }[]): string {
  const out = ['*Comparação de localidades*', names.join(' × '), '']
  for (const r of rows) {
    if (r.values.every((v) => v.trim() === '' || v === NA)) continue
    out.push(`*${r.label}*`)
    r.values.forEach((v, i) => out.push(`• ${names[i]}: ${v.trim() || NA}${r.best?.includes(i) ? ' ✅' : ''}`))
    out.push('')
  }
  out.push('✅ = melhor da linha. Estimativas do Ireland Life Planner; segurança é tendência da estação da Garda, não estatística oficial.')
  return out.join('\n')
}

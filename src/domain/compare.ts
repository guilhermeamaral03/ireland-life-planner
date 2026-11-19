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

/** Paleta categórica validada (adjacentes, modo claro) — cor acompanha o cenário, não a posição. */
export const COMPARE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']

/** Mantém o slot de cor de quem continua selecionado; novos recebem o menor slot livre. */
export function assignColorSlots(prev: Record<number, number>, selected: number[]): Record<number, number> {
  const next: Record<number, number> = {}
  for (const id of selected) if (id in prev) next[id] = prev[id]
  const used = new Set(Object.values(next))
  for (const id of selected) {
    if (id in next) continue
    let slot = 0
    while (used.has(slot)) slot++
    next[id] = slot
    used.add(slot)
  }
  return next
}

export function pruneSelection(selected: number[], existingIds: number[]): number[] {
  const exists = new Set(existingIds)
  return selected.filter((id) => exists.has(id))
}

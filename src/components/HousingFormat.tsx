import { formatEUR, NOT_AVAILABLE } from '../domain/format'
import type { Part, Range } from '../domain/housing'

const ORIGIN: Record<Part['origin'], string> = { item: '', despesas: 'das suas despesas', incluidas: 'incluídas no aluguel' }

export function RangeText({ r }: { r: Range | null }) {
  if (r === null) return <>{NOT_AVAILABLE}</>
  return <>{r.min === r.max ? formatEUR(r.min) : `${formatEUR(r.min)} – ${formatEUR(r.max)}`}</>
}

/** Valor de uma parcela do custo + de onde ele veio. */
export function PartText({ p, itemLabel }: { p: Part; itemLabel: string }) {
  return (
    <>
      {formatEUR(p.value)} <span className="origin">{p.origin === 'item' ? itemLabel : ORIGIN[p.origin]}</span>
    </>
  )
}

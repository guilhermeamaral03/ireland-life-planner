export const NOT_AVAILABLE = 'Não disponível'

const eur = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' })
const km = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const missing = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v)

export function formatEUR(value: number | null | undefined): string {
  return missing(value) ? NOT_AVAILABLE : eur.format(value)
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Data/hora ISO → texto pt-BR; nunca lança erro com datas inválidas. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? NOT_AVAILABLE : dateTime.format(d)
}

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 0.123 → "12,3%". */
export function formatPercent(value: number | null | undefined): string {
  return missing(value) || !Number.isFinite(value) ? NOT_AVAILABLE : pct.format(value)
}

export function formatKm(value: number | null | undefined): string {
  return missing(value) ? NOT_AVAILABLE : `${km.format(value)} km`
}

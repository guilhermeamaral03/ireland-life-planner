import type { Location, Property } from '../db/types'

/**
 * Leitura de anúncios SEM acessar o site do portal (não há scraping):
 * - do próprio link (o Daft coloca tipo e endereço no endereço da página);
 * - do texto que o usuário copia/compartilha do anúncio.
 */

type PropType = Property['type']

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const titleCase = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** Localidade conhecida citada no texto/slug; vence a que aparece mais ao fim (o bairro vem por último). */
function matchLocation(slug: string, locations: Location[]): number | null {
  const hay = `-${slug}-`
  let best: { id: number; end: number; len: number } | null = null
  for (const l of locations) {
    if (l.id === undefined) continue
    const key = fold(l.name)
    const at = hay.lastIndexOf(`-${key}-`)
    if (at < 0) continue
    const end = at + key.length
    if (!best || end > best.end || (end === best.end && key.length > best.len)) best = { id: l.id, end, len: key.length }
  }
  return best?.id ?? null
}

export interface UrlInfo {
  portal: string
  title: string | null
  type: PropType | null
  locationId: number | null
}

const DAFT_TYPES: Record<string, PropType> = { apartment: 'apartamento', flat: 'apartamento', house: 'casa', studio: 'studio' }

export function parseListingUrl(raw: string, locations: Location[]): UrlInfo | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.replace(/^www\./, '')
  const parts = u.pathname.split('/').filter(Boolean)

  if (host === 'daft.ie' && (parts[0] === 'for-rent' || parts[0] === 'share') && parts[1]) {
    let tokens = parts[1].split('-')
    let type: PropType | null = parts[0] === 'share' ? 'quarto' : null
    if (parts[0] === 'for-rent' && DAFT_TYPES[tokens[0]]) {
      type = DAFT_TYPES[tokens[0]]
      tokens = tokens.slice(1)
    }
    const slug = tokens.join('-')
    const address = slug.replace(/-co-cork$/, '')
    return { portal: 'Daft', title: titleCase(address) || null, type, locationId: matchLocation(slug, locations) }
  }

  // outros portais: só tenta reconhecer a localidade no endereço
  return { portal: host, title: null, type: null, locationId: matchLocation(fold(u.pathname), locations) }
}

export interface TextInfo {
  rent?: number
  billsIncluded?: boolean
  type?: PropType
  url?: string
  /** Avisos do que foi presumido (sempre mostrados ao usuário). */
  notes: string[]
}

const money = (s: string) => Number(s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
const eur = (n: number) => `€ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`

const PRICE =
  /€\s?(\d[\d.,]*)(?:\s*(?:-|–|to|até)\s*€?\s?(\d[\d.,]*))?\s*(per\s+month|a\s+month|monthly|pcm|p\/m|\/\s*month|\/\s*mo\b|per\s+week|a\s+week|weekly|pw\b|p\/w|\/\s*week)?/gi

export function parseListingText(text: string): TextInfo {
  const out: TextInfo = { notes: [] }

  const url = text.match(/https?:\/\/\S+/)?.[0]
  if (url) out.url = url.replace(/[).,;]+$/, '')

  const prices = [...text.matchAll(PRICE)].filter((m) => money(m[1]) > 0)
  const chosen = prices.find((m) => m[3]) ?? prices[0]
  if (chosen) {
    const a = money(chosen[1])
    const b = chosen[2] ? money(chosen[2]) : null
    const low = b !== null ? Math.min(a, b) : a
    const weekly = !!chosen[3] && /week|pw|p\/w/i.test(chosen[3])
    if (b !== null && b !== a) out.notes.push(`O anúncio traz uma faixa (${eur(Math.min(a, b))} – ${eur(Math.max(a, b))}); usei o menor valor.`)
    if (weekly) {
      out.rent = Math.round(((low * 52) / 12) * 100) / 100
      out.notes.push(`Convertido de ${eur(low)} por semana.`)
    } else {
      out.rent = low
      if (!chosen[3]) out.notes.push('O anúncio não diz se o valor é mensal; considerei mensal.')
    }
  }

  if (/bills?\s+(are\s+)?not\s+included|excluding\s+bills|plus\s+bills|bills\s+extra|\+\s*bills/i.test(text)) out.billsIncluded = false
  else if (/(all\s+)?bills\s+(are\s+)?incl(uded|\.)?|all[\s-]inclusive|including\s+(all\s+)?bills/i.test(text)) out.billsIncluded = true

  if (/\b(double|single|twin|en-?suite)\s+room\b|\broom\s+(to\s+rent|available|in\b)|\bhouse\s*share\b/i.test(text)) out.type = 'quarto'
  else if (/\bstudio\b/i.test(text)) out.type = 'studio'
  else if (/\b(apartment|flat)\b/i.test(text)) out.type = 'apartamento'
  else if (/\bhouse\b/i.test(text)) out.type = 'casa'

  return out
}

/**
 * Aplica o que foi lido do link/texto SEM sobrescrever o que o usuário já preencheu.
 * `touched`: campos que o usuário mexeu à mão ('type', 'billsIncluded'), que nunca são trocados.
 */
export function fillFromListing(
  p: Property,
  fromUrl: UrlInfo | null,
  fromText: TextInfo | null,
  touched: Set<string>,
): { property: Property; filled: string[] } {
  const next = { ...p }
  const filled: string[] = []
  if (!next.title.trim() && fromUrl?.title) {
    next.title = fromUrl.title
    filled.push('título')
  }
  const type = fromUrl?.type ?? fromText?.type ?? null
  if (type && !touched.has('type') && next.type !== type) {
    next.type = type
    filled.push('tipo')
  }
  if (next.locationId === null && fromUrl?.locationId != null) {
    next.locationId = fromUrl.locationId
    filled.push('localidade')
  }
  if (!(next.rent > 0) && fromText?.rent) {
    next.rent = fromText.rent
    filled.push('aluguel')
  }
  if (fromText?.billsIncluded !== undefined && !touched.has('billsIncluded') && next.billsIncluded !== fromText.billsIncluded) {
    next.billsIncluded = fromText.billsIncluded
    filled.push('contas incluídas')
  }
  if (!next.url.trim() && fromText?.url) {
    next.url = fromText.url
    filled.push('link')
  }
  return { property: next, filled }
}

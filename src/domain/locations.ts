import type { Location } from '../db/types'
import { validCoords, type LatLng } from './geo'

const none = () => ({ value: null, source: null, date: null })

/** Campos que o usuário preenche; todos vazios por padrão (nada inventado). */
export function blankLocationFields() {
  return {
    favorite: false,
    description: '',
    infrastructure: '',
    publicTransport: '',
    supermarkets: '',
    services: '',
    residentialProfile: '',
    notes: '',
    rentRange: none(),
    transportMonthly: none(),
    carRoute: none(),
    transitMinutes: none(),
    carDependency: none(),
    links: [] as string[],
    gardaStation: null as Location['gardaStation'],
  }
}

/** Completa registros antigos com os campos mais novos (vazios). */
export function normalizeLocation(l: Location): Location {
  return {
    ...blankLocationFields(),
    ...l,
    transportMonthly: l.transportMonthly ?? { value: null, source: null, date: null },
    gardaStation: l.gardaStation ?? null,
  }
}

export function newLocation(name: string, lat: number, lng: number): Location {
  return {
    name: name.trim(),
    lat,
    lng,
    coordSource: 'Posição marcada no mapa pelo usuário',
    builtIn: false,
    isReference: false,
    ...blankLocationFields(),
  }
}

const TEXT_FIELDS = [
  'description',
  'infrastructure',
  'publicTransport',
  'supermarkets',
  'services',
  'residentialProfile',
  'notes',
] as const

/** Localidade inicial que o usuário ainda não alterou (rota de carro é calculada, não conta). */
export function isUntouched(l: Location, seed?: Location): boolean {
  if (!l.builtIn || l.favorite) return false
  if (TEXT_FIELDS.some((f) => (l[f] ?? '').trim() !== '')) return false
  if (l.rentRange?.value != null || l.transitMinutes?.value != null || l.carDependency?.value != null) return false
  if (l.transportMonthly?.value != null) return false
  if ((l.links ?? []).length > 0) return false
  if (l.gardaStation?.origin === 'usuario') return false
  if (seed && (seed.lat !== l.lat || seed.lng !== l.lng || seed.name !== l.name)) return false
  return true
}

/** Antes de salvar: se a posição mudou, a rota de carro antiga deixa de valer (será recalculada). */
export function prepareLocationSave(current: Location, draft: Location): Location {
  const moved = current.lat !== draft.lat || current.lng !== draft.lng
  return {
    ...draft,
    name: draft.name.trim(),
    carRoute: moved ? { value: null, source: null, date: null } : current.carRoute,
  }
}

export function validateLocationEdit(
  current: Location,
  draft: Location,
  rent: { min: number | null; max: number | null },
): string | null {
  if (!draft.name.trim()) return 'Informe o nome.'
  if (!validCoords(draft.lat, draft.lng)) return 'Coordenadas inválidas (latitude −90 a 90, longitude −180 a 180).'
  if (current.isReference && (current.lat !== draft.lat || current.lng !== draft.lng)) {
    return 'Cork City é a referência das distâncias; a posição não pode ser alterada.'
  }
  if ((rent.min === null) !== (rent.max === null)) return 'Informe o aluguel mínimo e o máximo (ou deixe os dois vazios).'
  if (rent.min !== null && rent.max !== null && rent.min > rent.max) return 'O aluguel mínimo não pode ser maior que o máximo.'
  return null
}

export function transitUrl(from: LatLng, to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=transit`
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function filterLocations(
  list: Location[],
  f: { favorites: boolean; withRent: boolean; query: string },
): Location[] {
  const q = fold(f.query)
  return list.filter(
    (l) =>
      (!f.favorites || l.favorite) &&
      (!f.withRent || l.rentRange?.value != null) &&
      (q === '' || fold(l.name).includes(q)),
  )
}

/** Mensagem após calcular as rotas em lote. */
export function routesSummary(filled: number, failed: string[]): string {
  const ok =
    filled === 0 ? 'Nenhuma rota nova calculada.' : `${filled} ${filled === 1 ? 'rota calculada' : 'rotas calculadas'} (OSRM, sem trânsito).`
  return failed.length ? `${ok} Sem rota: ${failed.join(', ')}.` : ok
}

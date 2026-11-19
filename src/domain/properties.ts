import { validCoords } from './geo'
import type { Property } from '../db/types'

const none = () => ({ value: null, source: null, date: null })

export function emptyProperty(): Property {
  return {
    title: '',
    url: '',
    locationId: null,
    address: '',
    lat: null,
    lng: null,
    type: 'quarto',
    rent: 0,
    deposit: null,
    billsIncluded: false,
    billsMonthly: null,
    residents: null,
    listedAt: null,
    carRoute: none(),
    transitMinutes: none(),
    transportMonthly: null,
    notes: '',
    favorite: false,
  }
}

export const PROPERTY_TYPES: Record<Property['type'], string> = {
  quarto: 'Quarto',
  studio: 'Studio',
  apartamento: 'Apartamento',
  casa: 'Casa',
}

const neg = (v: number | null) => v !== null && v < 0

export function validateProperty(p: Property): string | null {
  if (!p.title.trim()) return 'Informe o título do anúncio.'
  if (!(p.rent > 0)) return 'Informe o aluguel mensal (a sua parte).'
  if ([p.deposit, p.billsMonthly, p.transportMonthly, p.residents].some(neg)) return 'Valores não podem ser negativos.'
  if ((p.lat === null) !== (p.lng === null)) return 'Informe latitude e longitude (ou deixe as duas vazias).'
  if (p.lat !== null && p.lng !== null && !validCoords(p.lat, p.lng)) {
    return 'Coordenadas inválidas (latitude −90 a 90, longitude −180 a 180).'
  }
  if (p.url.trim() && !/^https?:\/\//i.test(p.url.trim())) return 'O link deve começar com http:// ou https://.'
  return null
}

/** Antes de salvar: se a posição mudou (ou foi removida), a rota de carro antiga deixa de valer. */
export function prepareProperty(current: Property | null, draft: Property): Property {
  const moved = !current || current.lat !== draft.lat || current.lng !== draft.lng
  return {
    ...draft,
    title: draft.title.trim(),
    url: draft.url.trim(),
    carRoute: moved ? { value: null, source: null, date: null } : current.carRoute,
  }
}

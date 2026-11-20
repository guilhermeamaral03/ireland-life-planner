import { describe, expect, it } from 'vitest'
import { INITIAL_LOCATIONS } from '../data/seed/locations'
import type { Location } from '../db/types'
import { emptyProperty } from './properties'
import { fillFromListing, parseListingText, parseListingUrl } from './listing'

const locs: Location[] = INITIAL_LOCATIONS.map((l, i) => ({ ...l, id: i + 1 }))
const idOf = (name: string) => locs.find((l) => l.name === name)!.id

describe('parseListingUrl (formatos reais do Daft)', () => {
  it('apartamento: tipo e título a partir do link', () => {
    const r = parseListingUrl('https://www.daft.ie/for-rent/apartment-12-deerpark-court-friars-walk-pouladuff-co-cork/6496553', locs)
    expect(r).toMatchObject({ portal: 'Daft', type: 'apartamento', title: '12 Deerpark Court Friars Walk Pouladuff', locationId: null })
  })

  it('quarto (/share/) e localidade conhecida', () => {
    const r = parseListingUrl('https://www.daft.ie/share/cork-road-carrigaline-co-cork/6716531', locs)
    expect(r).toMatchObject({ type: 'quarto', title: 'Cork Road Carrigaline', locationId: idOf('Carrigaline') })
  })

  it('casa em Rochestown', () => {
    const r = parseListingUrl('https://www.daft.ie/for-rent/house-91-lissadell-maryborough-hill-rochestown-co-cork/6664532', locs)
    expect(r).toMatchObject({ type: 'casa', locationId: idOf('Rochestown') })
  })

  it('usa a localidade mais ao fim do endereço (rua com nome de bairro)', () => {
    const r = parseListingUrl('https://www.daft.ie/share/south-douglas-road-cork-city-centre/6524947', locs)
    expect(r?.locationId).toBe(idOf('Cork City'))
  })

  it('link sem tipo no início: tipo fica em branco', () => {
    expect(parseListingUrl('https://www.daft.ie/for-rent/91-evergreen-road-cork-city-centre-co-cork/6607822', locs)?.type).toBeNull()
  })

  it('outros portais: só a localidade, se aparecer no link', () => {
    const r = parseListingUrl('https://www.myhome.ie/rentals/brochure/main-street-blarney-cork/4711', locs)
    expect(r).toMatchObject({ portal: 'myhome.ie', type: null, locationId: idOf('Blarney'), title: null })
  })

  it('texto que não é link → null', () => {
    expect(parseListingUrl('apartamento bom', locs)).toBeNull()
    expect(parseListingUrl('', locs)).toBeNull()
  })
})

describe('parseListingText', () => {
  it('aluguel mensal, contas incluídas e quarto', () => {
    expect(parseListingText('€1,100 per month\nDouble room with private toilet\nAll bills included')).toMatchObject({
      rent: 1100,
      billsIncluded: true,
      type: 'quarto',
    })
  })

  it('aluguel semanal convertido para mensal', () => {
    const r = parseListingText('Single room €205 per week')
    expect(r.rent).toBeCloseTo(888.33, 2)
    expect(r.notes).toContain('Convertido de € 205 por semana.')
  })

  it('casa, contas à parte', () => {
    expect(parseListingText('Rent: €2,500 monthly. 3 bed house. Bills not included.')).toMatchObject({
      rent: 2500,
      billsIncluded: false,
      type: 'casa',
    })
  })

  it('faixa de preço: usa o menor e avisa', () => {
    const r = parseListingText('Three double rooms €1,000 to €1,100 per month')
    expect(r.rent).toBe(1000)
    expect(r.notes).toContain('O anúncio traz uma faixa (€ 1.000 – € 1.100); usei o menor valor.')
  })

  it('pega o link de dentro do texto compartilhado', () => {
    expect(parseListingText('Check out this property on Daft https://www.daft.ie/share/x-co-cork/123 ').url).toBe(
      'https://www.daft.ie/share/x-co-cork/123',
    )
  })

  it('texto sem nada reconhecível → vazio', () => {
    expect(parseListingText('olá')).toEqual({ notes: [] })
  })
})

describe('fillFromListing — só preenche o que está vazio', () => {
  const base = { ...emptyProperty() }
  it('preenche campos vazios e lista o que preencheu', () => {
    const r = fillFromListing(base, { portal: 'Daft', title: 'Cork Road Carrigaline', type: 'apartamento', locationId: 7 }, { rent: 900, billsIncluded: true, notes: [] }, new Set())
    expect(r.property).toMatchObject({ title: 'Cork Road Carrigaline', type: 'apartamento', locationId: 7, rent: 900, billsIncluded: true })
    expect(r.filled).toEqual(['título', 'tipo', 'localidade', 'aluguel', 'contas incluídas'])
  })
  it('não sobrescreve o que o usuário digitou', () => {
    const typed = { ...base, title: 'Meu título', rent: 1000, locationId: 2, type: 'casa' as const }
    const r = fillFromListing(typed, { portal: 'Daft', title: 'X', type: 'quarto', locationId: 7 }, { rent: 900, notes: [] }, new Set(['type']))
    expect(r.property).toMatchObject({ title: 'Meu título', rent: 1000, locationId: 2, type: 'casa' })
    expect(r.filled).toEqual([])
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_LOCATIONS } from '../data/seed/locations'
import { clearAllData, exportBackup, importBackup } from '../db/backup'
import { db, DEFAULT_SETTINGS, ensureSeeded, hasUserData } from '../db/db'
import { filterLocations, isUntouched, newLocation, prepareLocationSave, transitUrl, validateLocationEdit } from './locations'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('localidades iniciais', () => {
  it('31 localidades (6 originais + 25 novas); só Cork City é referência', () => {
    expect(INITIAL_LOCATIONS).toHaveLength(31)
    expect(INITIAL_LOCATIONS.slice(0, 6).map((l) => l.name)).toEqual(['Cork City', 'Ballincollig', 'Cobh', 'Midleton', 'Bandon', 'Glanmire'])
    expect(INITIAL_LOCATIONS.map((l) => l.name)).toContain('Clonakilty')
    expect(new Set(INITIAL_LOCATIONS.map((l) => l.coordSource)).size).toBe(31)
    expect(INITIAL_LOCATIONS.filter((l) => l.isReference).map((l) => l.name)).toEqual(['Cork City'])
    for (const l of INITIAL_LOCATIONS) {
      expect(l.coordSource).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|relation)\/\d+$/)
      expect(l.description).toBe('')
      expect(l.rentRange.value).toBeNull()
    }
  })

  it('semeadas uma vez; apagar tudo semeia de novo', async () => {
    await ensureSeeded()
    await ensureSeeded()
    expect(await db.locations.count()).toBe(31)
    await db.locations.where('name').equals('Bandon').delete()
    await ensureSeeded()
    expect(await db.locations.count()).toBe(30) // usuário excluiu: não volta
    await clearAllData()
    expect(await db.locations.count()).toBe(31)
  })

  it('aparelho que já tinha as 6 recebe só as novas; excluída não volta', async () => {
    // estado de quem usou a versão anterior: 6 localidades, flag antiga, Bandon excluída
    await db.locations.bulkAdd(INITIAL_LOCATIONS.slice(0, 6).filter((l) => l.name !== 'Bandon').map((l) => structuredClone(l)))
    await db.settings.put({ ...DEFAULT_SETTINGS, locationsSeeded: true } as never)
    await ensureSeeded()
    expect(await db.locations.count()).toBe(30)
    expect(await db.locations.where('name').equals('Bandon').count()).toBe(0)
    await ensureSeeded()
    expect(await db.locations.count()).toBe(30)
  })

  it('backup antigo sem marcação, com as 6, recebe as novas sem duplicar', async () => {
    await db.locations.bulkAdd(INITIAL_LOCATIONS.slice(0, 6).map((l) => structuredClone(l)))
    await ensureSeeded()
    expect(await db.locations.count()).toBe(31)
    const backup = await exportBackup()
    backup.tables.settings = (backup.tables.settings as object[]).map((s) => ({ ...s, locationsSeedVersion: undefined, locationsSeeded: undefined }))
    await importBackup(backup)
    expect(await db.locations.count()).toBe(31)
  })

  it('lembrete de backup ignora localidades iniciais intactas', async () => {
    await ensureSeeded()
    expect(await hasUserData()).toBe(false)
    const cobh = await db.locations.where('name').equals('Cobh').first()
    await db.locations.update(cobh!.id!, { favorite: true })
    expect(await hasUserData()).toBe(true)
  })
})

describe('validação e preparo para salvar', () => {
  const route = { value: { km: 9, minutes: 14 }, source: 'x', date: '2026-11-19', status: 'estimado' as const }
  const bal = { ...INITIAL_LOCATIONS[1], id: 2, carRoute: route }
  const cork = { ...INITIAL_LOCATIONS[0], id: 1 }

  it('mover a posição apaga a rota antiga (vai ser recalculada)', () => {
    const moved = prepareLocationSave(bal, { ...bal, lat: 51.7 })
    expect(moved.carRoute.value).toBeNull()
    expect(prepareLocationSave(bal, { ...bal, notes: 'x' }).carRoute).toEqual(route)
  })

  it('referência não pode mudar de posição', () => {
    expect(validateLocationEdit(cork, { ...cork, lat: 51.95 }, { min: null, max: null })).toBe(
      'Cork City é a referência das distâncias; a posição não pode ser alterada.',
    )
  })

  it('aluguel: os dois valores ou nenhum; mínimo ≤ máximo', () => {
    expect(validateLocationEdit(bal, bal, { min: null, max: 1200 })).toBe('Informe o aluguel mínimo e o máximo (ou deixe os dois vazios).')
    expect(validateLocationEdit(bal, bal, { min: 1500, max: 1200 })).toBe('O aluguel mínimo não pode ser maior que o máximo.')
    expect(validateLocationEdit(bal, bal, { min: 1000, max: 1200 })).toBeNull()
    expect(validateLocationEdit(bal, bal, { min: null, max: null })).toBeNull()
  })

  it('nome e coordenadas', () => {
    expect(validateLocationEdit(bal, { ...bal, name: ' ' }, { min: null, max: null })).toBe('Informe o nome.')
    expect(validateLocationEdit(bal, { ...bal, lat: NaN }, { min: null, max: null })).toMatch(/^Coordenadas inválidas/)
  })
})

describe('funções de localidade', () => {
  it('newLocation e isUntouched', () => {
    const l = newLocation('Carrigaline', 51.81, -8.39)
    expect(l.builtIn).toBe(false)
    expect(l.isReference).toBe(false)
    expect(isUntouched(INITIAL_LOCATIONS[1])).toBe(true)
    expect(isUntouched({ ...INITIAL_LOCATIONS[1], notes: 'gostei' })).toBe(false)
    expect(isUntouched(l)).toBe(false)
  })

  it('transitUrl', () => {
    expect(transitUrl({ lat: 51.88, lng: -8.59 }, { lat: 51.9, lng: -8.47 })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=51.88,-8.59&destination=51.9,-8.47&travelmode=transit',
    )
  })

  it('filtros', () => {
    const list = INITIAL_LOCATIONS.map((l, i) => ({ ...l, id: i + 1, favorite: l.name === 'Midleton' }))
    expect(filterLocations(list, { favorites: false, withRent: false, query: 'CÓBH' }).map((l) => l.name)).toEqual(['Cobh'])
    expect(filterLocations(list, { favorites: true, withRent: false, query: '' }).map((l) => l.name)).toEqual(['Midleton'])
    expect(filterLocations(list, { favorites: false, withRent: true, query: '' })).toEqual([])
  })
})

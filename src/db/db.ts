import Dexie, { type EntityTable } from 'dexie'
import { INITIAL_LOCATIONS, LOCATIONS_SEED_VERSION, SEED_BATCHES } from '../data/seed/locations'
import { isUntouched } from '../domain/locations'
import { DEFAULT_SAFETY_CRITERIA } from '../domain/safety'
import { INITIAL_CATEGORIES } from './seed'
import type { Category, CrimeStation, Expense, Location, Property, SafetyRecord, Scenario, Settings } from './types'

export const TABLE_NAMES = [
  'settings', 'categories', 'expenses', 'scenarios', 'locations', 'safetyRecords', 'properties', 'crimeStations',
] as const
export type TableName = (typeof TABLE_NAMES)[number]

export const db = new Dexie('ireland-life-planner') as Dexie & {
  settings: EntityTable<Settings, 'id'>
  categories: EntityTable<Category, 'id'>
  expenses: EntityTable<Expense, 'id'>
  scenarios: EntityTable<Scenario, 'id'>
  locations: EntityTable<Location, 'id'>
  safetyRecords: EntityTable<SafetyRecord, 'id'>
  properties: EntityTable<Property, 'id'>
  crimeStations: EntityTable<CrimeStation, 'code'>
}

db.version(1).stores({
  settings: 'id',
  categories: '++id,name',
  expenses: '++id,categoryId',
  scenarios: '++id',
  locations: '++id',
  safetyRecords: '++id,locationId',
  properties: '++id,locationId,favorite',
})
db.version(2).stores({ locations: '++id,name' })
db.version(3).stores({ crimeStations: 'code' })

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  taxYear: null,
  grossAnnual: null,
  taxStatus: null,
  payFrequency: 'mensal',
  prsiClass: 'A',
  uscReducedRate: false,
  spouseGrossAnnual: null,
  rentMonthlyOverride: null,
  extraCredits: [],
  initialReserve: null,
  projectionMonths: 24,
  lastBackupAt: null,
  locationsSeedVersion: 0,
  safetyCriteria: { ...DEFAULT_SAFETY_CRITERIA, offences: [...DEFAULT_SAFETY_CRITERIA.offences] },
}

/** Cria as categorias iniciais apenas se ainda não houver nenhuma. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd(INITIAL_CATEGORIES.map((c) => ({ ...c })))
    }
  })
  await db.transaction('rw', db.settings, db.locations, async () => {
    const s = await db.settings.get('main')
    const legacy = s as (Settings & { locationsSeeded?: boolean }) | undefined
    let done = s?.locationsSeedVersion ?? (legacy?.locationsSeeded ? 1 : 0)
    if (done >= LOCATIONS_SEED_VERSION) return
    // dados antigos sem marcação, mas já com localidades (ex.: backup): o lote 1 já foi aplicado
    if (done === 0 && (await db.locations.count()) > 0) done = 1
    const existing = new Set((await db.locations.toArray()).map((l) => l.coordSource))
    const toAdd = SEED_BATCHES.filter((b) => b.version > done)
      .flatMap((b) => b.locations)
      .filter((l) => !existing.has(l.coordSource))
      .map((l) => structuredClone(l))
    if (toAdd.length > 0) await db.locations.bulkAdd(toAdd)
    const { locationsSeeded: _legacy, ...rest } = legacy ?? {}
    await db.settings.put({ ...DEFAULT_SETTINGS, ...rest, id: 'main', locationsSeedVersion: LOCATIONS_SEED_VERSION })
  })
}

/** Há algo cadastrado pelo usuário (além das categorias iniciais e configurações vazias)? */
export async function hasUserData(): Promise<boolean> {
  const counts = await Promise.all([
    db.expenses.count(),
    db.scenarios.count(),
    db.locations.filter((l) => !isUntouched(l, INITIAL_LOCATIONS.find((x) => x.coordSource === l.coordSource))).count(),
    db.safetyRecords.count(),
    db.properties.count(),
    db.categories.filter((c) => !c.builtIn).count(),
  ])
  if (counts.some((n) => n > 0)) return true
  const s = await db.settings.get('main')
  return s?.grossAnnual != null || s?.initialReserve != null
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch, id: 'main' as const }
    await db.settings.put(next)
    return next
  })
}

export async function getSettings(): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('main')
    if (existing) return { ...DEFAULT_SETTINGS, ...existing }
    await db.settings.put({ ...DEFAULT_SETTINGS })
    return { ...DEFAULT_SETTINGS }
  })
}

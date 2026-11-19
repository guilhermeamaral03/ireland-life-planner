import { describe, expect, it } from 'vitest'
import { INITIAL_LOCATIONS } from '../data/seed/locations'
import type { CrimeStation, Location } from '../db/types'
import { autoMatchStations, classifyLocation, classifyStation, DEFAULT_SAFETY_CRITERIA, yearlyTotals } from './safety'

/** Estação com um único tipo de ofensa ('07') e os totais dados, a partir de 2022. */
const station = (totals: (number | null)[], code = 'X1', name = 'Teste'): CrimeStation => ({
  code,
  name,
  division: 'Cork City Division',
  counts: Object.fromEntries(totals.map((t, i) => [String(2022 + i), { '07': t, '08': 0 }])),
  csoUpdated: '2026-10-01',
  fetchedAt: '2026-11-19',
})
const crit = { ...DEFAULT_SAFETY_CRITERIA, offences: ['07', '08'] }

describe('classifyStation', () => {
  it('alta acima do limite → atenção elevada', () => {
    const r = classifyStation(station([100, 100, 100, 120]), crit)
    expect(r.level).toBe('elevada')
    expect(r.changePct).toBeCloseTo(20, 6)
    expect(r.latestYear).toBe(2025)
    expect(r.baseline).toBe(100)
    expect(r.reason).toBe('Estação Teste — 2025: 120 ocorrências vs. média 2022–2024 de 100 (+20,0%)')
  })
  it('entre os limites → moderada; abaixo → baixa; queda → baixa', () => {
    expect(classifyStation(station([100, 100, 100, 110]), crit).level).toBe('moderada')
    expect(classifyStation(station([100, 100, 100, 103]), crit).level).toBe('baixa')
    expect(classifyStation(station([100, 100, 100, 80]), crit).level).toBe('baixa')
  })
  it('exatamente no limite não sobe de nível', () => {
    expect(classifyStation(station([100, 100, 100, 115]), crit).level).toBe('moderada')
    expect(classifyStation(station([100, 100, 100, 105]), crit).level).toBe('baixa')
  })
  it('ano sem dado quebra a sequência → dados insuficientes', () => {
    const r = classifyStation(station([100, null, 100, 120]), crit)
    expect(r.level).toBe('insuficiente')
    expect(r.changePct).toBeNull()
  })
  it('usa a sequência mais recente quando há anos antigos sem dado', () => {
    expect(classifyStation(station([null, 100, 100, 100, 120]), crit).level).toBe('elevada')
  })
  it('ano mais recente sem dado para os tipos escolhidos → insuficiente (não usa ano antigo calado)', () => {
    const r = classifyStation(station([100, 100, 100, 120, null]), crit)
    expect(r.level).toBe('insuficiente')
    expect(r.reason).toBe('Estação Teste: 2026 sem dado para os tipos escolhidos.')
  })

  it('média zero e estação ausente → dados insuficientes', () => {
    expect(classifyStation(station([0, 0, 0, 5]), crit).level).toBe('insuficiente')
    expect(classifyStation(undefined, crit).level).toBe('insuficiente')
  })
  it('critério configurável', () => {
    expect(classifyStation(station([100, 100, 100, 120]), { ...crit, highPct: 25 }).level).toBe('moderada')
  })
})

describe('classifyLocation', () => {
  const loc = (gardaStation: Location['gardaStation']) => ({ ...INITIAL_LOCATIONS[1], id: 2, gardaStation })
  const byCode = new Map([['X1', station([100, 100, 100, 120])]])
  it('sem estação, estação sumida e estação presente', () => {
    expect(classifyLocation(loc(null), byCode, crit).reason).toBe('Nenhuma estação da Garda associada a esta localidade.')
    const gone = classifyLocation(loc({ code: 'ZZ', origin: 'usuario' }), byCode, crit)
    expect(gone.level).toBe('insuficiente')
    expect(gone.reason).toBe('A estação associada não está nos dados atuais do CSO — atualize os dados ou escolha outra.')
    expect(classifyLocation(loc({ code: 'X1', origin: 'nome' }), byCode, crit).level).toBe('elevada')
  })
})

describe('yearlyTotals', () => {
  it('soma os tipos escolhidos; null se algum faltar', () => {
    expect(yearlyTotals(station([5, null]), ['07', '08'])).toEqual([
      { year: 2022, total: 5 },
      { year: 2023, total: null },
    ])
  })
})

describe('autoMatchStations', () => {
  it('casa só nomes iguais e localidades sem estação', () => {
    const locs: Location[] = INITIAL_LOCATIONS.map((l, i) => ({ ...l, id: i + 1, gardaStation: null }))
    const cobh = locs.find((l) => l.name === 'Cobh')!
    cobh.gardaStation = { code: 'manual', origin: 'usuario' }
    const stations = [station([1], '31201', 'Ballincollig'), station([1], '32103', 'Cobh'), station([1], '31101', 'Anglesea Street')]
    const m = autoMatchStations(locs, stations)
    expect(m.get(locs.find((l) => l.name === 'Ballincollig')!.id!)).toBe('31201')
    expect(m.has(cobh.id!)).toBe(false)
    expect(m.has(locs.find((l) => l.name === 'Cork City')!.id!)).toBe(false)
    expect(m.size).toBe(1)
  })
})

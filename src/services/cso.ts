import { db } from '../db/db'
import type { CrimeStation } from '../db/types'

/** Tabela oficial CJA11 do CSO (PxStat), formato JSON-stat 2.0. Dados públicos; nada do usuário é enviado. */
export const CSO_CJA11_URL =
  'https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CJA11/JSON-stat/2.0/en'
export const CSO_CJA11_PAGE = 'https://data.cso.ie/table/CJA11'

/** Rótulos em português dos tipos de ofensa da classificação irlandesa (ICCS). */
export const OFFENCES: Record<string, string> = {
  '03': 'Agressões, ameaças e assédio',
  '04': 'Atos perigosos ou negligentes',
  '05': 'Sequestro',
  '06': 'Roubo e extorsão',
  '07': 'Arrombamento (burglary)',
  '08': 'Furto',
  '09': 'Fraude',
  '10': 'Drogas',
  '11': 'Armas e explosivos',
  '12': 'Dano a patrimônio',
  '13': 'Ordem pública',
  '14': 'Trânsito',
  '15': 'Contra a justiça e o governo',
  '16': 'Outras',
}

/** Códigos em ordem (objetos JS põem chaves numéricas como "10" antes de "03"). */
export const OFFENCE_CODES: string[] = Object.keys(OFFENCES).sort()

const BAD_FORMAT = 'Formato inesperado da tabela do CSO.'
const CORK = /,\s*(Cork (City|County) Division)\s*\(/

interface Dim {
  label: string
  category: { index: string[] | Record<string, number>; label: Record<string, string> }
}

const keysOf = (d: Dim): string[] =>
  Array.isArray(d.category.index)
    ? d.category.index
    : Object.keys(d.category.index).sort((a, b) => (d.category.index as Record<string, number>)[a] - (d.category.index as Record<string, number>)[b])

export function parseCja11(json: unknown, fetchedAt: string): CrimeStation[] {
  const j = json as { id?: string[]; size?: number[]; dimension?: Record<string, Dim>; value?: (number | null)[]; updated?: string } | null
  if (!j || !Array.isArray(j.id) || !Array.isArray(j.size) || !j.dimension || !Array.isArray(j.value)) throw new Error(BAD_FORMAT)
  const find = (re: RegExp) => j.id!.findIndex((id) => re.test(j.dimension![id]?.label ?? ''))
  const iYear = find(/^year$/i)
  const iStation = find(/garda station/i)
  const iOffence = find(/type of offence/i)
  if (iYear < 0 || iStation < 0 || iOffence < 0) throw new Error(BAD_FORMAT)
  // demais dimensões (ex.: Statistic) precisam ter um único valor
  if (j.size.some((n, i) => ![iYear, iStation, iOffence].includes(i) && n !== 1)) throw new Error(BAD_FORMAT)

  const keys = j.id.map((id) => keysOf(j.dimension![id]))
  const strides = j.size.map((_, i) => j.size!.slice(i + 1).reduce((a, b) => a * b, 1))
  const stationDim = j.dimension[j.id[iStation]]
  const csoUpdated = j.updated ?? ''

  const out: CrimeStation[] = []
  keys[iStation].forEach((code, si) => {
    const label = stationDim.category.label[code] ?? ''
    const m = CORK.exec(label)
    if (!m) return
    const counts: CrimeStation['counts'] = {}
    keys[iYear].forEach((year, yi) => {
      counts[year] = {}
      keys[iOffence].forEach((off, oi) => {
        const v = j.value![yi * strides[iYear] + si * strides[iStation] + oi * strides[iOffence]]
        counts[year][off] = typeof v === 'number' && Number.isFinite(v) ? v : null
      })
    })
    out.push({ code, name: label.split(',')[0].trim(), division: m[1], counts, csoUpdated, fetchedAt })
  })
  return out
}

type FetchFn = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

export async function fetchCja11(
  fetchFn: FetchFn = fetch,
): Promise<{ ok: true; stations: CrimeStation[] } | { ok: false; reason: string }> {
  let json: unknown
  try {
    const res = await fetchFn(CSO_CJA11_URL)
    if (!res.ok) throw new Error('http')
    json = await res.json()
  } catch {
    return { ok: false, reason: 'Não foi possível baixar os dados do CSO (sem internet ou serviço fora do ar).' }
  }
  try {
    const stations = parseCja11(json, new Date().toISOString())
    if (stations.length === 0) return { ok: false, reason: 'A tabela do CSO não trouxe estações de Cork.' }
    return { ok: true, stations }
  } catch {
    return { ok: false, reason: BAD_FORMAT }
  }
}

/** Substitui os dados de estações guardados no aparelho. */
export async function saveStations(stations: CrimeStation[]): Promise<void> {
  await db.transaction('rw', db.crimeStations, async () => {
    await db.crimeStations.clear()
    await db.crimeStations.bulkAdd(stations)
  })
}

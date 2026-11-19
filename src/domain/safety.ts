import type { CrimeStation, Location } from '../db/types'

export type SafetyLevel = 'baixa' | 'moderada' | 'elevada' | 'insuficiente'

export interface SafetyCriteria {
  /** códigos de ofensa somados */
  offences: string[]
  /** quantos anos anteriores formam a média de base */
  baselineYears: number
  /** alta acima disto (%) → atenção moderada */
  moderatePct: number
  /** alta acima disto (%) → atenção elevada */
  highPct: number
}

/** Padrão (spec §18): ofensas do dia a dia — agressão, roubo, arrombamento, furto, dano, ordem pública. */
export const DEFAULT_SAFETY_CRITERIA: SafetyCriteria = {
  offences: ['03', '06', '07', '08', '12', '13'],
  baselineYears: 3,
  moderatePct: 5,
  highPct: 15,
}

export const SAFETY_LABELS: Record<SafetyLevel, string> = {
  baixa: 'Baixa atenção',
  moderada: 'Atenção moderada',
  elevada: 'Atenção elevada',
  insuficiente: 'Dados insuficientes',
}

export const SAFETY_DISCLAIMER =
  'Avaliação do app sobre a tendência da estação — não é nível de segurança nem estatística oficial.'

export function yearlyTotals(st: CrimeStation, offences: string[]): { year: number; total: number | null }[] {
  return Object.keys(st.counts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((year) => {
      const row = st.counts[String(year)] ?? {}
      const vals = offences.map((o) => row[o])
      const total = vals.every((v) => typeof v === 'number') ? (vals as number[]).reduce((a, b) => a + b, 0) : null
      return { year, total }
    })
}

const n1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export interface SafetyResult {
  level: SafetyLevel
  latestYear: number | null
  latest: number | null
  baseline: number | null
  changePct: number | null
  reason: string
}

const insufficient = (reason: string): SafetyResult => ({
  level: 'insuficiente',
  latestYear: null,
  latest: null,
  baseline: null,
  changePct: null,
  reason,
})

export function classifyStation(st: CrimeStation | undefined, c: SafetyCriteria): SafetyResult {
  if (!st) return insufficient('Nenhuma estação da Garda associada a esta localidade.')
  if (c.offences.length === 0) return insufficient('Nenhum tipo de ofensa escolhido nos critérios.')
  const totals = yearlyTotals(st, c.offences)
  const newest = totals[totals.length - 1]
  // não usar um ano antigo calado: o ano mais recente da tabela precisa ter dado
  if (newest && newest.total === null) return insufficient(`Estação ${st.name}: ${newest.year} sem dado para os tipos escolhidos.`)
  // sequência mais recente de anos consecutivos com dado
  let end = totals.length - 1
  while (end >= 0 && totals[end].total === null) end--
  let start = end
  while (start > 0 && totals[start - 1].total !== null && totals[start - 1].year === totals[start].year - 1) start--
  const run = end >= 0 ? totals.slice(start, end + 1) : []
  const need = c.baselineYears + 1
  if (run.length < need) return insufficient(`São necessários ${need} anos seguidos com dados; há ${run.length}.`)

  const last = run[run.length - 1]
  const base = run.slice(-need, -1)
  const baseline = base.reduce((s, r) => s + (r.total as number), 0) / base.length
  if (baseline === 0) return insufficient('Média de base igual a zero — não dá para calcular a variação.')
  const latest = last.total as number
  const changePct = ((latest - baseline) / baseline) * 100
  const level: SafetyLevel = changePct > c.highPct ? 'elevada' : changePct > c.moderatePct ? 'moderada' : 'baixa'
  return {
    level,
    latestYear: last.year,
    latest,
    baseline,
    changePct,
    reason: `Estação ${st.name} — ${last.year}: ${n1(latest)} ocorrências vs. média ${base[0].year}–${base[base.length - 1].year} de ${n1(baseline)} (${pct(changePct)})`,
  }
}

/** Classificação de uma localidade a partir da estação associada. */
export function classifyLocation(l: Location, byCode: Map<string, CrimeStation>, c: SafetyCriteria): SafetyResult {
  if (!l.gardaStation) return insufficient('Nenhuma estação da Garda associada a esta localidade.')
  const st = byCode.get(l.gardaStation.code)
  if (!st) return insufficient('A estação associada não está nos dados atuais do CSO — atualize os dados ou escolha outra.')
  return classifyStation(st, c)
}

/** Lembrete curto exibido junto ao selo fora da página de Segurança. */
export const STATION_AREA_NOTE = 'Dados da área da estação da Garda, que não coincide com os limites da localidade.'

export function validateCriteria(c: SafetyCriteria): string | null {
  if (c.offences.length === 0) return 'Escolha pelo menos um tipo de ofensa.'
  if (!Number.isInteger(c.baselineYears) || c.baselineYears < 2 || c.baselineYears > 5) return 'Anos de base: de 2 a 5.'
  if (!(c.moderatePct >= 0) || !(c.highPct > c.moderatePct)) return 'O limite de atenção elevada deve ser maior que o de moderada (e ambos ≥ 0).'
  return null
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Associação automática: só quando o nome da estação é igual ao da localidade (e ela ainda não tem estação). */
export function autoMatchStations(locations: Location[], stations: CrimeStation[]): Map<number, string> {
  const byName = new Map(stations.map((s) => [fold(s.name), s.code]))
  const out = new Map<number, string>()
  for (const l of locations) {
    if (l.id === undefined || l.gardaStation) continue
    const code = byName.get(fold(l.name))
    if (code) out.set(l.id, code)
  }
  return out
}

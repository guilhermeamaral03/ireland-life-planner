import { Loading } from '../components/Loading'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSafety } from '../app/useSafety'
import { NumberField } from '../components/NumberField'
import { SafetyBadge } from '../components/SafetyBadge'
import { db, saveSettings } from '../db/db'
import type { Location } from '../db/types'
import { formatDateTime } from '../domain/format'
import { normalizeLocation } from '../domain/locations'
import {
  autoMatchStations,
  classifyLocation,
  SAFETY_DISCLAIMER,
  validateCriteria,
  yearlyTotals,
  type SafetyCriteria,
} from '../domain/safety'
import { CSO_CJA11_PAGE, fetchCja11, OFFENCE_CODES, OFFENCES, saveStations } from '../services/cso'
import './SafetyPage.css'

const CHART = '#1f8a5a'
const GRID = '#e0e0dc'
const INK_MUTED = '#66665f'

const LIMITATIONS = [
  'A área atendida por uma estação da Garda não coincide com os limites da localidade.',
  'Não há população por área de estação: os números não são taxa por habitante e não servem para comparar o nível entre estações.',
  'Dados sujeitos a revisão pelo CSO.',
  'Fraude (09) não é comparável antes e depois do 3º trimestre de 2023.',
  'Ocorrências registradas dependem de denúncia: nem todo crime é registrado.',
]

export function SafetyPage() {
  const { stations, byCode, criteria, loaded, reload } = useSafety()
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  const loadLocations = useCallback(async () => {
    const ls = (await db.locations.toArray()).map(normalizeLocation)
    setLocations(ls.sort((a, b) => Number(b.isReference) - Number(a.isReference) || a.name.localeCompare(b.name, 'pt-BR')))
  }, [])
  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const results = useMemo(
    () =>
      new Map(
        (locations ?? []).map((l) => [l.id!, classifyLocation(l, byCode, criteria)]),
      ),
    [locations, byCode, criteria],
  )

  if (!locations || !loaded) return <Loading />

  const download = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await fetchCja11()
      if (!r.ok) {
        setMessage({ type: 'error', text: `${r.reason} Os dados anteriores foram mantidos.` })
        return
      }
      await saveStations(r.stations)
      const matches = autoMatchStations(locations, r.stations)
      await db.transaction('rw', db.locations, async () => {
        for (const [id, code] of matches) await db.locations.update(id, { gardaStation: { code, origin: 'nome' } })
      })
      setMessage({
        type: 'success',
        text: `Dados do CSO atualizados: ${r.stations.length} estações de Cork. ${matches.size} localidade(s) associada(s) automaticamente pelo nome.`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: `Não foi possível salvar os dados no aparelho: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      // recarregar a tela não faz parte do salvamento: falha aqui não vira "não foi possível salvar"
      await Promise.all([reload(), loadLocations()]).catch(() => undefined)
      setBusy(false)
    }
  }

  const setStation = async (l: Location, code: string) => {
    await db.locations.update(l.id!, { gardaStation: code === '' ? null : { code, origin: 'usuario' } })
    await loadLocations()
  }

  const first = stations[0]
  const selected = locations.find((l) => l.id === selectedId) ?? null
  const selStation = selected?.gardaStation ? byCode.get(selected.gardaStation.code) : undefined

  return (
    <div className="page">
      <header className="page-header">
        <h1>Segurança</h1>
        <p>Ocorrências registradas pela Garda (dados oficiais do CSO) e uma avaliação transparente da tendência.</p>
      </header>

      <div className="alert alert-warning">
        <strong>{SAFETY_DISCLAIMER}</strong> Critério atual: último ano comparado com a média dos {criteria.baselineYears} anos
        anteriores — alta acima de {criteria.highPct}% = Atenção elevada; acima de {criteria.moderatePct}% = Atenção moderada;
        demais = Baixa atenção.
      </div>

      {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}

      <section className="card">
        <h2>Dados do CSO</h2>
        {first ? (
          <p className="muted">
            Tabela CJA11 atualizada pelo CSO em {formatDateTime(first.csoUpdated)} · baixada neste aparelho em{' '}
            {formatDateTime(first.fetchedAt)} · {stations.length} estações de Cork.
          </p>
        ) : (
          <p className="muted">
            Ainda não há dados neste aparelho. O app baixa a tabela pública CJA11 do CSO (menos de 1 MB) e guarda só as
            estações de Cork; depois funciona sem internet.
          </p>
        )}
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
            {busy ? 'Baixando…' : first ? 'Atualizar dados do CSO' : 'Baixar dados do CSO'}
          </button>
          <a className="btn" href={CSO_CJA11_PAGE} target="_blank" rel="noreferrer">
            Ver tabela no CSO
          </a>
        </div>
      </section>

      <section className="card">
        <h2>Localidades</h2>
        <div className="table-wrap">
          <table className="safety-table">
            <thead>
              <tr>
                <th>Localidade</th>
                <th>Estação da Garda</th>
                <th className="hide-sm">Avaliação</th>
                <th className="hide-sm">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => {
                const r = results.get(l.id!)!
                return (
                  <tr key={l.id} className={l.id === selectedId ? 'active' : ''}>
                    <td>
                      <button type="button" className="link-btn" onClick={() => setSelectedId(l.id!)}>
                        {l.name}
                      </button>
                      <span className="show-sm">
                        <SafetyBadge level={r.level} />
                      </span>
                    </td>
                    <td>
                      <select
                        className="input input-sm"
                        aria-label={`Estação da Garda para ${l.name}`}
                        value={l.gardaStation?.code ?? ''}
                        onChange={(e) => setStation(l, e.target.value)}
                        disabled={stations.length === 0}
                      >
                        <option value="">Nenhuma</option>
                        {l.gardaStation && !byCode.has(l.gardaStation.code) && (
                          <option value={l.gardaStation.code}>Estação não encontrada nos dados</option>
                        )}
                        {stations.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {l.gardaStation && (
                        <span className="origin">{l.gardaStation.origin === 'nome' ? 'mesmo nome' : 'escolhida por você'}</span>
                      )}
                    </td>
                    <td className="hide-sm">
                      <SafetyBadge level={r.level} />
                    </td>
                    <td className="hide-sm muted">{r.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="card" id="safety-detail">
          <h2>
            {selected.name} {selStation ? `— estação ${selStation.name} (${selStation.division})` : ''}
          </h2>
          <p>
            <SafetyBadge level={results.get(selected.id!)!.level} /> <span className="muted">{results.get(selected.id!)!.reason}</span>
          </p>
          {selStation ? <StationDetail station={selStation} criteria={criteria} /> : <p className="muted">
              {selected.gardaStation ? 'A estação associada não está nos dados atuais do CSO.' : 'Escolha uma estação para ver os dados.'}
            </p>}
        </section>
      )}

      <CriteriaEditor criteria={criteria} onSaved={reload} />

      <section className="card">
        <h2>Limitações dos dados</h2>
        <ul className="disclaimer">
          {LIMITATIONS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="disclaimer">
          Fonte: Central Statistics Office (CSO), tabela{' '}
          <a href={CSO_CJA11_PAGE} target="_blank" rel="noreferrer">
            CJA11 — Recorded crime incidents (New Garda Operating Model)
          </a>
          . Relatos isolados não são usados como evidência.
        </p>
      </section>
    </div>
  )
}

function StationDetail({ station, criteria }: { station: import('../db/types').CrimeStation; criteria: SafetyCriteria }) {
  const years = Object.keys(station.counts).map(Number).sort((a, b) => a - b)
  const last5 = years.slice(-5)
  const totals = yearlyTotals(station, criteria.offences)
  const codes = OFFENCE_CODES.filter((c) => years.some((y) => station.counts[String(y)]?.[c] !== undefined))
  return (
    <>
      <h3>Soma dos tipos escolhidos, por ano</h3>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={totals} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: INK_MUTED, fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [String(v), 'Ocorrências']} itemStyle={{ color: '#1d1d1a' }} />
            <Line type="linear" dataKey="total" stroke={CHART} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>Por tipo de ofensa (últimos 5 anos)</h3>
      <div className="table-wrap">
        <table className="offence-table">
          <thead>
            <tr>
              <th>Tipo</th>
              {last5.map((y) => (
                <th key={y} className="num">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c} className={criteria.offences.includes(c) ? 'chosen' : ''}>
                <td>
                  {OFFENCES[c]} <span className="muted">({c})</span>
                </td>
                {last5.map((y) => {
                  const v = station.counts[String(y)]?.[c]
                  return (
                    <td key={y} className="num">
                      {typeof v === 'number' ? v : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="disclaimer">Em negrito: tipos usados na avaliação. "—" = sem dado.</p>
    </>
  )
}

function CriteriaEditor({ criteria, onSaved }: { criteria: SafetyCriteria; onSaved(): Promise<void> }) {
  const [c, setC] = useState(criteria)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => setC(criteria), [criteria])

  const toggle = (code: string) =>
    setC({ ...c, offences: c.offences.includes(code) ? c.offences.filter((x) => x !== code) : [...c.offences, code].sort() })

  const save = async () => {
    const err = validateCriteria(c)
    setError(err)
    setOk(false)
    if (err) return
    await saveSettings({ safetyCriteria: c })
    await onSaved()
    setOk(true)
  }

  return (
    <section className="card">
      <details>
        <summary className="criteria-summary">Critérios da avaliação</summary>
        <p className="muted">Tipos de ofensa somados:</p>
        <div className="criteria-grid">
          {OFFENCE_CODES.map((code) => [code, OFFENCES[code]] as const).map(([code, label]) => (
            <label className="check" key={code}>
              <input type="checkbox" checked={c.offences.includes(code)} onChange={() => toggle(code)} />
              {label} ({code})
            </label>
          ))}
        </div>
        <div className="form-grid">
          <NumberField label="Anos de base" value={c.baselineYears} min={2} onChange={(v) => setC({ ...c, baselineYears: v === null ? NaN : Math.round(v) })} />
          <NumberField label="Atenção moderada acima de" suffix="%" value={c.moderatePct} min={0} onChange={(v) => setC({ ...c, moderatePct: v ?? NaN })} />
          <NumberField label="Atenção elevada acima de" suffix="%" value={c.highPct} min={0} onChange={(v) => setC({ ...c, highPct: v ?? NaN })} />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {ok && <div className="alert alert-success">Critérios salvos.</div>}
        <button type="button" className="btn btn-primary" onClick={save}>
          Salvar critérios
        </button>
      </details>
    </section>
  )
}

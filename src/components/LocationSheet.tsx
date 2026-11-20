import { useEffect, useState } from 'react'
import type { Location } from '../db/types'
import { formatDateTime, formatEUR, formatKm, NOT_AVAILABLE } from '../domain/format'
import { haversineKm } from '../domain/geo'
import { prepareLocationSave, transitUrl, validateLocationEdit } from '../domain/locations'
import { Link } from 'react-router-dom'
import { STATION_AREA_NOTE, type SafetyResult } from '../domain/safety'
import { NumberField } from './NumberField'
import { SafetyBadge } from './SafetyBadge'

interface Props {
  location: Location
  reference: Location | undefined
  routeStatus: 'idle' | 'loading' | { error: string }
  onSave(l: Location): Promise<void>
  onDelete(l: Location): Promise<void>
  onRecalc(l: Location): void
  safety: SafetyResult
  /** Imóveis que você salvou nesta localidade. */
  saved?: { count: number; avgRent: number | null }
}

const TEXTS: [keyof Location, string][] = [
  ['description', 'Descrição'],
  ['infrastructure', 'Infraestrutura'],
  ['publicTransport', 'Transporte público'],
  ['supermarkets', 'Supermercados'],
  ['services', 'Serviços'],
  ['residentialProfile', 'Perfil residencial'],
  ['notes', 'Observações pessoais'],
]

const DEP_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const
const minutes = (m: number) => `${Math.round(m)} min`
export const savedText = (s: { count: number; avgRent: number | null } | undefined) =>
  !s ? 'Nenhum' : `${s.count} ${s.count === 1 ? 'imóvel' : 'imóveis'}${s.avgRent !== null ? ` · média ${formatEUR(s.avgRent)}/mês` : ''}`

export function LocationSheet({ location, reference, routeStatus, onSave, onDelete, onRecalc, safety, saved: savedHere }: Props) {
  const [d, setD] = useState<Location>(location)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [rentMin, setRentMin] = useState<number | null>(location.rentRange.value?.min ?? null)
  const [rentMax, setRentMax] = useState<number | null>(location.rentRange.value?.max ?? null)
  // só reinicia o rascunho ao trocar de localidade (a rota pode chegar enquanto você edita)
  useEffect(() => {
    setD(location)
    setError(null)
    setSaved(false)
    setInvalid(new Set())
    setRentMin(location.rentRange.value?.min ?? null)
    setRentMax(location.rentRange.value?.max ?? null)
  }, [location.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const validity = (k: string) => (bad: boolean) =>
    setInvalid((p) => {
      const n = new Set(p)
      if (bad) n.add(k)
      else n.delete(k)
      return n
    })

  const isRef = location.isReference
  const straight = reference && !isRef ? haversineKm(location, reference) : null
  const car = location.carRoute

  const save = async () => {
    setSaved(false)
    if (invalid.size > 0) return setError('Corrija os campos marcados como inválidos.')
    const err = validateLocationEdit(location, d, { min: rentMin, max: rentMax })
    if (err) return setError(err)
    setError(null)
    const rentRange = { ...d.rentRange, value: rentMin !== null && rentMax !== null ? { min: rentMin, max: rentMax } : null }
    // rota de carro: mantém a mais recente; se a posição mudou, apaga (será recalculada)
    await onSave(prepareLocationSave(location, { ...d, rentRange }))
    setSaved(true)
  }

  const remove = async () => {
    if (isRef) return setError('Cork City é a referência de distância e não pode ser excluída.')
    if (!window.confirm(`Excluir a localidade "${location.name}"?`)) return
    await onDelete(location)
  }


  return (
    <section className="card location-sheet">
      <div className="sheet-head">
        <h2>{location.name}</h2>
        <label className="check">
          <input type="checkbox" checked={d.favorite} onChange={(e) => setD({ ...d, favorite: e.target.checked })} />
          Favorita
        </label>
      </div>

      <dl className="facts">
        {isRef ? (
          <>
            <dt>Distância</dt>
            <dd>Referência das distâncias</dd>
          </>
        ) : (
          <>
            <dt>Até Cork City (em linha reta)</dt>
            <dd>{formatKm(straight)}</dd>
            <dt>De carro</dt>
            <dd>
              {routeStatus === 'loading' ? (
                'Consultando…'
              ) : car.value ? (
                <>
                  {formatKm(car.value.km)} · {minutes(car.value.minutes)}
                  <span className="fact-note">
                    Estimativa sem trânsito — OSRM, consultado em {formatDateTime(car.date)}
                  </span>
                  {typeof routeStatus === 'object' && (
                    <span className="fact-note negative">Não foi possível recalcular: {routeStatus.error}</span>
                  )}
                </>
              ) : (
                <>
                  {NOT_AVAILABLE}
                  {typeof routeStatus === 'object' && <span className="fact-note">{routeStatus.error}</span>}
                </>
              )}
              <button type="button" className="btn btn-sm" onClick={() => onRecalc(location)} disabled={routeStatus === 'loading'}>
                {car.value ? 'Recalcular' : 'Tentar de novo'}
              </button>
            </dd>
            <dt>Transporte público</dt>
            <dd>
              {location.transitMinutes.value !== null ? (
                <>
                  {minutes(location.transitMinutes.value)}{' '}
                  <span className="fact-note">
                    {location.transitMinutes.status === 'confirmado' ? 'Confirmado' : 'Estimado'}
                    {location.transitMinutes.source ? ` — ${location.transitMinutes.source}` : ''}
                  </span>
                </>
              ) : (
                NOT_AVAILABLE
              )}
              {reference && (
                <a className="btn btn-sm" href={transitUrl(location, reference)} target="_blank" rel="noreferrer">
                  Ver trajeto de transporte público
                </a>
              )}
            </dd>
          </>
        )}
        <dt>Faixa de aluguel</dt>
        <dd>
          {location.rentRange.value
            ? `€ ${location.rentRange.value.min.toLocaleString('pt-BR')} – € ${location.rentRange.value.max.toLocaleString('pt-BR')}/mês`
            : NOT_AVAILABLE}
          {location.rentRange.source && <span className="fact-note">Fonte: {location.rentRange.source}</span>}
        </dd>
        <dt>Imóveis que você salvou aqui</dt>
        <dd>
          {savedText(savedHere)}
          <Link className="btn btn-sm" to="/imoveis">
            Ver imóveis
          </Link>
        </dd>
        <dt>Dependência de carro</dt>
        <dd>{location.carDependency.value ? DEP_LABELS[location.carDependency.value] : NOT_AVAILABLE}</dd>
        <dt>Segurança (tendência da estação da Garda)</dt>
        <dd>
          <SafetyBadge level={safety.level} />
          <span className="fact-note">{safety.reason}</span>
          <span className="fact-note">{STATION_AREA_NOTE}</span>
          <Link className="fact-note" to="/seguranca">
            Ver dados e critérios
          </Link>
        </dd>
        <dt>Coordenadas</dt>
        <dd>
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          <span className="fact-note">
            Fonte:{' '}
            {location.coordSource.startsWith('https://') ? (
              <a href={location.coordSource} target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>
            ) : (
              location.coordSource
            )}
          </span>
        </dd>
      </dl>

      <details className="sheet-edit">
        <summary>Editar informações</summary>
        <div className="form-stack">
          <div className="field">
            <label htmlFor="loc-name">Nome</label>
            <input id="loc-name" className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          {TEXTS.map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={`loc-${k}`}>{label}</label>
              <textarea
                id={`loc-${k}`}
                className="input"
                rows={2}
                value={d[k] as string}
                onChange={(e) => setD({ ...d, [k]: e.target.value })}
              />
            </div>
          ))}

          <h3 className="form-subtitle">Aluguel (informe a fonte)</h3>
          <div className="form-grid">
            <NumberField label="Mínimo" value={rentMin} min={0} suffix="€/mês" onValidityChange={validity('rmin')} onChange={setRentMin} />
            <NumberField label="Máximo" value={rentMax} min={0} suffix="€/mês" onValidityChange={validity('rmax')} onChange={setRentMax} />
          </div>
          <SourceFields
            id="rent"
            source={d.rentRange.source}
            date={d.rentRange.date}
            onChange={(source, date) => setD({ ...d, rentRange: { ...d.rentRange, source, date } })}
          />

          <h3 className="form-subtitle">Transporte público até Cork City</h3>
          <div className="form-grid">
            <NumberField
              label="Tempo de viagem"
              value={d.transitMinutes.value}
              min={0}
              suffix="min"
              onValidityChange={validity('transit')}
              onChange={(value) => setD({ ...d, transitMinutes: { ...d.transitMinutes, value } })}
            />
            <div className="field">
              <label htmlFor="loc-transit-status">Status</label>
              <select
                id="loc-transit-status"
                className="input"
                value={d.transitMinutes.status ?? 'estimado'}
                onChange={(e) => setD({ ...d, transitMinutes: { ...d.transitMinutes, status: e.target.value as 'confirmado' | 'estimado' } })}
              >
                <option value="estimado">Estimado</option>
                <option value="confirmado">Confirmado</option>
              </select>
            </div>
          </div>
          <SourceFields
            id="transit"
            source={d.transitMinutes.source}
            date={d.transitMinutes.date}
            onChange={(source, date) => setD({ ...d, transitMinutes: { ...d.transitMinutes, source, date } })}
          />

          <h3 className="form-subtitle">Dependência de carro</h3>
          <div className="field">
            <label htmlFor="loc-dep">Nível</label>
            <select
              id="loc-dep"
              className="input"
              value={d.carDependency.value ?? ''}
              onChange={(e) =>
                setD({
                  ...d,
                  carDependency: { ...d.carDependency, value: e.target.value === '' ? null : (e.target.value as 'baixa' | 'media' | 'alta') },
                })
              }
            >
              <option value="">Não informado</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <SourceFields
            id="dep"
            source={d.carDependency.source}
            date={d.carDependency.date}
            onChange={(source, date) => setD({ ...d, carDependency: { ...d.carDependency, source, date } })}
          />

          <div className="field">
            <label htmlFor="loc-links">Links (um por linha)</label>
            <textarea
              id="loc-links"
              className="input"
              rows={2}
              value={d.links.join('\n')}
              onChange={(e) => setD({ ...d, links: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
            />
          </div>

          {!isRef && (
            <>
              <h3 className="form-subtitle">Posição</h3>
              <div className="form-grid">
                <NumberField label="Latitude" decimal value={d.lat} onValidityChange={validity('lat')} onChange={(v) => setD({ ...d, lat: v ?? NaN })} />
                <NumberField label="Longitude" decimal value={d.lng} onValidityChange={validity('lng')} onChange={(v) => setD({ ...d, lng: v ?? NaN })} />
              </div>
            </>
          )}
        </div>
      </details>

      {location.links.length > 0 && (
        <ul className="sources">
          {location.links.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer">
                {u}
              </a>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Salvo.</div>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save}>
          Salvar
        </button>
        {!isRef && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            Excluir
          </button>
        )}
      </div>
    </section>
  )
}

function SourceFields({
  id,
  source,
  date,
  onChange,
}: {
  id: string
  source: string | null
  date: string | null
  onChange(source: string | null, date: string | null): void
}) {
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor={`${id}-src`}>Fonte</label>
        <input
          id={`${id}-src`}
          className="input"
          placeholder="Ex.: link do anúncio, RTB, visita"
          value={source ?? ''}
          onChange={(e) => onChange(e.target.value || null, date)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-date`}>Data da informação</label>
        <input
          id={`${id}-date`}
          type="date"
          className="input"
          value={date ?? ''}
          onChange={(e) => onChange(source, e.target.value || null)}
        />
      </div>
    </div>
  )
}

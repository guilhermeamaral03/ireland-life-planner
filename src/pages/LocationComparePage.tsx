import { Loading } from '../components/Loading'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFinanceData } from '../app/useFinanceData'
import { useSafety } from '../app/useSafety'
import { SafetyBadge } from '../components/SafetyBadge'
import { STATION_AREA_NOTE } from '../domain/safety'
import { db } from '../db/db'
import type { Location } from '../db/types'
import { toggleCompare } from '../domain/compare'
import { PartText, RangeText } from '../components/HousingFormat'
import { ESTIMATE_DISCLAIMER, computeTax, netMonthlyForRent } from '../domain/finance'
import { formatEUR, formatKm, NOT_AVAILABLE } from '../domain/format'
import { haversineKm } from '../domain/geo'
import { baselineFromExpenses, bestBy, locationCost, type HousingCost, type Part, type Range } from '../domain/housing'
import { normalizeLocation } from '../domain/locations'
import './LocationComparePage.css'

const DEP = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const

const range = (r: Range | null) => <RangeText r={r} />
const part = (p: Part, itemLabel: string) => <PartText p={p} itemLabel={itemLabel} />

interface Row {
  label: string
  cell(l: Location, c: HousingCost): ReactNode
  best?: Set<Location>
}

export function LocationComparePage() {
  const { data, error } = useFinanceData()
  const safety = useSafety()
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [warn, setWarn] = useState<string | null>(null)

  useEffect(() => {
    db.locations
      .toArray()
      .then((ls) =>
        setLocations(
          ls
            .map(normalizeLocation)
            .sort((a, b) => Number(b.isReference) - Number(a.isReference) || a.name.localeCompare(b.name, 'pt-BR')),
        ),
      )
  }, [])

  const ctx = useMemo(() => {
    if (!data) return null
    const tax = computeTax(data.settings, data.expenses, data.categories)
    return {
      tax,
      netFor: netMonthlyForRent(data.settings, data.expenses, data.categories),
      base: baselineFromExpenses(data.expenses, data.categories),
    }
  }, [data])

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data || !ctx || !locations) return <Loading />

  const reference = locations.find((l) => l.isReference)
  const chosen = selected.map((id) => locations.find((l) => l.id === id)!).filter(Boolean)
  const costs = new Map(chosen.map((l) => [l, locationCost(l, ctx.base, ctx.netFor)]))
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = locations.filter((l) => fold(l.name).includes(fold(query.trim())))

  const pick = (id: number) => {
    const r = toggleCompare(selected, id)
    setWarn(r.error)
    setSelected(r.selected)
  }

  const bestRent = bestBy(chosen, (l) => l.rentRange.value?.max ?? null, 'min')
  const bestCar = bestBy(chosen, (l) => (l.isReference ? null : (l.carRoute.value?.minutes ?? null)), 'min')
  const bestSaving = bestBy(chosen, (l) => costs.get(l)!.saving?.min ?? null, 'max')

  const rows: Row[] = [
    {
      label: 'Aluguel',
      best: bestRent,
      cell: (l) => (
        <>
          {range(l.rentRange.value)}
          {l.rentRange.source && <span className="origin">Fonte: {l.rentRange.source}</span>}
        </>
      ),
    },
    { label: 'Contas da casa', cell: (_l, c) => part(c.bills, 'da localidade') },
    { label: 'Transporte', cell: (_l, c) => part(c.transport, 'da localidade') },
    { label: 'Outras despesas', cell: (_l, c) => <>{formatEUR(c.other)} <span className="origin">das suas despesas</span></> },
    { label: 'Custo mensal estimado', cell: (_l, c) => <strong>{range(c.total)}</strong> },
    {
      label: 'Líquido mensal (com Rent Tax Credit)',
      cell: (_l, c) => range(c.net ? { min: Math.min(c.net.atMinRent, c.net.atMaxRent), max: Math.max(c.net.atMinRent, c.net.atMaxRent) } : null),
    },
    { label: 'Saldo mensal', cell: (_l, c) => range(c.balance) },
    { label: 'Economia mensal', best: bestSaving, cell: (_l, c) => range(c.saving) },
    {
      label: 'Até Cork City (linha reta)',
      cell: (l) => (l.isReference ? 'Referência' : reference ? formatKm(haversineKm(l, reference)) : NOT_AVAILABLE),
    },
    {
      label: 'De carro (sem trânsito, OSRM)',
      best: bestCar,
      cell: (l) =>
        l.isReference ? '—' : l.carRoute.value ? `${formatKm(l.carRoute.value.km)} · ${Math.round(l.carRoute.value.minutes)} min` : 'Abra a ficha no mapa para calcular',
    },
    {
      label: 'Transporte público',
      cell: (l) =>
        l.transitMinutes.value !== null
          ? `${Math.round(l.transitMinutes.value)} min (${l.transitMinutes.status === 'confirmado' ? 'confirmado' : 'estimado'})`
          : NOT_AVAILABLE,
    },
    { label: 'Dependência de carro', cell: (l) => (l.carDependency.value ? DEP[l.carDependency.value] : NOT_AVAILABLE) },
    { label: 'Transporte público (notas)', cell: (l) => l.publicTransport || NOT_AVAILABLE },
    { label: 'Infraestrutura', cell: (l) => l.infrastructure || NOT_AVAILABLE },
    { label: 'Serviços', cell: (l) => l.services || NOT_AVAILABLE },
    { label: 'Supermercados', cell: (l) => l.supermarkets || NOT_AVAILABLE },
    {
      label: 'Segurança (tendência)',
      cell: (l) => {
        const r = safety.classify(l)
        return (
          <>
            <SafetyBadge level={r.level} />
            <span className="origin">{r.reason}</span>
          </>
        )
      },
    },
  ]

  return (
    <div className="page">
      <header className="page-header">
        <h1>Comparador de localidades</h1>
        <p>Compare custo, acesso e capacidade de poupança entre 2 e 4 localidades. Sem nota final — você decide o peso de cada critério.</p>
      </header>

      {ctx.tax === null && (
        <p className="muted">
          Para ver saldo e economia, <Link to="/renda">informe seu salário no simulador</Link>.
        </p>
      )}
      {ctx.tax && !ctx.tax.ok && <p className="muted">Renda indisponível: {ctx.tax.reason}</p>}

      <section className="card">
        <div className="field">
          <label htmlFor="lc-search">Escolha as localidades</label>
          <input id="lc-search" className="input" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {warn && <div className="alert alert-warning">{warn}</div>}
        <ul className="lc-pick">
          {list.map((l) => (
            <li key={l.id}>
              <label className="check">
                <input type="checkbox" checked={selected.includes(l.id!)} onChange={() => pick(l.id!)} />
                {l.name}
                {l.rentRange.value ? '' : <span className="muted"> · sem aluguel</span>}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {chosen.length < 2 ? (
        <p className="muted">Selecione pelo menos 2 localidades.</p>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="lc-table">
              <thead>
                <tr>
                  <th />
                  {chosen.map((l) => (
                    <th key={l.id}>{l.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {chosen.map((l) => (
                      <td key={l.id} className={r.best?.has(l) ? 'best-cell' : ''}>
                        {r.cell(l, costs.get(l)!)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="disclaimer">
            Fundo verde: melhor da linha entre as localidades com dado (menor aluguel máximo, menor tempo de carro, maior
            economia no pior caso). Segurança: avaliação do app sobre a tendência da estação, não estatística oficial; {STATION_AREA_NOTE.toLowerCase()} Custo = aluguel + contas + transporte + suas outras despesas atuais.{' '}
            {ESTIMATE_DISCLAIMER}
          </p>
          <p className="disclaimer">O líquido de cada localidade considera o Rent Tax Credit do aluguel dela.</p>
        </section>
      )}
    </div>
  )
}

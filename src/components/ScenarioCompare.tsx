import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Scenario, Settings } from '../db/types'
import { COMPARE_COLORS } from '../domain/compare'
import { ESTIMATE_DISCLAIMER, TAX_STATUS_LABELS } from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/format'
import { SCENARIO_KEYS, SCENARIO_LABELS, type ScenarioResult } from '../domain/scenarios'

const GRID = '#e0e0dc'
const INK_MUTED = '#66665f'
const compactEUR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

interface Item {
  scenario: Scenario
  result: ScenarioResult
  color: string
}

export function ScenarioCompare({
  scenarios,
  results,
  slots,
  base,
}: {
  scenarios: Scenario[]
  results: Map<number, ScenarioResult>
  slots: Record<number, number>
  base: Settings
}) {
  const items: Item[] = scenarios.map((s) => ({
    scenario: s,
    result: results.get(s.id!)!,
    color: COMPARE_COLORS[slots[s.id!] ?? 0],
  }))

  const balances = items.map((i) => i.result.balance).filter((b): b is number => b !== null)
  const bestBalance = balances.length >= 2 ? Math.max(...balances) : null

  const gross = (i: Item) => i.scenario.grossAnnual ?? base.grossAnnual
  const status = (i: Item) => TAX_STATUS_LABELS[i.scenario.taxStatus ?? base.taxStatus ?? 'solteiro']
  const net = (i: Item) => (i.result.tax.ok ? formatEUR(i.result.tax.netMonthly) : 'Não disponível')
  const endValue = (i: Item) => (i.result.projection ? i.result.projection[i.result.projection.length - 1].value : null)

  const rows: { label: string; cell(i: Item): React.ReactNode; strong?: boolean }[] = [
    { label: 'Salário bruto anual', cell: (i) => formatEUR(gross(i)) },
    { label: 'Situação fiscal', cell: status },
    { label: 'Líquido mensal', cell: net, strong: true },
    ...SCENARIO_KEYS.map((k) => ({ label: SCENARIO_LABELS[k], cell: (i: Item) => formatEUR(i.scenario.amounts[k] || 0) })),
    { label: 'Despesas totais', cell: (i) => formatEUR(i.result.totalMonthly), strong: true },
    {
      label: 'Saldo mensal',
      strong: true,
      cell: (i) => (
        <span className={i.result.balance !== null && i.result.balance === bestBalance ? 'best' : ''}>
          {formatEUR(i.result.balance)}
        </span>
      ),
    },
    { label: 'Economia mensal', cell: (i) => formatEUR(i.result.savingMonthly) },
    { label: 'Economia anual', cell: (i) => formatEUR(i.result.savingAnnual) },
    { label: '% de economia', cell: (i) => formatPercent(i.result.savingRate) },
    { label: `Reserva em ${base.projectionMonths} meses`, cell: (i) => formatEUR(endValue(i)) },
  ]

  const charted = items.filter((i) => i.result.projection)
  const chartData = Array.from({ length: base.projectionMonths + 1 }, (_, month) => {
    const row: Record<string, number> = { month }
    for (const i of charted) row[`s${i.scenario.id}`] = i.result.projection![month].value
    return row
  })

  return (
    <section className="card compare">
      <h2>Comparação</h2>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              {items.map((i) => (
                <th key={i.scenario.id} className="num">
                  <span className="swatch" style={{ background: i.color }} aria-hidden="true" />
                  {i.scenario.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.strong ? 'strong-row' : ''}>
                <td>{r.label}</td>
                {items.map((i) => (
                  <td key={i.scenario.id} className="num">
                    {r.cell(i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bestBalance !== null && <p className="muted compare-note">Em negrito: maior saldo mensal. Não é uma recomendação — compare também o que não está nos números.</p>}
      {items.some((i) => !i.result.tax.ok) && (
        <p className="muted compare-note">
          Cenários sem resultado: {items.filter((i) => !i.result.tax.ok).map((i) => `${i.scenario.name} (${(i.result.tax as { reason: string }).reason})`).join('; ')}
        </p>
      )}

      <h3>Projeção da reserva</h3>
      {charted.length === 0 ? (
        <p className="muted">Informe a reserva inicial (no simulador ou nos cenários) para ver a projeção.</p>
      ) : (
        <>
          <ul className="legend">
            {charted.map((i) => (
              <li key={i.scenario.id}>
                <span className="legend-line" style={{ background: i.color }} aria-hidden="true" />
                {i.scenario.name}
              </li>
            ))}
          </ul>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                  tickFormatter={(m) => `${m}m`}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                  tickFormatter={(v) => compactEUR.format(Number(v))}
                />
                <Tooltip
                  labelFormatter={(m) => `Mês ${m}`}
                  formatter={(v, key) => {
                    const it = charted.find((i) => `s${i.scenario.id}` === key)
                    return [formatEUR(Number(v)), it?.scenario.name ?? '']
                  }}
                  cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
                  itemStyle={{ color: '#1d1d1a' }}
                />
                {charted.map((i) => (
                  <Line
                    key={i.scenario.id}
                    type="linear"
                    dataKey={`s${i.scenario.id}`}
                    stroke={i.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <p className="disclaimer">{ESTIMATE_DISCLAIMER} Projeção sem juros nem inflação.</p>
    </section>
  )
}

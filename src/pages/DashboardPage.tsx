import { Loading } from '../components/Loading'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinanceData } from '../app/useFinanceData'
import { getTaxRules } from '../data/tax'
import { buildDashboard } from '../domain/dashboard'
import { effectiveYear, ESTIMATE_DISCLAIMER, RULES_STATUS_LABELS } from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/format'
import './DashboardPage.css'

/** Cor de dados validada (croma e contraste) — o verde da marca é apagado demais para marcas de gráfico. */
const CHART = '#1f8a5a'
const GRID = '#e0e0dc'
const INK_MUTED = '#66665f'

const compactEUR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function DashboardPage() {
  const { data, error } = useFinanceData()
  const d = useMemo(() => (data ? buildDashboard(data.settings, data.expenses, data.categories) : null), [data])

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data || !d) return <Loading />

  const header = (
    <header className="page-header">
      <h1>Dashboard</h1>
      <p>Visão consolidada da sua situação financeira.</p>
    </header>
  )

  if ('empty' in d) {
    return (
      <div className="page">
        {header}
        <section className="card empty-state">
          <h2>Nenhum dado configurado</h2>
          <p>Configure o simulador de renda para ver seus indicadores.</p>
          <Link to="/renda" className="btn btn-primary">
            Configurar simulador
          </Link>
        </section>
      </div>
    )
  }

  const rules = getTaxRules(effectiveYear(data.settings))
  const { summary, tax } = d
  const total = summary.totalMonthly

  return (
    <div className="page">
      {header}
      <p className="dash-status">
        Ano fiscal {effectiveYear(data.settings)}{' '}
        {rules && <span className={`badge badge-${rules.status}`}>{RULES_STATUS_LABELS[rules.status]}</span>}
      </p>
      {!tax.ok && (
        <div className="alert alert-warning">
          {tax.reason} <Link to="/renda">Ajustar no simulador</Link>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Salário bruto</div>
          <div className="kpi-value">{formatEUR(d.grossMonthly)}</div>
          <div className="kpi-sub">por mês · {formatEUR(d.grossAnnual)} por ano</div>
        </div>
        <div className="kpi kpi-primary">
          <div className="kpi-label">Líquido mensal estimado</div>
          <div className="kpi-value">{tax.ok ? formatEUR(tax.netMonthly) : 'Não disponível'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Despesas mensais</div>
          <div className="kpi-value">{formatEUR(total)}</div>
          <div className="kpi-sub">{formatPercent(summary.incomeShare)} do líquido</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo mensal</div>
          <div className={`kpi-value${summary.balance !== null && summary.balance < 0 ? ' negative' : ''}`}>
            {formatEUR(summary.balance)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Economia</div>
          <div className="kpi-value">
            {summary.balance === null ? 'Não disponível' : formatEUR(Math.max(summary.balance, 0))}
          </div>
          <div className="kpi-sub">{formatPercent(summary.savingRate)} do líquido</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Reserva atual</div>
          <div className="kpi-value">{d.reserve === null ? 'Não informada' : formatEUR(d.reserve)}</div>
        </div>
      </div>

      <div className="dash-charts">
        <section className="card">
          <h2>Distribuição das despesas</h2>
          <p className="muted chart-sub">Equivalente mensal por categoria</p>
          {summary.byCategory.length === 0 ? (
            <p className="muted">
              Nenhuma despesa cadastrada. <Link to="/despesas">Adicionar despesas</Link>
            </p>
          ) : (
            <>
              <div style={{ height: summary.byCategory.length * 36 + 16 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byCategory}
                    layout="vertical"
                    margin={{ top: 4, right: 90, bottom: 4, left: 0 }}
                    barCategoryGap={8}
                  >
                    <XAxis type="number" hide domain={[0, 'dataMax']} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: INK_MUTED, fontSize: 13 }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f7f3' }}
                      itemStyle={{ color: '#1d1d1a' }}
                      formatter={(v) => [
                        `${formatEUR(Number(v))} (${formatPercent(total > 0 ? Number(v) / total : null)})`,
                        'Por mês',
                      ]}
                    />
                    <Bar dataKey="monthly" fill={CHART} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList
                        dataKey="monthly"
                        position="right"
                        formatter={(v) => formatEUR(Number(v))}
                        style={{ fill: '#1d1d1a', fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-table">
                <summary>Ver como tabela</summary>
                <table>
                  <tbody>
                    {summary.byCategory.map((c) => (
                      <tr key={c.categoryId}>
                        <td>{c.name}</td>
                        <td className="num">{formatEUR(c.monthly)}</td>
                        <td className="num">{formatPercent(total > 0 ? c.monthly / total : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </section>

        <section className="card">
          <h2>Projeção da reserva</h2>
          <p className="muted chart-sub">
            Reserva atual + saldo mensal, mês a mês (sem juros nem inflação)
          </p>
          {summary.balance !== null && summary.balance < 0 && d.projection && (
            <div className="alert alert-warning">
              Suas despesas superam a renda líquida em {formatEUR(-summary.balance)} por mês — a reserva diminui.
            </div>
          )}
          {d.projection === null ? (
            <p className="muted">
              {d.reserve === null ? (
                <>
                  Informe sua reserva atual no <Link to="/renda">simulador de renda</Link> para ver a projeção.
                </>
              ) : (
                'Projeção indisponível enquanto a renda líquida não puder ser calculada.'
              )}
            </p>
          ) : (
            <>
              <p className="projection-end">
                Em {d.projection.length - 1} meses: <strong>{formatEUR(d.projection[d.projection.length - 1].value)}</strong>
              </p>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.projection} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
                      formatter={(v) => [formatEUR(Number(v)), 'Reserva']}
                      labelFormatter={(m) => `Mês ${m}`}
                      cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
                      itemStyle={{ color: '#1d1d1a' }}
                    />
                    <Area
                      type="linear"
                      dataKey="value"
                      stroke={CHART}
                      strokeWidth={2}
                      fill={CHART}
                      fillOpacity={0.1}
                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-table">
                <summary>Ver como tabela</summary>
                <table>
                  <tbody>
                    {d.projection
                      .filter((p) => p.month % 6 === 0 || p.month === d.projection!.length - 1)
                      .map((p) => (
                        <tr key={p.month}>
                          <td>Mês {p.month}</td>
                          <td className="num">{formatEUR(p.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </section>
      </div>

      <p className="disclaimer">{ESTIMATE_DISCLAIMER}</p>
    </div>
  )
}

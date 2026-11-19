import type { TaxResult } from '../domain/tax'
import { formatEUR } from '../domain/format'

const pct = (r: number) => `${(r * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const date = (iso: string) => iso.split('-').reverse().join('/')

/** Detalhamento linha a linha de Income Tax, USC e PRSI. */
export function TaxBreakdown({ r, gross, spouse }: { r: TaxResult; gross: number; spouse: number | null }) {
  const it = r.incomeTax
  const taxable = gross + (spouse ?? 0)
  const atStandard = Math.min(taxable, it.band)
  const atHigher = Math.max(0, taxable - it.band)
  const creditSum = it.credits.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="table-wrap">
      <table>
        <tbody>
          <tr className="section">
            <td colSpan={2}>Income Tax{r.incomeTax.coupleTotal !== null ? ' (do casal)' : ''}</td>
          </tr>
          <tr>
            <td>
              {pct(it.standardRate)} sobre {formatEUR(atStandard)} (faixa até {formatEUR(it.band)})
            </td>
            <td className="num">{formatEUR(atStandard * it.standardRate)}</td>
          </tr>
          <tr>
            <td>
              {pct(it.higherRate)} sobre {formatEUR(atHigher)}
            </td>
            <td className="num">{formatEUR(atHigher * it.higherRate)}</td>
          </tr>
          {it.credits.map((c) => (
            <tr key={c.label}>
              <td>− {c.label}</td>
              <td className="num">−{formatEUR(c.amount)}</td>
            </tr>
          ))}
          {creditSum > it.grossTax && (
            <tr>
              <td colSpan={2} className="muted">
                Os créditos superam o imposto; o Income Tax fica em zero (o excedente não é devolvido).
              </td>
            </tr>
          )}
          <tr>
            <td>− Rent Tax Credit (20% do aluguel, até o teto e até o imposto devido)</td>
            <td className="num">−{formatEUR(it.rentCredit)}</td>
          </tr>
          {it.coupleTotal !== null && (
            <>
              <tr className="subtotal">
                <td>Income Tax do casal</td>
                <td className="num">{formatEUR(it.coupleTotal)}</td>
              </tr>
              <tr>
                <td>
                  Sua parte: {taxable > 0 ? pct(gross / taxable) : pct(0)} do total, proporcional à renda{' '}
                  <span className="muted">(alocação estimada pelo app)</span>
                </td>
                <td className="num" />
              </tr>
            </>
          )}
          <tr className="subtotal">
            <td>Income Tax (seu)</td>
            <td className="num">{formatEUR(it.total)}</td>
          </tr>

          <tr className="section">
            <td colSpan={2}>USC{r.usc.reduced ? ' — taxa reduzida' : ''}</td>
          </tr>
          {r.usc.exempt ? (
            <tr>
              <td colSpan={2}>Isento: renda até o limite de isenção.</td>
            </tr>
          ) : (
            r.usc.lines.map((l) => (
              <tr key={l.from}>
                <td>
                  {pct(l.rate)} de {formatEUR(l.from)} a {formatEUR(l.to)}
                </td>
                <td className="num">{formatEUR(l.amount)}</td>
              </tr>
            ))
          )}
          <tr className="subtotal">
            <td>USC</td>
            <td className="num">{formatEUR(r.usc.total)}</td>
          </tr>

          <tr className="section">
            <td colSpan={2}>PRSI (classe A)</td>
          </tr>
          <tr>
            <td>Renda semanal: {formatEUR(r.prsi.weeklyEarnings)}</td>
            <td className="num" />
          </tr>
          {r.prsi.weeklyCredit > 0 && (
            <tr>
              <td>Crédito semanal de PRSI</td>
              <td className="num">−{formatEUR(r.prsi.weeklyCredit)}</td>
            </tr>
          )}
          {r.prsi.periods.map((p) => (
            <tr key={p.from}>
              <td>
                {pct(p.rate)} de {date(p.from)} a {date(p.to)} ({p.days} dias)
              </td>
              <td className="num">{formatEUR(p.amount)}</td>
            </tr>
          ))}
          <tr className="subtotal">
            <td>PRSI</td>
            <td className="num">{formatEUR(r.prsi.total)}</td>
          </tr>

          <tr className="subtotal">
            <td>Total de descontos</td>
            <td className="num">{formatEUR(r.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getTaxRules } from '../data/tax'
import { calcNetPay } from '../domain/tax'
import { TaxBreakdown } from './TaxBreakdown'

describe('TaxBreakdown', () => {
  it('casal com as duas rendas zeradas não mostra NaN', () => {
    const r = calcNetPay(
      { grossAnnual: 0, status: 'casado_duas_rendas', spouseGrossAnnual: 0, annualRent: 0, uscReducedRate: false, extraCredits: 0 },
      getTaxRules(2026)!,
    )
    if (!r.ok) throw new Error(r.reason)
    const { container } = render(<TaxBreakdown r={r} gross={0} spouse={0} />)
    expect(container.textContent).not.toMatch(/NaN/)
  })
})

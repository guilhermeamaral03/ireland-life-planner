import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/db'
import type { Scenario } from '../db/types'
import { emptyScenario } from '../domain/scenarios'
import { ScenarioEditor } from './ScenarioEditor'

const base = { ...DEFAULT_SETTINGS, taxYear: 2026, grossAnnual: 50000 }

describe('ScenarioEditor', () => {
  it('campo inválido bloqueia o salvamento e esconde o resultado', () => {
    const onSave = vi.fn()
    render(<ScenarioEditor initial={emptyScenario('Teste')} base={base} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByText('Renda líquida mensal')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Salário bruto anual'), { target: { value: '55k' } })
    expect(screen.queryByText('Renda líquida mensal')).not.toBeInTheDocument()
    expect(screen.getByText('Corrija os campos marcados como inválidos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar cenário' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Salário bruto anual'), { target: { value: '55000' } })
    expect(screen.getByRole('button', { name: 'Salvar cenário' })).toBeEnabled()
    expect(screen.getByText('Renda líquida mensal')).toBeInTheDocument()
  })

  it('valor de grupo inválido também bloqueia', () => {
    render(<ScenarioEditor initial={emptyScenario('Teste')} base={base} onSave={vi.fn()} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Aluguel'), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText('Aluguel'), { target: { value: '-300' } })
    expect(screen.getByRole('button', { name: 'Salvar cenário' })).toBeDisabled()
    // o texto digitado e a mensagem continuam visíveis (não volta para "0" sozinho)
    expect(screen.getByLabelText('Aluguel')).toHaveValue('-300')
    expect(screen.getByText('Valor inválido')).toBeInTheDocument()
  })

  it('cenário antigo sem situação fiscal não mostra NaN', () => {
    const old = { name: 'Antigo', grossAnnual: null, amounts: emptyScenario('x').amounts, initialReserve: null } as unknown as Scenario
    const { container } = render(
      <ScenarioEditor
        initial={old}
        base={{ ...base, taxStatus: 'casado_duas_rendas', spouseGrossAnnual: 20000 }}
        onSave={vi.fn()}
        onCancel={() => {}}
      />,
    )
    const values = [...container.querySelectorAll('input')].map((i) => i.value)
    expect(values.join('|')).not.toMatch(/NaN|undefined/)
  })
})

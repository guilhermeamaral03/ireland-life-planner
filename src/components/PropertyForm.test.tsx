import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyProperty } from '../domain/properties'
import { PropertyForm } from './PropertyForm'

describe('PropertyForm', () => {
  it('campo inválido que some (contas incluídas) não bloqueia o salvamento', () => {
    render(
      <PropertyForm
        initial={{ ...emptyProperty(), title: 'Quarto', rent: 800 }}
        locations={[]}
        base={{ bills: 50, transport: 100, other: 400 }}
        netFor={3000}
        onSave={vi.fn()}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Contas por mês (a sua parte)'), { target: { value: '-5' } })
    expect(screen.getByRole('button', { name: 'Salvar imóvel' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Contas incluídas no aluguel'))
    expect(screen.getByRole('button', { name: 'Salvar imóvel' })).toBeEnabled()
  })
})

describe('PropertyForm — localidade excluída', () => {
  it('mostra "Localidade excluída" em vez de "Nenhuma"', () => {
    render(
      <PropertyForm
        initial={{ ...emptyProperty(), title: 'Quarto', rent: 800, locationId: 999 }}
        locations={[]}
        base={{ bills: 50, transport: 100, other: 400 }}
        netFor={3000}
        onSave={vi.fn()}
        onCancel={() => {}}
      />,
    )
    const sel = screen.getByLabelText('Localidade') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex].text).toBe('Localidade excluída')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyProperty } from '../domain/properties'
import { PropertyForm } from './PropertyForm'

describe('PropertyForm (enxuto)', () => {
  it('mostra "Localidade excluída" em vez de "Nenhuma"', () => {
    render(
      <PropertyForm initial={{ ...emptyProperty(), title: 'Quarto', rent: 800, locationId: 999 }} locations={[]} onSave={vi.fn()} onCancel={() => {}} />,
    )
    const sel = screen.getByLabelText('Localidade') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex].text).toBe('Localidade excluída')
  })

  it('não salva com aluguel inválido e preserva campos antigos ao salvar', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <PropertyForm
        initial={{ ...emptyProperty(), id: 3, title: 'Apto', rent: 900, deposit: 1800, residents: 2 }}
        locations={[]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Aluguel mensal (a sua parte)'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar imóvel' }))
    expect(await screen.findByText('Corrija o valor do aluguel.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Aluguel mensal (a sua parte)'), { target: { value: '950' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar imóvel' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ rent: 950, deposit: 1800, residents: 2 })
  })
})

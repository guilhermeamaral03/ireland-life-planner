import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeeded, getSettings, saveSettings } from '../db/db'
import { IncomePage } from './IncomePage'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
  await saveSettings({ grossAnnual: 50000, taxYear: 2026 })
})

describe('IncomePage', () => {
  it('salário inválido esconde o resultado e não salva outro valor', async () => {
    render(
      <MemoryRouter>
        <IncomePage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Líquido mensal')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Salário bruto anual'), { target: { value: '-5' } })
    expect(await screen.findByText('Corrija os campos marcados como inválidos.')).toBeInTheDocument()
    expect(screen.queryByText('Líquido mensal')).not.toBeInTheDocument()
    expect((await getSettings()).grossAnnual).toBe(50000)
  })
})

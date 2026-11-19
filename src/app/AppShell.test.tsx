import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

const ORDER = [
  'Dashboard', 'Simulador de renda', 'Despesas', 'Mapa de Cork',
  'Segurança', 'Comparador de localidades', 'Imóveis', 'Configurações',
]

describe('AppShell', () => {
  const setup = () =>
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    )

  it('mostra os 8 itens de navegação na ordem', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const labels = Array.from(nav.querySelectorAll('[data-nav-label]')).map((el) => el.textContent)
    expect(labels).toEqual(ORDER)
  })

  it('todos os módulos estão habilitados', () => {
    setup()
    expect(document.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Segurança' })).toHaveAttribute('href', '/seguranca')
  })

  it('Configurações é um link ativo', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/configuracoes')
  })
})

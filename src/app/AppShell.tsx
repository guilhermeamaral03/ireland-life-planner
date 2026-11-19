import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { InstallNotice } from './InstallNotice'
import { useProfile } from './useProfile'
import { NAV_ITEMS } from './nav'
import './AppShell.css'

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const profile = useProfile()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className={`shell${open ? ' menu-open' : ''}`}>
      <header className="topbar">
        <span className="topbar-brand">
          <Avatar name={profile.name} photo={profile.photo} size={30} />
          <strong>Ireland Life Planner</strong>
        </span>
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Menu
        </button>
      </header>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <aside className="sidebar">
        <div className="brand">
          Ireland Life Planner
          <small>Cork, Irlanda</small>
        </div>
        <NavLink to="/configuracoes" className="profile-link" title="Editar perfil">
          <Avatar name={profile.name} photo={profile.photo} size={40} />
          <span>{profile.name || 'Adicionar perfil'}</span>
        </NavLink>
        <nav aria-label="Navegação principal">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                {item.enabled ? (
                  <NavLink to={item.path} end={item.path === '/'} className="nav-link">
                    <span data-nav-label>{item.label}</span>
                  </NavLink>
                ) : (
                  <span className="nav-disabled" aria-disabled="true" title={`Disponível na Etapa ${item.stage}`}>
                    <span data-nav-label>{item.label}</span>
                    <span className="nav-stage">Etapa {item.stage}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="main">
        <InstallNotice />
        {children}
      </main>
    </div>
  )
}

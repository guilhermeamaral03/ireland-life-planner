import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { IncomePage } from './pages/IncomePage'
import { LocationComparePage } from './pages/LocationComparePage'
import { MapPage } from './pages/MapPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { SafetyPage } from './pages/SafetyPage'
import { ScenariosPage } from './pages/ScenariosPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/renda" element={<IncomePage />} />
        <Route path="/despesas" element={<ExpensesPage />} />
        <Route path="/cenarios" element={<ScenariosPage />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/comparador" element={<LocationComparePage />} />
        <Route path="/imoveis" element={<PropertiesPage />} />
        <Route path="/seguranca" element={<SafetyPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

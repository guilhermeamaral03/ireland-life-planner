import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { requestPersistence } from './app/storage'
import { ensureSeeded } from './db/db'
import 'leaflet/dist/leaflet.css'
import './styles/theme.css'
import './styles/base.css'

const root = createRoot(document.getElementById('root')!)

requestPersistence()

ensureSeeded()
  .then(() => {
    root.render(
      <StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </StrictMode>,
    )
  })
  .catch((err) => {
    root.render(
      <div className="page">
        <div className="alert alert-error">
          Não foi possível abrir o banco de dados local deste navegador. {String(err)}
        </div>
      </div>,
    )
  })

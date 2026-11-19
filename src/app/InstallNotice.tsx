import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getSettings, hasUserData } from '../db/db'
import { backupOverdue, isIOS, isStandalone } from './storage'

const DISMISS_KEY = 'ilp-notice-dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallNotice() {
  const [dismissed, setDismissed] = useState(readDismissed)
  const [overdue, setOverdue] = useState(false)
  const location = useLocation()
  const showInstall = isIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0) && !isStandalone()

  // reavalia ao trocar de página (ex.: logo depois de exportar um backup)
  useEffect(() => {
    Promise.all([getSettings(), hasUserData()])
      .then(([s, has]) => setOverdue(has && backupOverdue(s.lastBackupAt, new Date())))
      .catch(() => setOverdue(false))
  }, [location.pathname])

  const showBackup = overdue && location.pathname !== '/configuracoes'
  if (dismissed || (!showInstall && !showBackup)) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sem armazenamento de sessão: o aviso volta na próxima abertura */
    }
  }

  return (
    <div className="alert alert-warning notice" role="status">
      <div>
        {showInstall && (
          <p>
            No iPhone, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) para que o Safari
            não apague seus dados.
          </p>
        )}
        {showBackup && (
          <p>
            Seu último backup tem mais de 14 dias (ou nunca foi feito).{' '}
            <Link to="/configuracoes">Fazer backup</Link>
          </p>
        )}
      </div>
      <button type="button" className="btn" onClick={dismiss}>
        Dispensar
      </button>
    </div>
  )
}

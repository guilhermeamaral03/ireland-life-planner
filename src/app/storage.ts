const DAY_MS = 86_400_000

/** iPhone/iPod/iPad, incluindo iPadOS que se apresenta como Mac com tela de toque. */
export function isIOS(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

/** App aberto como aplicativo instalado (tela de início), não numa aba do navegador. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function backupOverdue(lastBackupAt: string | null, now: Date, days = 14): boolean {
  if (!lastBackupAt) return true
  const last = new Date(lastBackupAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last > days * DAY_MS
}

/** Pede ao navegador para não apagar os dados locais automaticamente. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/**
 * Botão "Compartilhar" do Android (Web Share Target): o sistema abre o app com
 * ?title=…&text=…&url=…  — guardamos o conteúdo e abrimos Imóveis com o formulário preenchido.
 * O conteúdo fica só no aparelho (sessionStorage) e é apagado ao ser usado.
 */
const KEY = 'ilp-shared-listing'

export function sharedTextFromSearch(search: string): string | null {
  const q = new URLSearchParams(search)
  const parts = ['title', 'text', 'url'].map((k) => q.get(k)?.trim()).filter((v): v is string => !!v)
  return parts.length ? parts.join('\n') : null
}

/** Chamado na abertura do app: se veio algo compartilhado, guarda e vai para Imóveis. */
export function captureSharedListing(): void {
  const text = sharedTextFromSearch(window.location.search)
  if (!text) return
  try {
    sessionStorage.setItem(KEY, text)
  } catch {
    return
  }
  window.history.replaceState(null, '', `${window.location.pathname}#/imoveis`)
}

/** Lê o anúncio compartilhado (sem apagar: o React pode ler duas vezes em desenvolvimento). */
export function getSharedListing(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Apaga o anúncio compartilhado depois de salvo ou cancelado. */
export function clearSharedListing(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

/** Exibido enquanto os dados locais são lidos (evita tela em branco em aparelhos lentos). */
export function Loading() {
  return (
    <div className="page">
      <p className="muted" role="status">
        Carregando…
      </p>
    </div>
  )
}

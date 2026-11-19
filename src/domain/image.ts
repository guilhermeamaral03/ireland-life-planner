/** Recorte central quadrado de uma imagem w×h. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h)
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side }
}

/** Iniciais (primeiro e último nome) para o avatar sem foto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Primeiro nome, para a saudação do Dashboard. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/** Lê uma foto, recorta em quadrado e reduz para `size` px (JPEG) — fica leve no banco e no backup. */
export async function resizeToDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('O arquivo escolhido não é uma imagem.')
  const bitmap = await createImageBitmap(file)
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height)
    const out = Math.min(size, side)
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}

import { useEffect, useId, useState } from 'react'

/**
 * Converte texto digitado em número.
 * Aceita "1234,5", "1234.5", "1.234,56", "50.000" (pt-BR) e "50,000" / "1,234.56" (formato irlandês).
 * Separador seguido de exatamente 3 dígitos em grupos = milhar (valores em euro não têm 3 decimais).
 * Vazio → null; inválido → NaN.
 */
export function parseNumber(text: string): number | null {
  let t = text.trim().replace(/\s/g, '')
  if (t === '') return null
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // o separador que aparece por último é o decimal
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(t)) {
    t = t.replace(/[.,]/g, '')
  } else if (lastComma >= 0) {
    t = t.replace(',', '.')
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

/** Para coordenadas: ponto ou vírgula sempre são separador decimal (sem milhar). */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN
}

const toText = (v: number | null) => (v === null ? '' : String(Math.round(v * 100) / 100).replace('.', ','))

interface Props {
  label: string
  value: number | null
  onChange(v: number | null): void
  min?: number
  suffix?: string
  hint?: string
  /** Avisa quando o texto digitado fica inválido (true) ou volta a ser válido (false). */
  onValidityChange?(invalid: boolean): void
  /** Número decimal puro (coordenadas): sem separador de milhar e sem arredondar a exibição. */
  decimal?: boolean
}

export function NumberField({ label, value, onChange, min, suffix, hint, onValidityChange, decimal }: Props) {
  const id = useId()
  const parse = decimal ? parseDecimal : parseNumber
  const show = (v: number | null) => (decimal ? (v === null || Number.isNaN(v) ? '' : String(v).replace('.', ',')) : toText(v))
  const [text, setText] = useState(() => show(value))
  const [invalid, setInvalid] = useState(false)

  // sincroniza quando o valor muda por fora (ex.: carregamento do banco)
  useEffect(() => {
    if (invalid) return // mantém o texto inválido e a mensagem até o usuário corrigir
    const current = parse(text)
    if (current !== value && !(current !== null && Number.isNaN(current))) {
      setText(show(value))
      setInvalid(false)
    }
  }, [value]) // text fica de fora de propósito: só reage a mudanças externas

  const handle = (raw: string) => {
    setText(raw)
    const n = parse(raw)
    if (n !== null && (Number.isNaN(n) || (min !== undefined && n < min))) {
      setInvalid(true)
      onValidityChange?.(true)
      onChange(null) // nunca deixa um valor antigo valendo enquanto o campo está inválido
      return
    }
    setInvalid(false)
    onValidityChange?.(false)
    onChange(n)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={text}
          aria-invalid={invalid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => handle(e.target.value)}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {invalid && <span className="field-error">Valor inválido</span>}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}

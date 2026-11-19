import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberField, parseDecimal, parseNumber } from './NumberField'

describe('parseNumber', () => {
  it('aceita vírgula, ponto e milhar pt-BR', () => {
    expect(parseNumber('1234,5')).toBe(1234.5)
    expect(parseNumber('1234.5')).toBe(1234.5)
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber(' 50000 ')).toBe(50000)
    expect(parseNumber('50.000')).toBe(50000)
    expect(parseNumber('1.250.000')).toBe(1250000)
    expect(parseNumber('12.50')).toBe(12.5)
    // formato irlandês/inglês colado de anúncios
    expect(parseNumber('50,000')).toBe(50000)
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('1,250,000')).toBe(1250000)
    expect(parseNumber('12,50')).toBe(12.5)
    expect(parseNumber('')).toBeNull()
    expect(Number.isNaN(parseNumber('abc'))).toBe(true)
    expect(Number.isNaN(parseNumber('1,2,3'))).toBe(true)
  })
})

describe('parseDecimal (coordenadas)', () => {
  it('ponto ou vírgula são sempre decimais', () => {
    expect(parseDecimal('51.898')).toBe(51.898)
    expect(parseDecimal('-8,472')).toBe(-8.472)
    expect(parseDecimal('0.123')).toBe(0.123)
    expect(parseDecimal('')).toBeNull()
    expect(Number.isNaN(parseDecimal('51.8.9'))).toBe(true)
  })

  it('campo de coordenada mostra todas as casas', () => {
    render(<NumberField label="Latitude" value={51.8985136} decimal onChange={() => {}} />)
    expect(screen.getByLabelText('Latitude')).toHaveValue('51,8985136')
  })
})

describe('NumberField', () => {
  const setup = (min?: number) => {
    const onChange = vi.fn()
    render(<NumberField label="Salário" value={null} onChange={onChange} min={min} />)
    return { onChange, input: screen.getByLabelText('Salário') }
  }

  it('exibe no máximo 2 casas decimais', () => {
    render(<NumberField label="Mercado" value={346.66666666666663} onChange={() => {}} />)
    expect(screen.getByLabelText('Mercado')).toHaveValue('346,67')
  })

  it('número válido chama onChange', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '1234,5' } })
    expect(onChange).toHaveBeenCalledWith(1234.5)
  })

  it('texto inválido mostra erro e limpa o valor (nada antigo fica na tela)', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '50000' } })
    fireEvent.change(input, { target: { value: '50k' } })
    expect(screen.getByText('Valor inválido')).toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('vazio chama onChange(null)', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('abaixo do mínimo é inválido', () => {
    const { onChange, input } = setup(0)
    fireEvent.change(input, { target: { value: '-5' } })
    expect(screen.getByText('Valor inválido')).toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

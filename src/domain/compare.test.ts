import { describe, expect, it } from 'vitest'
import { assignColorSlots, pruneSelection, toggleCompare } from './compare'

describe('toggleCompare', () => {
  it('adiciona até 4', () => {
    let sel: number[] = []
    for (const id of [1, 2, 3, 4]) {
      const r = toggleCompare(sel, id)
      expect(r.error).toBeNull()
      sel = r.selected
    }
    expect(sel).toEqual([1, 2, 3, 4])
  })

  it('bloqueia o 5º sem alterar a seleção', () => {
    const r = toggleCompare([1, 2, 3, 4], 5)
    expect(r).toEqual({ selected: [1, 2, 3, 4], error: 'Compare no máximo 4 cenários.' })
  })

  it('remove um já selecionado', () => {
    expect(toggleCompare([1, 2, 3], 2)).toEqual({ selected: [1, 3], error: null })
  })
})

describe('assignColorSlots', () => {
  it('cada cenário mantém sua cor; o novo pega o menor slot livre', () => {
    const a = assignColorSlots({}, [10, 20, 30])
    expect(a).toEqual({ 10: 0, 20: 1, 30: 2 })
    const b = assignColorSlots(a, [10, 30]) // 20 saiu
    expect(b).toEqual({ 10: 0, 30: 2 })
    const c = assignColorSlots(b, [10, 30, 40])
    expect(c).toEqual({ 10: 0, 30: 2, 40: 1 })
  })
})

describe('pruneSelection', () => {
  it('remove ids que não existem mais', () => {
    expect(pruneSelection([1, 2, 9], [1, 2, 3])).toEqual([1, 2])
  })
})

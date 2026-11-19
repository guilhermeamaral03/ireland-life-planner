import { describe, expect, it } from 'vitest'
import { bestBy, pruneSelection, toggleCompare } from './compare'

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

describe('pruneSelection', () => {
  it('remove ids que não existem mais', () => {
    expect(pruneSelection([1, 2, 9], [1, 2, 3])).toEqual([1, 2])
  })
})

describe('bestBy', () => {
  it('melhor por critério, empates incluídos, ignora sem dado', () => {
    const items = [{ v: 3 }, { v: 1 }, { v: null }, { v: 1 }]
    expect([...bestBy(items, (i) => i.v, 'min')]).toEqual([items[1], items[3]])
    expect([...bestBy(items, (i) => i.v, 'max')]).toEqual([items[0]])
    expect(bestBy([{ v: 1 }, { v: null }], (i) => i.v, 'min').size).toBe(0)
  })
  it('todos iguais → nenhum destaque', () => {
    expect(bestBy([{ v: 0 }, { v: 0 }], (i) => i.v, 'max').size).toBe(0)
  })
})

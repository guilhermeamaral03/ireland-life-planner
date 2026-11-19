import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ensureSeeded } from './db'
import { applyRentToExpenses } from './rent'

let aluguel: number

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
  aluguel = (await db.categories.where('name').equals('Aluguel').first())!.id!
})

const rentExpenses = () => db.expenses.where('categoryId').equals(aluguel).toArray()

describe('applyRentToExpenses', () => {
  it('sem despesa de aluguel → cria uma', async () => {
    expect(await applyRentToExpenses(950, 'Quarto em Douglas', () => true)).toBe('criada')
    const [e] = await rentExpenses()
    expect(e).toMatchObject({ name: 'Aluguel — Quarto em Douglas', amount: 950, frequency: 'mensal', kind: 'fixa' })
  })

  it('uma despesa de aluguel → atualiza valor e frequência', async () => {
    await db.expenses.add({ name: 'Meu aluguel', categoryId: aluguel, amount: 200, frequency: 'semanal', kind: 'fixa' })
    expect(await applyRentToExpenses(1100, 'Apto', () => true)).toBe('atualizada')
    const all = await rentExpenses()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ name: 'Meu aluguel', amount: 1100, frequency: 'mensal' })
  })

  it('várias despesas de aluguel → pede confirmação e substitui por uma', async () => {
    await db.expenses.bulkAdd([
      { name: 'A', categoryId: aluguel, amount: 500, frequency: 'mensal', kind: 'fixa' },
      { name: 'B', categoryId: aluguel, amount: 300, frequency: 'mensal', kind: 'fixa' },
    ])
    const ask = vi.fn().mockReturnValue(true)
    expect(await applyRentToExpenses(900, 'Casa', ask)).toBe('substituidas')
    expect(ask).toHaveBeenCalledWith(2)
    const all = await rentExpenses()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ name: 'Aluguel — Casa', amount: 900 })
  })

  it('confirmação negada → nada muda', async () => {
    await db.expenses.bulkAdd([
      { name: 'A', categoryId: aluguel, amount: 500, frequency: 'mensal', kind: 'fixa' },
      { name: 'B', categoryId: aluguel, amount: 300, frequency: 'mensal', kind: 'fixa' },
    ])
    expect(await applyRentToExpenses(900, 'Casa', () => false)).toBe('cancelado')
    expect(await rentExpenses()).toHaveLength(2)
  })

  it('aluguel inválido → erro', async () => {
    await expect(applyRentToExpenses(0, 'X', () => true)).rejects.toThrow('Aluguel inválido.')
  })
})

describe('applyRentToExpenses — toque duplo', () => {
  it('duas chamadas simultâneas não criam aluguel em dobro', async () => {
    await Promise.all([applyRentToExpenses(950, 'Apto', () => true), applyRentToExpenses(950, 'Apto', () => true)])
    expect(await rentExpenses()).toHaveLength(1)
  })
})

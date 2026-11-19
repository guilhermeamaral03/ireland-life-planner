import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSeeded, getSettings, hasUserData } from './db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('ensureSeeded', () => {
  it('cria as 15 categorias iniciais uma única vez', async () => {
    await ensureSeeded()
    await ensureSeeded()
    expect(await db.categories.count()).toBe(15)
  })

  it('atribui os grupos corretos', async () => {
    await ensureSeeded()
    const byName = async (n: string) => (await db.categories.where('name').equals(n).first())?.group
    expect(await byName('Aluguel')).toBe('moradia')
    expect(await byName('Combustível')).toBe('transporte')
    expect(await byName('Mercado')).toBe('outros')
  })
})

describe('getSettings', () => {
  it('cria configurações padrão vazias', async () => {
    const s = await getSettings()
    expect(s.grossAnnual).toBeNull()
    expect(s.projectionMonths).toBe(24)
    expect(await db.settings.count()).toBe(1)
  })
})

describe('hasUserData', () => {
  it('banco só com categorias iniciais e configurações vazias → falso', async () => {
    await ensureSeeded()
    await getSettings()
    expect(await hasUserData()).toBe(false)
  })
  it('com uma despesa → verdadeiro', async () => {
    await db.expenses.add({ name: 'X', categoryId: 1, amount: 1, frequency: 'mensal', kind: 'fixa' })
    expect(await hasUserData()).toBe(true)
  })
  it('com salário configurado → verdadeiro', async () => {
    await db.settings.put({ ...(await getSettings()), grossAnnual: 50000 })
    expect(await hasUserData()).toBe(true)
  })
})

describe('persistência', () => {
  it('mantém uma despesa após fechar e reabrir o banco', async () => {
    await db.expenses.add({ name: 'Netflix', categoryId: 1, amount: 13, frequency: 'mensal', kind: 'fixa' })
    db.close()
    await db.open()
    const all = await db.expenses.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Netflix')
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addCategory, deleteCategory } from './categories'
import { db, ensureSeeded } from './db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
})

describe('categorias personalizadas', () => {
  it('adiciona categoria nova', async () => {
    const id = await addCategory('Academia', 'outros')
    const c = await db.categories.get(id)
    expect(c).toMatchObject({ name: 'Academia', group: 'outros', builtIn: false })
  })

  it('remove espaços extras do nome', async () => {
    const id = await addCategory('  Pets  ', 'outros')
    expect((await db.categories.get(id))?.name).toBe('Pets')
  })

  it('recusa nome vazio', async () => {
    await expect(addCategory('   ', 'outros')).rejects.toThrow('Informe o nome.')
  })

  it('recusa duplicado, sem diferenciar maiúsculas', async () => {
    await addCategory('Academia', 'outros')
    await expect(addCategory('academia', 'outros')).rejects.toThrow('Já existe uma categoria com esse nome.')
    await expect(addCategory('mercado', 'outros')).rejects.toThrow('Já existe uma categoria com esse nome.')
  })

  it('não exclui categoria inicial', async () => {
    const aluguel = await db.categories.where('name').equals('Aluguel').first()
    await expect(deleteCategory(aluguel!.id!)).rejects.toThrow('Categorias iniciais não podem ser excluídas.')
  })

  it('não exclui categoria com despesas', async () => {
    const id = await addCategory('Academia', 'outros')
    await db.expenses.add({ name: 'Mensalidade', categoryId: id, amount: 40, frequency: 'mensal', kind: 'fixa' })
    await expect(deleteCategory(id)).rejects.toThrow('Há despesas nesta categoria. Mova ou exclua-as antes.')
  })

  it('exclui categoria personalizada vazia', async () => {
    const id = await addCategory('Academia', 'outros')
    await deleteCategory(id)
    expect(await db.categories.get(id)).toBeUndefined()
  })
})

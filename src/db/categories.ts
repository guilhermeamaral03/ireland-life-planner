import { db } from './db'
import type { CategoryGroup } from './types'

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  moradia: 'Moradia',
  transporte: 'Transporte',
  outros: 'Outros',
}

export async function addCategory(name: string, group: CategoryGroup): Promise<number> {
  const clean = name.trim()
  if (!clean) throw new Error('Informe o nome.')
  return db.transaction('rw', db.categories, async () => {
    const lower = clean.toLocaleLowerCase('pt-BR')
    const exists = await db.categories.filter((c) => c.name.toLocaleLowerCase('pt-BR') === lower).count()
    if (exists > 0) throw new Error('Já existe uma categoria com esse nome.')
    return (await db.categories.add({ name: clean, group, builtIn: false })) as number
  })
}

export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.expenses, async () => {
    const cat = await db.categories.get(id)
    if (!cat) return
    if (cat.builtIn) throw new Error('Categorias iniciais não podem ser excluídas.')
    if ((await db.expenses.where('categoryId').equals(id).count()) > 0) {
      throw new Error('Há despesas nesta categoria. Mova ou exclua-as antes.')
    }
    await db.categories.delete(id)
  })
}

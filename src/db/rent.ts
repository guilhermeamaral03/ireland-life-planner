import { db, ensureSeeded } from './db'

export type RentApplyResult = 'criada' | 'atualizada' | 'substituidas' | 'cancelado'

/**
 * "Usar este aluguel nas minhas despesas": Despesas continua sendo a fonte única do aluguel.
 * 0 despesas de Aluguel → cria; 1 → atualiza (mensal); várias → pede confirmação e substitui por uma.
 */
export async function applyRentToExpenses(
  rent: number,
  title: string,
  confirmReplace: (count: number) => boolean,
): Promise<RentApplyResult> {
  if (!(rent > 0)) throw new Error('Aluguel inválido.')
  await ensureSeeded()
  const cat = await db.categories.where('name').equals('Aluguel').first()
  if (!cat?.id) throw new Error('Categoria Aluguel não encontrada.')
  const current = await db.expenses.where('categoryId').equals(cat.id).toArray()

  if (current.length > 1 && !confirmReplace(current.length)) return 'cancelado'

  return db.transaction('rw', db.expenses, async () => {
    if (current.length === 1) {
      await db.expenses.update(current[0].id!, { amount: rent, frequency: 'mensal' })
      return 'atualizada'
    }
    if (current.length > 1) await db.expenses.bulkDelete(current.map((e) => e.id!))
    await db.expenses.add({ name: `Aluguel — ${title.trim()}`, categoryId: cat.id!, amount: rent, frequency: 'mensal', kind: 'fixa' })
    return current.length > 1 ? 'substituidas' : 'criada'
  })
}

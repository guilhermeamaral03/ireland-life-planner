import { useCallback, useEffect, useState } from 'react'
import { db, getSettings } from '../db/db'
import type { Category, Expense, Settings } from '../db/types'

export interface FinanceData {
  settings: Settings
  expenses: Expense[]
  categories: Category[]
}

/** Carrega configurações, despesas e categorias do banco local. */
export function useFinanceData() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [settings, expenses, categories] = await Promise.all([
        getSettings(),
        db.expenses.toArray(),
        db.categories.orderBy('name').toArray(),
      ])
      setData({ settings, expenses, categories })
    } catch (e) {
      setError(`Não foi possível ler os dados locais: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, setData, error, reload }
}

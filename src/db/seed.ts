import type { Category, CategoryGroup } from './types'

const groups: [CategoryGroup, string[]][] = [
  ['moradia', ['Aluguel', 'Eletricidade', 'Gás', 'Internet']],
  ['transporte', ['Transporte público', 'Combustível', 'Seguro automóvel', 'Manutenção automóvel']],
  ['outros', ['Celular', 'Mercado', 'Saúde', 'Lazer', 'Restaurantes', 'Compras', 'Outros']],
]

export const INITIAL_CATEGORIES: Category[] = groups.flatMap(([group, names]) =>
  names.map((name) => ({ name, group, builtIn: true })),
)

import { Loading } from '../components/Loading'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useFinanceData } from '../app/useFinanceData'
import { NumberField } from '../components/NumberField'
import { addCategory, deleteCategory, GROUP_LABELS } from '../db/categories'
import { db } from '../db/db'
import type { Category, CategoryGroup, Expense, Frequency } from '../db/types'
import {
  missingCommonExpenses,
  summarizeExpenses,
  toMonthly,
  validateExpense,
  type ExpenseDraft,
  type ExpenseErrors,
} from '../domain/expenses'
import { computeTax, ESTIMATE_DISCLAIMER } from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/format'
import './ExpensesPage.css'

const FREQ_LABELS: Record<Frequency, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

const EMPTY: ExpenseDraft = { name: '', categoryId: null, amount: null, frequency: 'mensal', kind: 'fixa' }

export function ExpensesPage() {
  const { data, error, reload } = useFinanceData()
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<ExpenseErrors>({})
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [formKey, setFormKey] = useState(0) // remonta o campo numérico ao limpar/editar

  const derived = useMemo(() => {
    if (!data) return null
    const tax = computeTax(data.settings, data.expenses, data.categories)
    const netMonthly = tax?.ok ? tax.netMonthly : null
    return { tax, netMonthly, summary: summarizeExpenses(data.expenses, data.categories, netMonthly) }
  }, [data])

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data || !derived) return <Loading />

  const catName = new Map(data.categories.map((c) => [c.id, c.name]))
  const { summary, tax } = derived

  const resetForm = () => {
    setDraft(EMPTY)
    setEditingId(null)
    setErrors({})
    setFormKey((k) => k + 1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validateExpense(draft)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const record: Expense = {
      name: draft.name.trim(),
      categoryId: draft.categoryId!,
      amount: draft.amount!,
      frequency: draft.frequency,
      kind: draft.kind,
    }
    try {
      if (editingId !== null) await db.expenses.put({ ...record, id: editingId })
      else await db.expenses.add(record)
      setMessage({ type: 'success', text: editingId !== null ? 'Despesa atualizada.' : 'Despesa adicionada.' })
      resetForm()
      await reload()
    } catch (err) {
      setMessage({ type: 'error', text: `Não foi possível salvar: ${String(err)}` })
    }
  }

  const edit = (x: Expense) => {
    setDraft({ name: x.name, categoryId: x.categoryId, amount: x.amount, frequency: x.frequency, kind: x.kind })
    setEditingId(x.id!)
    setErrors({})
    setFormKey((k) => k + 1)
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const remove = async (x: Expense) => {
    if (!window.confirm(`Excluir a despesa "${x.name}"?`)) return
    await db.expenses.delete(x.id!)
    if (editingId === x.id) resetForm()
    await reload()
  }

  const common = missingCommonExpenses(data.categories, data.expenses)
  const useCommon = (d: ExpenseDraft) => {
    setDraft(d)
    setEditingId(null)
    setErrors({})
    setFormKey((k) => k + 1)
    // o valor é a única coisa que falta: leva o cursor direto para ele
    setTimeout(() => document.querySelector<HTMLInputElement>('#expense-form input[inputmode]')?.focus(), 0)
  }

  const sorted = [...data.expenses].sort(
    (a, b) => toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency),
  )

  return (
    <div className="page">
      <header className="page-header">
        <h1>Despesas</h1>
        <p>Suas despesas mensais. Valores semanais, trimestrais e anuais são convertidos para o equivalente mensal.</p>
      </header>

      {message && <div className={`alert alert-${message.type}`} role="status">{message.text}</div>}

      <div className="kpis">
        <div className="kpi kpi-primary">
          <div className="kpi-label">Total mensal</div>
          <div className="kpi-value">{formatEUR(summary.totalMonthly)}</div>
          <div className="kpi-sub">
            Fixas {formatEUR(summary.fixedMonthly)} · Variáveis {formatEUR(summary.variableMonthly)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total anual</div>
          <div className="kpi-value">{formatEUR(summary.totalAnnual)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Renda comprometida</div>
          <div className="kpi-value">{formatPercent(summary.incomeShare)}</div>
          <div className="kpi-sub">do líquido mensal</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo após despesas</div>
          <div className={`kpi-value${summary.balance !== null && summary.balance < 0 ? ' negative' : ''}`}>
            {formatEUR(summary.balance)}
          </div>
          <div className="kpi-sub">
            Economia potencial: {summary.balance === null ? 'Não disponível' : formatEUR(Math.max(summary.balance, 0))}
          </div>
        </div>
      </div>
      {tax === null && (
        <p className="muted">
          Para ver a renda comprometida e o saldo, <Link to="/renda">informe seu salário no simulador</Link>.
        </p>
      )}
      {tax && !tax.ok && <p className="muted">Renda indisponível: {tax.reason}</p>}
      {tax?.ok && <p className="disclaimer">Renda líquida usada: {formatEUR(tax.netMonthly)}/mês. {ESTIMATE_DISCLAIMER}</p>}

      <section className="card" id="expense-form">
        <h2>{editingId !== null ? 'Editar despesa' : 'Adicionar despesa'}</h2>
        {editingId === null && common.length > 0 && (
          <div className="common-expenses">
            <span className="muted">Despesas comuns que faltam (toque e informe só o valor):</span>
            <div className="row">
              {common.map((c) => (
                <button key={c.name} type="button" className={`btn btn-sm${draft.name === c.name ? ' btn-primary' : ''}`} onClick={() => useCommon(c)}>
                  + {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <form className="form-grid" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="exp-name">Nome</label>
            <input
              id="exp-name"
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="exp-cat">Categoria</label>
            <CategorySelect
              id="exp-cat"
              categories={data.categories}
              value={draft.categoryId}
              onChange={(categoryId) => setDraft({ ...draft, categoryId })}
            />
            {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
          </div>
          <div>
            <NumberField
              key={formKey}
              label="Valor"
              value={draft.amount}
              min={0}
              suffix="€"
              onChange={(amount) => setDraft({ ...draft, amount })}
            />
            {errors.amount && <span className="field-error">{errors.amount}</span>}
          </div>
          <div className="field">
            <label htmlFor="exp-freq">Frequência</label>
            <select
              id="exp-freq"
              className="input"
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
            >
              {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABELS[f]}
                </option>
              ))}
            </select>
            {draft.amount !== null && draft.amount > 0 && draft.frequency !== 'mensal' && (
              <span className="field-hint">Equivale a {formatEUR(toMonthly(draft.amount, draft.frequency))}/mês</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="exp-kind">Tipo</label>
            <select
              id="exp-kind"
              className="input"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Expense['kind'] })}
            >
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </div>
          <div className="row form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId !== null ? 'Salvar alterações' : 'Adicionar'}
            </button>
            {editingId !== null && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Suas despesas</h2>
        {sorted.length === 0 ? (
          <p className="muted">Nenhuma despesa cadastrada.</p>
        ) : (
          <div className="table-wrap">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Despesa</th>
                  <th className="hide-sm">Categoria</th>
                  <th className="num hide-sm">Valor</th>
                  <th className="num">Por mês</th>
                  <th className="hide-sm">Tipo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.name}
                      <span className="show-sm muted">{catName.get(x.categoryId) ?? 'Sem categoria'}</span>
                    </td>
                    <td className="hide-sm">{catName.get(x.categoryId) ?? 'Sem categoria'}</td>
                    <td className="num hide-sm">
                      {formatEUR(x.amount)} <span className="muted">{FREQ_LABELS[x.frequency].toLowerCase()}</span>
                    </td>
                    <td className="num">{formatEUR(toMonthly(x.amount, x.frequency))}</td>
                    <td className="hide-sm">{x.kind === 'fixa' ? 'Fixa' : 'Variável'}</td>
                    <td>
                      <div className="row row-nowrap">
                        <button type="button" className="btn btn-sm" onClick={() => edit(x)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(x)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CustomCategories categories={data.categories} onChange={reload} />
    </div>
  )
}

function CategorySelect({
  id,
  categories,
  value,
  onChange,
}: {
  id: string
  categories: Category[]
  value: number | null
  onChange(v: number | null): void
}) {
  return (
    <select
      id={id}
      className="input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">Escolha…</option>
      {(Object.keys(GROUP_LABELS) as CategoryGroup[]).map((g) => (
        <optgroup key={g} label={GROUP_LABELS[g]}>
          {categories
            .filter((c) => c.group === g)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

function CustomCategories({ categories, onChange }: { categories: Category[]; onChange(): Promise<void> }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState<CategoryGroup>('outros')
  const [err, setErr] = useState<string | null>(null)
  const custom = categories.filter((c) => !c.builtIn)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await addCategory(name, group)
      setName('')
      setErr(null)
      await onChange()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    }
  }

  const remove = async (c: Category) => {
    if (!window.confirm(`Excluir a categoria "${c.name}"?`)) return
    try {
      await deleteCategory(c.id!)
      setErr(null)
      await onChange()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    }
  }

  return (
    <section className="card">
      <h2>Categorias personalizadas</h2>
      <p className="muted">
        O grupo indica como a categoria entra nos comparadores de moradia (Moradia e Transporte são substituídos pelo
        custo de cada imóvel).
      </p>
      {err && <div className="alert alert-error">{err}</div>}
      <form className="form-grid" onSubmit={add}>
        <div className="field">
          <label htmlFor="cat-name">Nome</label>
          <input id="cat-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cat-group">Grupo</label>
          <select
            id="cat-group"
            className="input"
            value={group}
            onChange={(e) => setGroup(e.target.value as CategoryGroup)}
          >
            {(Object.keys(GROUP_LABELS) as CategoryGroup[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </div>
        <div className="row form-actions">
          <button type="submit" className="btn">
            Adicionar categoria
          </button>
        </div>
      </form>
      {custom.length > 0 && (
        <ul className="cat-list">
          {custom.map((c) => (
            <li key={c.id}>
              <span>
                {c.name} <span className="muted">· {GROUP_LABELS[c.group]}</span>
              </span>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c)}>
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

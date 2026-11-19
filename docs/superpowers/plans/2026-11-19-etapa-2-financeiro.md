# Etapa 2 — Dashboard e financeiro: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulador de renda irlandês (2026 oficial, 2027 proposto), controle de despesas e Dashboard com indicadores reais.

**Architecture:** Regras fiscais em JSON por ano (`src/data/tax/`), motor de cálculo puro (`src/domain/tax.ts`), funções puras de despesas/projeção (`src/domain/expenses.ts`), páginas React lendo/escrevendo Dexie.

**Tech Stack:** existentes + `recharts` (gráficos).

**Spec:** `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md` (seções 7 e **13** — valores fiscais exatos e fontes).

## Global Constraints

- Todos os valores fiscais vêm da seção 13 do spec, com `source` (URL) e `status`. Nenhum valor fora dela.
- Status exibido: `oficial` → "Oficial"; `proposto` → "Proposto — Finance (No.2) Bill 2026 ainda não promulgado"; `nao_disponivel` → "Não disponível".
- Cálculos retornam números não arredondados; arredondamento só na exibição (`formatEUR`).
- Toda tela com resultado fiscal mostra: "Estimativa. Sua situação individual pode alterar os resultados."
- Entradas numéricas: vazio → `null`; negativo/não-numérico → mensagem de validação, nada salvo.
- Português BR, EUR, sem dados de exemplo.

## Review Focus

1. Salário vazio, 0, negativo ou texto → nenhum `NaN`/"€ NaN" na tela; mensagem de validação.
2. Valores exatamente nos limites (USC €13.000; PRSI €352 e €424 semanais; faixas) → cálculo correto.
3. Créditos maiores que o imposto → Income Tax 0 (nunca negativo); Rent Tax Credit limitado ao imposto.
4. 2027 + situação casado ou pai/mãe solteiro → mensagem "não disponível", nenhum número.
5. Despesas sem salário configurado → totais aparecem; "% da renda" e "saldo" mostram "Não disponível".

---

### Task 1: Regras fiscais em JSON + tipos

**Files:**
- Create: `src/data/tax/types.ts`, `src/data/tax/2026.json`, `src/data/tax/2027.json`, `src/data/tax/index.ts`, `src/data/tax/rules.test.ts`
- Modify: `tsconfig.app.json` (`"resolveJsonModule": true` se necessário)

**Interfaces:**
- Produces (`types.ts`):
  - `ParamStatus = 'oficial' | 'proposto' | 'nao_disponivel'`
  - `Param<T> = { value: T | null; status: ParamStatus; source: string }`
  - `Band = { upTo: number | null; rate: number }` (`upTo` acumulado; `null` = restante)
  - `TaxRules = { year: number; status: 'oficial' | 'proposto'; statusNote: string;`
    `incomeTax: { standardRate: Param<number>; higherRate: Param<number>; bands: { solteiro: Param<number>; pai_mae_solteiro: Param<number>; casado_uma_renda: Param<number>; casado_duas_rendas_base: Param<number>; casado_duas_rendas_max_increase: Param<number> }; credits: { personal_single: Param<number>; personal_married: Param<number>; employee: Param<number>; spcc: Param<number> }; rentCredit: { rate: Param<number>; max_single: Param<number>; max_couple: Param<number> } };`
    `usc: { exemption: Param<number>; bands: Param<Band[]>; reducedIncomeLimit: Param<number>; reducedBands: Param<Band[]> };`
    `prsi: { weeklyExemption: Param<number>; creditMax: Param<number>; creditUpTo: Param<number>; creditTaperDivisor: Param<number>; ratePeriods: Param<{ from: string; rate: number }[]> } }`
- Produces (`index.ts`): `TAX_YEARS: number[]` (`[2026, 2027]`), `getTaxRules(year: number): TaxRules | null`.
- Valores: exatamente os da seção 13. 2027: casados e SPCC (`pai_mae_solteiro`, `casado_*`, `personal_married`, `spcc`) → `value: null, status: 'nao_disponivel'`. Parâmetros "sem alteração anunciada" em 2027 → valor de 2026, `status: 'proposto'`, `source` = guia do Budget 2027. USC reduzida: limite €60.000, bandas 0,5% até €12.012 e 2% no restante (fonte: revenue.ie/en/jobs-and-pensions/usc/reduced-rates.aspx).

- [ ] **Step 1: Testes falhando** `rules.test.ts`:
  - `getTaxRules(2026)!.incomeTax.bands.solteiro.value === 44000`; `getTaxRules(2027)!.incomeTax.bands.solteiro.value === 46500`
  - `getTaxRules(2027)!.usc.bands.value` contém `{upTo: 30300, rate: 0.02}`; 2026 contém `{upTo: 28700, rate: 0.02}`
  - `getTaxRules(2027)!.incomeTax.bands.casado_uma_renda.status === 'nao_disponivel'`
  - `getTaxRules(2030) === null`
  - Para todos os anos, todo `Param` com `status !== 'nao_disponivel'` tem `value !== null` e `source` começando com `https://` (percorrer o objeto recursivamente).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar tipos, JSONs e `index.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: regras fiscais 2026 e 2027 em JSON com fontes`.

### Task 2: Motor de cálculo (Income Tax, USC, PRSI)

**Files:**
- Create: `src/domain/tax.ts`, `src/domain/tax.test.ts`

**Interfaces:**
- Consumes: `TaxRules`, `getTaxRules` (Task 1); `TaxStatus` (`src/db/types.ts`).
- Produces:
  - `TaxInput = { grossAnnual: number; status: TaxStatus; spouseGrossAnnual: number | null; annualRent: number; uscReducedRate: boolean; extraCredits: number }`
  - `TaxResult = { ok: true; year: number; rulesStatus: 'oficial' | 'proposto'; incomeTax: { band: number; grossTax: number; credits: { label: string; amount: number }[]; rentCredit: number; total: number; coupleTotal: number | null }; usc: { exempt: boolean; reduced: boolean; lines: { from: number; to: number; rate: number; amount: number }[]; total: number }; prsi: { weeklyEarnings: number; weeklyCredit: number; periods: { from: string; to: string; days: number; rate: number; amount: number }[]; total: number }; totalDeductions: number; netAnnual: number; netMonthly: number; netWeekly: number; effectiveRate: number }`
  - `TaxUnavailable = { ok: false; reason: string }`
  - `calcNetPay(input: TaxInput, rules: TaxRules): TaxResult | TaxUnavailable`
- Regras do motor (spec §13):
  - Qualquer `Param` necessário com `value === null` → `{ok:false, reason: 'Os parâmetros fiscais de {ano} para esta situação ainda não foram publicados.'}`. `casado_duas_rendas` sem `spouseGrossAnnual` → `{ok:false, reason:'Informe a renda do cônjuge.'}`.
  - Banda: solteiro / pai_mae_solteiro / casado_uma_renda direto; casado_duas_rendas = base + min(spouse, max_increase).
  - Casado duas rendas: imposto do **casal** sobre (user + spouse); créditos = personal_married + employee×2; `coupleTotal` = esse imposto; `total` (do usuário) = coupleTotal × user/(user+spouse) — **alocação proporcional (estimativa do app)**. Casado uma renda: créditos = personal_married + employee. Pai/mãe solteiro: personal_single + employee + spcc. Solteiro: personal_single + employee.
  - Créditos (incl. `extraCredits`) reduzem o imposto até 0. Rent credit = min(rate × annualRent, max_single ou max_couple (casados), imposto restante após os demais créditos).
  - USC (individual, só renda do usuário): renda ≤ exemption → 0. Reduzida se `uscReducedRate && gross ≤ reducedIncomeLimit`.
  - PRSI: `weeklyEarnings = gross/52`; ≤ weeklyExemption → 0; crédito = max(0, creditMax − (w − weeklyExemption)/divisor) se w ≤ creditUpTo; por período: `max(0, w×rate − crédito) × 52 × dias/diasDoAno`. Períodos: de `from` até o dia anterior ao próximo `from` (último até 31/12).
  - `netMonthly = netAnnual/12`, `netWeekly = netAnnual/52`, `effectiveRate = totalDeductions/gross` (gross 0 → 0).

- [ ] **Step 1: Testes falhando** (`toBeCloseTo(x, 2)` salvo indicação; valores calculados à mão a partir do spec §13):
  - **2026 solteiro €50.000:** incomeTax.total 7200; usc.total 1032.82; prsi.total 2118.90 (`toBeCloseTo(…,1)`); netAnnual 39648.28 (`,1`).
  - **2027 solteiro €50.000, aluguel €18.000/ano:** incomeTax.grossTax 10700; rentCredit 1150; incomeTax.total 5300; usc.total 1016.82; prsi.total 2193.90 (`,1`); netAnnual 41489.28 (`,1`).
  - **USC isenção 2026:** €13.000 → usc.total 0 e `exempt` true; €13.001 → usc.total 79.84; incomeTax.total 0 (nunca negativo); prsi.total 0 (semanal 250,02 ≤ 352).
  - **PRSI crédito 2026:** gross 377×52 = 19604 → prsi.weeklyCredit 7.8333 (`,3`); prsi.total 423.45 (`,1`).
  - **Pai/mãe solteiro 2026 €50.000:** incomeTax.band 48000; incomeTax.total 4500.
  - **USC reduzida 2026 €30.000:** usc.total 419.82; com €61.000 e flag → `reduced` false (taxas padrão).
  - **Casado duas rendas 2026:** user 60000, spouse 20000 → band 73000; coupleTotal 9400; incomeTax.total 7050; usc.total 1332.82; prsi.total 2542.68 (`,1`).
  - **Casado duas rendas sem spouse** → ok false, reason 'Informe a renda do cônjuge.'
  - **2027 casado_uma_renda** → ok false com reason contendo 'ainda não foram publicados'.
  - **Rent credit limitado ao imposto:** 2026 solteiro €21.000, aluguel €12.000 → imposto bruto 4200, créditos 4000, rentCredit 200, total 0.
  - **extraCredits** 500 em 2026 solteiro €50.000 → incomeTax.total 6700.
  - **gross 0** → netAnnual 0, effectiveRate 0, sem NaN em nenhum campo numérico.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `calcNetPay` e helpers internos (`applyBands`, `prsiForYear`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: motor de cálculo Income Tax, USC e PRSI`.

### Task 3: Despesas e projeção (domínio)

**Files:**
- Create: `src/domain/expenses.ts`, `src/domain/expenses.test.ts`
- Modify: `src/db/types.ts` (Settings + `spouseGrossAnnual: number | null`, `rentMonthlyOverride: number | null`), `src/db/db.ts` (`DEFAULT_SETTINGS` com ambos `null`; `taxYear` padrão continua `null` — a UI usa 2027 quando nulo)

**Interfaces:**
- Produces:
  - `toMonthly(amount: number, frequency: Frequency): number` — semanal ×52/12; mensal ×1; trimestral ÷3; anual ÷12.
  - `ExpenseSummary = { totalMonthly: number; totalAnnual: number; fixedMonthly: number; variableMonthly: number; byCategory: { categoryId: number; name: string; monthly: number }[]; incomeShare: number | null; balance: number | null; savingRate: number | null }`
  - `summarizeExpenses(expenses: Expense[], categories: Category[], netMonthly: number | null): ExpenseSummary` — `byCategory` ordenado por valor desc, só categorias com valor > 0; `incomeShare = totalMonthly/netMonthly`; `balance = netMonthly − totalMonthly`; `savingRate = max(balance,0)/netMonthly`; todos `null` se `netMonthly` null ou ≤ 0.
  - `monthlyRentFromExpenses(expenses: Expense[], categories: Category[]): number` — soma mensal da categoria "Aluguel".
  - `projectReserve(initial: number, monthlySaving: number, months: number): { month: number; value: number }[]` — meses 0..months, linear.

- [ ] **Step 1: Testes falhando:** `toMonthly(100,'semanal')` ≈ 433.33; `toMonthly(1200,'anual')` 100; `toMonthly(300,'trimestral')` 100; summarize com aluguel 1000/mês + seguro 600/ano + mercado 100/semana, net 3000 → totalMonthly ≈ 1483.33, incomeShare ≈ 0.4944, balance ≈ 1516.67, byCategory[0].name 'Aluguel'; com net null → incomeShare/balance/savingRate null; balance negativo → savingRate 0; `monthlyRentFromExpenses` = 1000; `projectReserve(1000, 500, 24)` tem 25 pontos, último 13000.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS (incl. testes antigos de db).
- [ ] **Step 5:** Commit `feat: domínio de despesas e projeção de reserva`.

### Task 4: Tela Simulador de renda

**Files:**
- Create: `src/pages/IncomePage.tsx`, `src/pages/IncomePage.css`, `src/components/NumberField.tsx`, `src/components/NumberField.test.tsx`
- Modify: `src/app/nav.ts` (habilitar `/renda`), `src/App.tsx` (rota)

**Interfaces:**
- Produces: `NumberField` — props `{ label: string; value: number | null; onChange(v: number | null): void; min?: number; suffix?: string; hint?: string }`; aceita vírgula ou ponto decimal; texto inválido ou < min mostra "Valor inválido" e **não** chama `onChange`; vazio chama `onChange(null)`.
- Consumes: `calcNetPay`, `getTaxRules`, `TAX_YEARS`, `monthlyRentFromExpenses`, `getSettings`.
- Tela: entradas (ano [padrão 2027], salário bruto anual, situação, renda do cônjuge [só casado duas rendas], aluguel mensal [padrão = das despesas, com botão "usar valor das despesas"], USC reduzida [checkbox, com explicação: cartão médico completo ou 70+], créditos extras [lista nome+valor], reserva atual, meses de projeção). Salva em `settings` ao alterar. Resultado: cards (líquido mensal, anual, semanal, % descontado), tabela de detalhamento (faixas IT, créditos, rent credit, linhas USC, períodos PRSI), selo de status do ano, aviso de estimativa, lista de fontes (links). Sem salário → "Informe o salário bruto anual para calcular."; `ok:false` → mostra `reason`.

- [ ] **Step 1: Teste falhando** `NumberField.test.tsx`: digitar "1.234,5"… usar `fireEvent.change` com "1234,5" → onChange(1234.5); "abc" → mostra "Valor inválido" e onChange não chamado; "" → onChange(null); "-5" com min 0 → "Valor inválido".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `NumberField`, `IncomePage`, rota e nav.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verificação no navegador:** 2026 solteiro 50000 mostra líquido anual € 39.648,28; trocar para 2027 + casado uma renda mostra mensagem de não disponível; salário "abc" não quebra; recarregar mantém valores; 375 px sem rolagem horizontal.
- [ ] **Step 6:** Commit `feat: tela do simulador de renda`.

### Task 5: Tela Despesas

**Files:**
- Create: `src/pages/ExpensesPage.tsx`, `src/pages/ExpensesPage.css`, `src/db/categories.ts`, `src/db/categories.test.ts`
- Modify: `src/app/nav.ts` (habilitar `/despesas`), `src/App.tsx`

**Interfaces:**
- Produces (`categories.ts`): `addCategory(name: string, group: CategoryGroup): Promise<number>` (nome vazio ou duplicado sem diferenciar maiúsculas → lança `Error('Já existe uma categoria com esse nome.')` / `'Informe o nome.'`); `deleteCategory(id: number): Promise<void>` (built-in → `Error('Categorias iniciais não podem ser excluídas.')`; com despesas → `Error('Há despesas nesta categoria. Mova ou exclua-as antes.')`).
- Tela: tabela de despesas (nome, categoria, valor, frequência, fixa/variável, equivalente mensal); formulário adicionar/editar (validação: nome obrigatório, valor > 0, categoria obrigatória); excluir com confirmação; seção "Categorias personalizadas" (adicionar com grupo, excluir); resumo: total mensal, anual, fixas × variáveis, % da renda, saldo, economia potencial (usa `calcNetPay` com os settings; sem renda → "Não disponível").

- [ ] **Step 1: Testes falhando** `categories.test.ts`: adicionar "Academia" grupo outros → existe; adicionar "academia" de novo → erro de duplicado; excluir built-in → erro; excluir categoria com despesa → erro; excluir custom vazia → removida.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `categories.ts`, `ExpensesPage`, rota, nav.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verificação no navegador:** adicionar/editar/excluir despesa; despesa anual aparece convertida; valor 0 ou vazio é recusado; sem salário, % da renda mostra "Não disponível"; com salário, saldo bate com líquido − total; recarregar mantém; 375 px ok.
- [ ] **Step 6:** Commit `feat: tela de despesas e categorias personalizadas`.

### Task 6: Dashboard com indicadores e gráficos

**Files:**
- Modify: `src/pages/DashboardPage.tsx`; Create: `src/pages/DashboardPage.css`, `src/domain/dashboard.ts`, `src/domain/dashboard.test.ts`
- `npm i recharts` — antes de escrever gráficos, carregar o skill `dataviz`.

**Interfaces:**
- Produces: `buildDashboard(settings: Settings, expenses: Expense[], categories: Category[]): DashboardData | { empty: true }` com `DashboardData = { grossAnnual; grossMonthly; tax: TaxResult | TaxUnavailable; summary: ExpenseSummary; reserve: number | null; projection: { month: number; value: number }[] | null }`. `empty` se `grossAnnual` null. Projeção só se `tax.ok` e `reserve` não nulo: `projectReserve(reserve, max(balance,0), projectionMonths)`.
- Tela: estado vazio (com link para `/renda`); cards: bruto anual, bruto mensal, líquido mensal, despesas mensais, saldo mensal, economia (valor e %), reserva atual ("Não informada" se nula); pizza por categoria (sem despesas → "Nenhuma despesa cadastrada"); linha de projeção (sem reserva → texto pedindo para informar a reserva no simulador); aviso de estimativa + status do ano fiscal.

- [ ] **Step 1: Testes falhando** `dashboard.test.ts`: settings sem salário → `{empty:true}`; settings 2026 solteiro 50000, reserva 1000, 24 meses, despesa 1000/mês → grossMonthly ≈ 4166.67, summary.balance ≈ 2304.02, projection tem 25 pontos e último ≈ 1000 + 24×2304.02; tax indisponível (2027 casado) → projection null e sem exceção.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `dashboard.ts` e a tela.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` sem erros.
- [ ] **Step 5: Verificação no navegador:** Dashboard vazio → configurar salário → indicadores batem com as telas de renda e despesas; gráficos visíveis; 375 px ok; limpar dados de teste ao final.
- [ ] **Step 6:** Commit `feat: dashboard com indicadores, distribuição e projeção`.

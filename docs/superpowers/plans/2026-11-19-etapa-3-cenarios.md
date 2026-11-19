# Etapa 3 — Cenários: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar, editar, duplicar, excluir e comparar (2–4) cenários financeiros com resultado e projeção ao vivo.

**Architecture:** Funções puras em `src/domain/scenarios.ts` (reaproveitam `calcNetPay`, `projectReserve`, `toMonthly`), página `/cenarios` com lista, editor e comparação; dados na tabela Dexie `scenarios` existente.

**Tech Stack:** existentes (React, Dexie, Recharts, Vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md` — seções 7 e **14**.

## Global Constraints

- Campo vazio no cenário = herda do simulador; a tela mostra o valor herdado como dica ("Simulador: € 50.000,00").
- Ano fiscal, USC reduzida e créditos extras sempre vêm do simulador.
- Resultado indisponível (`calcNetPay` ok:false ou sem salário) → mostra a razão, nunca números inventados nem NaN.
- Mesmas regras de entrada: `NumberField`, vazio → null, inválido → null.
- Português BR, EUR, aviso de estimativa em toda tela com resultado fiscal.

## Review Focus

1. Cenário sem salário próprio e simulador sem salário → "Informe o salário (no cenário ou no simulador)", sem números.
2. Excluir cenário que está selecionado na comparação → some da comparação sem erro.
3. Comparação com 1 cenário selecionado → pede pelo menos 2; tentar marcar o 5º → bloqueado com mensagem.
4. Nome vazio ou só espaços → não salva.
5. Valores de grupo vazios → tratados como 0 (não NaN).

---

### Task 1: Domínio dos cenários

**Files:**
- Modify: `src/db/types.ts` (`Scenario` ganha `taxStatus: TaxStatus | null` e `spouseGrossAnnual: number | null`)
- Create: `src/domain/scenarios.ts`, `src/domain/scenarios.test.ts`

**Interfaces:**
- Produces:
  - `SCENARIO_KEYS: ScenarioKey[]` na ordem aluguel, contas, alimentacao, transporte, pessoais, outros; `SCENARIO_LABELS: Record<ScenarioKey, string>` ("Aluguel", "Contas da casa", "Alimentação", "Transporte", "Despesas pessoais", "Outros").
  - `emptyScenario(name: string): Scenario` — todos os valores 0, substituições null.
  - `amountsFromExpenses(expenses: Expense[], categories: Category[]): Record<ScenarioKey, number>` — mapeamento da seção 14 (por nome para iniciais; por grupo para personalizadas).
  - `validateScenario(s: Scenario): string | null` — `'Informe o nome do cenário.'` se nome vazio; `'Valores não podem ser negativos.'` se algum < 0; senão null.
  - `ScenarioResult = { tax: TaxResult | TaxUnavailable; totalMonthly: number; balance: number | null; savingMonthly: number | null; savingAnnual: number | null; savingRate: number | null; reserve: number | null; projection: {month:number; value:number}[] | null }`
  - `computeScenario(s: Scenario, base: Settings): ScenarioResult` — gross = s.grossAnnual ?? base.grossAnnual (ambos null → tax `{ok:false, reason:'Informe o salário (no cenário ou no simulador).'}`); status = s.taxStatus ?? base.taxStatus ?? 'solteiro'; spouse = s.taxStatus !== null ? s.spouseGrossAnnual : base.spouseGrossAnnual; annualRent = aluguel×12; ano/USC/créditos de `base`. `totalMonthly` = soma dos 6 valores (null/NaN → 0). `balance = netMonthly − totalMonthly`; `savingMonthly = max(balance,0)`; `savingAnnual = savingMonthly×12`; `savingRate = savingMonthly/netMonthly`; `reserve = s.initialReserve ?? base.initialReserve`; `projection = projectReserve(reserve, balance, base.projectionMonths)` se tax ok e reserve ≠ null, senão null.
- Consumes: `calcNetPay`, `getTaxRules`, `effectiveYear`, `projectReserve`, `toMonthly`.

- [ ] **Step 1: Testes falhando** `scenarios.test.ts`:
  - `amountsFromExpenses` com Aluguel 1000/mês, Internet 50, Mercado 100/semana, Combustível 1200/ano, Lazer 80, custom "Academia" (outros) 40, custom "Condomínio" (moradia) 60 → aluguel 1000; contas 110; alimentacao ≈ 433.33; transporte 100; pessoais 80; outros 40.
  - base = DEFAULT_SETTINGS + taxYear 2026, grossAnnual 50000, initialReserve 1000; cenário com aluguel 1000, alimentação 400 → tax.ok; tax.incomeTax.rentCredit 1000 (teto 2026); totalMonthly 1400; balance ≈ netMonthly − 1400; projection[24] ≈ 1000 + 24×balance.
  - cenário com grossAnnual 60000 sobrepõe; cenário com taxStatus 'casado_uma_renda' → band 53000.
  - base sem salário e cenário sem salário → tax.ok false com a razão exata; projection null.
  - valores com NaN → totalMonthly ignora (0).
  - `validateScenario`: nome '  ' → mensagem de nome; aluguel −1 → mensagem de negativo; válido → null.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS; `npx tsc -b` limpo.
- [ ] **Step 5:** Commit `feat: domínio de cenários`.

### Task 2: Tela de cenários (lista + editor)

**Files:**
- Create: `src/pages/ScenariosPage.tsx`, `src/pages/ScenariosPage.css`, `src/components/ScenarioEditor.tsx`
- Modify: `src/app/nav.ts` (habilitar `/cenarios`), `src/App.tsx`, `src/app/AppShell.test.tsx` (exemplo de item desabilitado passa a ser "Mapa de Cork"/"Etapa 4")

**Interfaces:**
- Consumes: Task 1; `useFinanceData`; `NumberField`.
- Lista: cards com nome, líquido mensal, despesas, saldo (ou razão de indisponível); botões Editar, Duplicar ("<nome> (cópia)"), Excluir (confirmação). Botões "Novo cenário" e "Novo a partir das minhas despesas". Sem cenários → texto explicando e os dois botões.
- Editor (mesma página, substitui a lista enquanto aberto): nome; seção "Renda" (salário, situação fiscal com opção "Igual ao simulador", renda do cônjuge quando a situação efetiva for casado com duas rendas); seção "Despesas mensais" (6 `NumberField`, vazio = 0); reserva inicial; painel de resultado ao vivo (líquido, despesas, saldo, economia mensal/anual, % economia, reserva em N meses); Salvar (valida com `validateScenario`), Cancelar.

- [ ] **Step 1:** Atualizar `AppShell.test.tsx` (item desabilitado = "Mapa de Cork", "Etapa 4") → `npm test` FAIL até habilitar `/cenarios`... (o teste antigo usa "Cenários"; com a troca ele passa a falhar só se "Mapa de Cork" não estiver desabilitado — rodar e confirmar PASS após a troca, já que Mapa continua desabilitado).
- [ ] **Step 2:** Implementar página, editor, rota e nav.
- [ ] **Step 3:** `npm test` → PASS; `npx tsc -b` limpo.
- [ ] **Step 4: Verificação no navegador:** criar cenário vazio e a partir de despesas; editar valores e ver resultado mudar ao vivo; nome vazio bloqueia; trocar situação fiscal no cenário; duplicar; excluir; recarregar mantém; 375 px sem rolagem lateral.
- [ ] **Step 5:** Commit `feat: tela de cenários`.

### Task 3: Comparação lado a lado

**Files:**
- Create: `src/components/ScenarioCompare.tsx`, `src/domain/compare.ts`, `src/domain/compare.test.ts`
- Modify: `src/pages/ScenariosPage.tsx` (checkbox "Comparar" em cada card + seção de comparação)

**Interfaces:**
- Produces: `toggleCompare(selected: number[], id: number, max = 4): { selected: number[]; error: string | null }` — adiciona/remove; 5º → `error: 'Compare no máximo 4 cenários.'` sem alterar; `pruneSelection(selected: number[], existingIds: number[]): number[]`.
- Comparação (≥ 2 selecionados; senão "Selecione pelo menos 2 cenários para comparar."): tabela com uma coluna por cenário e linhas: salário bruto, situação fiscal, líquido mensal, aluguel, contas, alimentação, transporte, pessoais, outros, despesas totais, saldo, economia mensal, economia anual, % economia, reserva em N meses; destaque discreto (negrito) do maior saldo — sem pontuação. Gráfico de linhas com a projeção de cada cenário (legenda + rótulo no fim de cada linha), paleta categórica validada com `validate_palette.js` antes do uso.

- [ ] **Step 1: Testes falhando** `compare.test.ts`: adicionar 1,2,3,4 ok; 5º → erro e lista inalterada; remover existente; `pruneSelection([1,2,9],[1,2,3])` → `[1,2]`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `compare.ts`; validar paleta; implementar `ScenarioCompare` e integrar.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` ok.
- [ ] **Step 5: Verificação no navegador:** comparar 2, 3 e 4; 5º bloqueado; excluir um selecionado; tabela e gráfico em 375 px (tabela pode rolar dentro do card; página não); limpar dados de teste.
- [ ] **Step 6:** Commit `feat: comparação de cenários`.

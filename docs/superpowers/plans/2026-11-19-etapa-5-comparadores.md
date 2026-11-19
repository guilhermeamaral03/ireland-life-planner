# Etapa 5 — Comparador de localidades e Imóveis: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparar localidades (custo, acesso, economia) e cadastrar/comparar imóveis com impacto no salário líquido.

**Architecture:** Função pura única de composição de custo (`src/domain/housing.ts`) usada pelos dois comparadores; páginas `/comparador` e `/imoveis`; rota de carro de imóveis via `fetchCarRoute` existente.

**Tech Stack:** existentes.

**Spec:** `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md` — seções 7 e **17**.

## Global Constraints

- Cada parcela do custo mostra a origem: "do imóvel", "da localidade", "das suas despesas", "incluídas no aluguel".
- Sem pontuação final; destaques só entre itens com dado.
- Faixas (mín–máx) nunca colapsadas num número único.
- Mesmo padrão de validação: campos inválidos bloqueiam salvar e escondem resultado.
- Comparações: 2 a 4 itens (`toggleCompare`), cor segue o item (`assignColorSlots`).

## Review Focus

1. Sem salário (ou imposto indisponível) → custos aparecem; saldo/economia "Não disponível".
2. Localidade sem faixa de aluguel → custo e economia "Não disponível" (não usar 0).
3. Imóvel com contas não incluídas e sem valor → usa contas das despesas, rotulado; nunca 0 silencioso.
4. Excluir localidade vinculada a imóvel → imóvel mantém-se, mostra "Localidade excluída".
5. Registros antigos de localidade sem `transportMonthly` → tratados como vazio, sem NaN.

---

### Task 1: Domínio de custo de moradia

**Files:** Create `src/domain/housing.ts`, `src/domain/housing.test.ts`; Modify `src/db/types.ts` (`Location.transportMonthly: Sourced<number>`), `src/domain/locations.ts` (`blankLocationFields` inclui `transportMonthly`; `isUntouched` considera)

**Interfaces:**
- `BaselineExpenses = { bills: number; transport: number; other: number }` e `baselineFromExpenses(expenses, categories): BaselineExpenses` — bills = grupo moradia exceto categoria "Aluguel"; transport = grupo transporte; other = grupo outros (mensal).
- `Part = { value: number; origin: 'item' | 'despesas' | 'incluidas' }`
- `HousingCost = { rent: { min: number; max: number } | null; bills: Part; transport: Part; other: number; total: { min: number; max: number } | null; balance: { min: number; max: number } | null; saving: { min: number; max: number } | null }`
- `housingCost(input: { rent: {min:number;max:number} | null; bills: number | 'incluidas' | null; transport: number | null }, base: BaselineExpenses, netMonthly: number | null): HousingCost` — total = rent + bills + transport + other (null se rent null); balance = net − total (min↔max invertidos: balance.min = net − total.max); saving = max(balance,0) por ponta; null sem net.
- `locationCost(l: Location, base, net)` e `propertyCost(p: Property, base, net)` — adaptadores (imóvel: rent {v,v}; bills `billsIncluded ? 'incluidas' : billsMonthly`).
- `bestBy<T>(items: T[], score: (t: T) => number | null, prefer: 'min' | 'max'): Set<T>` — empates incluídos; itens sem dado ignorados; < 2 com dado → vazio.

- [ ] **Step 1: Testes falhando** (valores à mão): base {bills 150, transport 100, other 400}; net 3000; localidade com aluguel 1200–1500 sem transporte → total 1850–2150, balance 850–1150 (min = 3000−2150), saving igual; com transporte da localidade 140 → total 1890–2190 e `transport.origin` 'item'; sem faixa → total/balance null; net null → total ok, balance null; imóvel 1300 contas incluídas transporte null → bills 0 origin 'incluidas', total 1800; imóvel contas não incluídas sem valor → bills 150 origin 'despesas'; `baselineFromExpenses` com Aluguel 1000, Internet 50, Eletricidade 100, Combustível 100, Mercado 400 → {150,100,400}; `bestBy` empate e < 2 dados; localidade antiga sem `transportMonthly` (undefined) → origin 'despesas', sem NaN.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + tsc.
- [ ] **Step 5:** Commit `feat: domínio de custo de moradia`.

### Task 2: Campo de transporte na ficha + Comparador de localidades

**Files:** Modify `src/components/LocationSheet.tsx` (seção "Custo mensal de transporte até Cork City" com valor + fonte + data); Create `src/pages/LocationComparePage.tsx`, `src/pages/LocationComparePage.css`; Modify `nav.ts` (habilitar `/comparador`), `App.tsx`, `AppShell.test.tsx` (exemplo desabilitado continua "Segurança").

- Página: lista de localidades com checkbox (ordem alfabética, referência primeiro; busca), máximo 4; tabela com colunas por localidade: aluguel (faixa + fonte), contas (origem), transporte (origem), outras despesas, custo mensal (faixa), saldo (faixa), economia (faixa), linha reta, carro (km/min, rótulo), transporte público (min + status), dependência de carro, transporte público (texto), infraestrutura, serviços, supermercados, segurança ("Etapa 6"). Destaques (negrito + legenda): menor aluguel máx., menor tempo de carro, maior economia no pior caso. Aviso de estimativa; sem salário → link para o simulador.

- [ ] **Step 1:** Implementar. **Step 2:** `npm test` + tsc + build.
- [ ] **Step 3: Navegador:** preencher aluguel/transporte em 2 localidades, comparar 3 (uma sem dados) → faixas corretas, "Não disponível" onde falta, destaques só entre as com dado; 375 px; limpar dados.
- [ ] **Step 4:** Commit `feat: comparador de localidades`.

### Task 3: Imóveis (cadastro, lista, comparação)

**Files:** Create `src/domain/properties.ts`, `src/domain/properties.test.ts`, `src/pages/PropertiesPage.tsx`, `src/pages/PropertiesPage.css`, `src/components/PropertyForm.tsx`; Modify `nav.ts` (habilitar `/imoveis`), `App.tsx`.

**Interfaces:**
- `emptyProperty(): Property`; `validateProperty(p: Property): string | null` — título obrigatório; aluguel > 0; depósito/contas/transporte ≥ 0 quando informados; contas não incluídas sem valor é permitido (usa despesas); lat/lng: ambos ou nenhum, e válidos; URL, se informada, começa com http(s).
- Form: título, link, localidade (select + "Nenhuma"), endereço, lat/lng (decimais, opcionais), tipo, aluguel mensal (minha parte), depósito, contas incluídas (checkbox) / valor das contas, moradores (informativo), data do anúncio/consulta, transporte mensal, tempo de transporte público (min + status + fonte), observações, favorito. Com posição: rota OSRM até Cork City ao salvar quando a posição muda (mesma regra de `prepareLocationSave`).
- Lista: cards (título, localidade ou "Localidade excluída", tipo, aluguel, custo total, saldo; favorito ★; link "Ver anúncio"); filtro favoritos; checkbox comparar (2–4).
- Comparação: tabela com todos os campos + composição do custo e saldo/economia; destaque menor custo total e maior saldo.

- [ ] **Step 1: Testes falhando** `properties.test.ts`: `validateProperty` (título vazio; aluguel 0; só lat; URL "ftp://x"; válido → null).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar domínio + telas. **Step 4:** PASS + tsc + build.
- [ ] **Step 5: Navegador:** cadastrar 2 imóveis (um com contas incluídas, um sem valor de contas), conferir composição e origens; editar; favoritar; comparar; excluir localidade vinculada → "Localidade excluída"; 375 px; limpar dados.
- [ ] **Step 6:** Commit `feat: cadastro e comparação de imóveis`.

# Etapa 6 — Segurança: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dados oficiais de ocorrências (CSO CJA11) por estação da Garda, associados às localidades, com classificação transparente pela tendência.

**Architecture:** Parser JSON-stat puro (`src/services/cso.ts`) que extrai só as estações de Cork; dados guardados numa tabela Dexie nova (`crimeStations`); classificação pura (`src/domain/safety.ts`); página `/seguranca`; integração na ficha do mapa, filtro do mapa e comparador.

**Tech Stack:** existentes (Recharts para a linha de tendência).

**Spec:** `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md` — seções 7 (Módulo 6) e **18**.

## Global Constraints

- Toda classificação mostra: "Avaliação do app sobre a tendência da estação — não é nível de segurança nem estatística oficial." + critério em uso.
- Toda tela com números mostra fonte (CSO CJA11, link), data de atualização do CSO, data da consulta e as limitações (área da estação ≠ localidade; sujeito a revisão; fraude não comparável; sem taxa por habitante).
- Sem estação associada ou dados insuficientes → "Dados insuficientes" (nunca uma classificação).
- Cores de status sempre com texto (nunca só cor).

## Review Focus

1. CSO fora do ar / resposta inesperada → mensagem clara, dados anteriores preservados.
2. Estação com anos `null` (sem dado) → não contam como zero; poucos anos → "Dados insuficientes".
3. Média de base 0 → "Dados insuficientes" (sem divisão por zero / Infinity).
4. Localidade cuja estação some numa atualização → volta a "Dados insuficientes", sem erro.
5. Backup antigo sem a tabela nova → importa sem erro.

---

### Task 1: Parser do CSO + armazenamento

**Files:** Create `src/services/cso.ts`, `src/services/cso.test.ts`, `src/services/__fixtures__/cja11-mini.json` (JSON-stat reduzido com a mesma estrutura: 2 estações de Cork, 1 de fora, 3 ofensas, 5 anos, com um `null`); Modify `src/db/types.ts`, `src/db/db.ts` (versão 3: tabela `crimeStations: 'code'`), `TABLE_NAMES` (+ `crimeStations`), `src/pages/SettingsPage.tsx` (rótulo da tabela na pré-visualização do backup)

**Interfaces:**
- `CrimeStation = { code: string; name: string; division: string; counts: Record<string /*ano*/, Record<string /*ofensa*/, number | null>>; csoUpdated: string; fetchedAt: string }`
- `OFFENCES: Record<string, string>` — rótulos pt-BR dos 14 tipos (03 Agressões, ameaças e assédio; 04 Atos perigosos ou negligentes; 05 Sequestro; 06 Roubo e extorsão; 07 Arrombamento (burglary); 08 Furto; 09 Fraude; 10 Drogas; 11 Armas e explosivos; 12 Dano a patrimônio; 13 Ordem pública; 14 Trânsito; 15 Contra a justiça; 16 Outras).
- `CSO_CJA11_URL`, `parseCja11(json: unknown, fetchedAt: string): CrimeStation[]` — só estações cuja label contém "Cork City Division" ou "Cork County Division"; `name` = texto antes da primeira vírgula; lança `Error('Formato inesperado da tabela do CSO.')` se faltar dimensão.
- `fetchCja11(fetchFn = fetch): Promise<{ ok: true; stations: CrimeStation[] } | { ok: false; reason: string }>`
- `saveStations(stations: CrimeStation[]): Promise<void>` — substitui a tabela numa transação.

- [ ] **Step 1: Testes falhando:** fixture → 2 estações (a de fora descartada); `name` "Ballincollig"; `counts['2024']['07']` = valor do fixture; `null` preservado; JSON sem dimensão → erro; `fetchCja11` com fetch que rejeita → `ok:false` "Não foi possível baixar os dados do CSO (sem internet ou serviço fora do ar)."; `saveStations` substitui; backup antigo sem `crimeStations` importa (tabela vazia).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + tsc.
- [ ] **Step 5:** Commit `feat: dados de ocorrências do CSO (CJA11) por estação da Garda`.

### Task 2: Classificação + associação estação ↔ localidade

**Files:** Create `src/domain/safety.ts`, `src/domain/safety.test.ts`; Modify `src/db/types.ts` (`Location.gardaStation: { code: string; origin: 'nome' | 'usuario' } | null`; `Settings.safetyCriteria: { offences: string[]; baselineYears: number; moderatePct: number; highPct: number }`), `src/db/db.ts` (padrão: offences ['03','06','07','08','12','13'], baseline 3, moderate 5, high 15), `src/domain/locations.ts` (`normalizeLocation` → `gardaStation ?? null`)

**Interfaces:**
- `SafetyLevel = 'baixa' | 'moderada' | 'elevada' | 'insuficiente'`
- `classifyStation(st: CrimeStation | undefined, c: SafetyCriteria): { level: SafetyLevel; latestYear: number | null; latest: number | null; baseline: number | null; changePct: number | null; reason: string }` — anos ordenados; usa só anos em que **todas** as ofensas escolhidas têm valor não nulo; precisa de `baselineYears + 1` anos consecutivos no fim; baseline = média dos N anteriores ao último; baseline 0 → insuficiente; changePct = (latest − baseline)/baseline×100; > high → elevada; > moderate → moderada; senão baixa. `reason` explica em pt-BR (ex.: "2025: 412 ocorrências vs. média 2022–2024 de 380 (+8,4%)").
- `yearlyTotals(st, offences): { year: number; total: number | null }[]`
- `autoMatchStations(locations: Location[], stations: CrimeStation[]): Map<number, string>` — só localidades sem `gardaStation` e cujo nome (sem acento, minúsculo) é igual ao `name` da estação.
- `SAFETY_LABELS`: baixa "Baixa atenção", moderada "Atenção moderada", elevada "Atenção elevada", insuficiente "Dados insuficientes".

- [ ] **Step 1: Testes falhando** (valores à mão): estação com totais 100,100,100,120 (anos 2022–2025) → +20% elevada; 100,100,100,110 → +10% moderada; 100,100,100,103 → baixa; 100,100,100,80 → baixa; um ano `null` no meio → insuficiente se não sobrarem 4 consecutivos; baseline 0 → insuficiente; sem estação → insuficiente; critérios alterados (high 25) → +20% vira moderada; `autoMatchStations` casa "Ballincollig", ignora localidade já associada e "Cork City".
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: classificação de segurança pela tendência`.

### Task 3: Página Segurança + integração

**Files:** Create `src/pages/SafetyPage.tsx`, `src/pages/SafetyPage.css`, `src/components/SafetyBadge.tsx`; Modify `nav.ts` (habilitar `/seguranca`), `App.tsx`, `AppShell.test.tsx` (sem item desabilitado: teste passa a verificar que todos os 9 são links), `LocationSheet.tsx` (fato "Segurança": selo + motivo + link para /seguranca), `MapPage.tsx` (filtro "Com dados de segurança"), `domain/locations.ts` (`filterLocations` + `withSafety`), `LocationComparePage.tsx` (linha Segurança).

- Página: botão "Atualizar dados do CSO" (mostra data da consulta e "atualizado pelo CSO em …"); na primeira vez sem dados, explicação + botão; ao baixar, aplica `autoMatchStations` e informa quantas foram associadas. Lista de localidades: estação (select com estações de Cork, opção "Nenhuma", origem), selo, motivo. Detalhe da localidade selecionada: tabela por tipo de ofensa (últimos 5 anos, `null` = "—"), linha da soma dos tipos escolhidos por ano (Recharts, 1 série, sem legenda), limitações. Seção "Critérios" editável (tipos, anos de base, limites) com validação (moderate < high, base 2–5).
- [ ] **Step 1:** Implementar. **Step 2:** `npm test` + tsc + build.
- [ ] **Step 3: Navegador:** baixar dados reais do CSO; conferir associação automática; escolher estação para Cork City; ver selo e motivo batendo com a tabela; alterar critério e ver mudar; ficha do mapa e comparador mostram o selo; filtro do mapa; offline (simular fetch falhando) mantém dados; 375 px; limpar dados de teste.
- [ ] **Step 4:** Commit `feat: página de segurança e integração com mapa e comparador`.

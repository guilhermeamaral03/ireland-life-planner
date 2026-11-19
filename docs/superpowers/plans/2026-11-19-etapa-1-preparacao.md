# Etapa 1 — Preparação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Base do app funcionando: projeto PWA instalável, banco local completo (schema de todos os módulos), backup/importação, navegação e padrão visual — no PC e no celular.

**Architecture:** SPA React/TS (Vite) com HashRouter; dados em IndexedDB via Dexie; funções de domínio puras testadas com Vitest; PWA via vite-plugin-pwa.

**Tech Stack:** React, TypeScript, Vite, Dexie, react-router-dom, vite-plugin-pwa, Vitest, fake-indexeddb (só testes), @testing-library/react (só testes).

**Spec:** `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md`

## Global Constraints

- Interface em português (BR); moeda EUR formatada com `Intl.NumberFormat('pt-BR', {style:'currency', currency:'EUR'})`; distâncias em km.
- Nenhum valor de demonstração; ausência de dado → texto exato "Não disponível".
- Nenhum dado do usuário enviado para fora do aparelho.
- Sem login, sem nuvem, sem scraping.
- Cor primária verde escuro `#1F4D3A`; tons neutros; sem animações supérfluas.
- Layout funciona em 375 px de largura sem rolagem horizontal.
- Navegação na ordem: Dashboard, Simulador de renda, Despesas, Cenários, Mapa de Cork, Segurança, Comparador de localidades, Imóveis, Configurações.

**Decisão desta etapa (do implementador):** os 7 módulos ainda não construídos aparecem no menu **desabilitados**, com o rótulo "Etapa N", em vez de telas vazias. Cada um é habilitado na etapa em que for implementado.

## Review Focus

1. Importar um arquivo que não é backup do app (JSON qualquer, arquivo corrompido, versão de schema maior) → recusa com mensagem clara e **nenhum dado apagado**.
2. Importar backup válido → substitui tudo; os dados anteriores não sobrevivem misturados.
3. Recarregar a página → dados continuam (persistência real, não estado em memória).
4. Abrir no iPhone fora da tela inicial → aviso "Adicione à Tela de Início" aparece; no app instalado, não aparece.
5. Primeira abertura → categorias iniciais criadas uma única vez (recarregar não duplica).

---

### Task 1: Projeto, git e testes

**Files:**
- Create: `ireland-life-planner/` via `npm create vite@latest . -- --template react-ts` (a pasta já contém `docs/`)
- Create: `.gitignore` (node_modules, dist), `src/domain/format.ts`, `src/domain/format.test.ts`
- Modify: `package.json` (script `"test": "vitest run"`), `vite.config.ts` (`base: './'`, bloco `test: { environment: 'jsdom' }`)

**Interfaces:**
- Produces: `formatEUR(value: number | null | undefined): string` — retorna "Não disponível" para null/undefined/NaN; `formatKm(value: number | null | undefined): string` — `"12,3 km"` (1 casa decimal) ou "Não disponível".

- [ ] **Step 1:** `git init` em `ireland-life-planner/`, scaffold Vite react-ts, `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom`.
- [ ] **Step 2: Teste falhando** `format.test.ts`:
  ```ts
  expect(formatEUR(1234.5)).toBe('€ 1.234,50')   // ajustar ao formato real pt-BR se o Intl usar espaço não separável: comparar com .replace(/\s/g,' ')
  expect(formatEUR(null)).toBe('Não disponível')
  expect(formatEUR(NaN)).toBe('Não disponível')
  expect(formatKm(12.34)).toBe('12,3 km')
  expect(formatKm(undefined)).toBe('Não disponível')
  ```
- [ ] **Step 3:** `npm test` → FAIL (módulo inexistente).
- [ ] **Step 4:** Implementar `format.ts`.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → sem erros.
- [ ] **Step 6:** Commit `chore: scaffold Vite React TS + Vitest` (inclui `docs/`).

### Task 2: Banco local (schema completo + seed de categorias)

**Files:**
- Create: `src/db/types.ts`, `src/db/db.ts`, `src/db/seed.ts`, `src/db/db.test.ts`
- `npm i dexie` · `npm i -D fake-indexeddb`

**Interfaces:**
- Produces (`types.ts`), todos com `id?: number` exceto Settings (`id: 'main'`):
  - `CategoryGroup = 'moradia' | 'transporte' | 'outros'`
  - `Category { name; group: CategoryGroup; builtIn: boolean }`
  - `Frequency = 'semanal' | 'mensal' | 'trimestral' | 'anual'`
  - `Expense { name; categoryId: number; amount: number; frequency: Frequency; kind: 'fixa' | 'variavel' }`
  - `Settings { id:'main'; taxYear: number|null; grossAnnual: number|null; taxStatus: 'solteiro'|'pai_mae_solteiro'|'casado_uma_renda'|'casado_duas_rendas'|null; payFrequency: 'semanal'|'quinzenal'|'mensal'; prsiClass: 'A'; uscReducedRate: boolean; extraCredits: {name:string; amount:number}[]; initialReserve: number|null; projectionMonths: number; lastBackupAt: string|null }`
  - `Scenario { name; grossAnnual: number|null; amounts: Record<'aluguel'|'contas'|'alimentacao'|'transporte'|'pessoais'|'outros', number>; initialReserve: number|null }`
  - `Sourced<T> = { value: T|null; source: string|null; date: string|null; status?: 'confirmado'|'estimado' }`
  - `Location { name; lat: number; lng: number; coordSource: string; favorite: boolean; description; infrastructure; publicTransport; supermarkets; services; residentialProfile; notes: string; rentRange: Sourced<{min:number;max:number}>; carRoute: Sourced<{km:number; minutes:number}>; transitMinutes: Sourced<number>; carDependency: Sourced<'baixa'|'media'|'alta'>; links: string[] }`
  - `SafetyRecord { locationId: number; area: string; periodStart: string; periodEnd: string; category: string; count: number; source: string; updatedAt: string; limitations: string }`
  - `Property { title; url; locationId: number|null; address; lat: number|null; lng: number|null; type: 'quarto'|'studio'|'apartamento'|'casa'; rent: number; deposit: number|null; billsIncluded: boolean; billsMonthly: number|null; residents: number|null; listedAt: string|null; carRoute: Sourced<{km:number;minutes:number}>; transitMinutes: Sourced<number>; transportMonthly: number|null; notes; favorite: boolean }`
- Produces (`db.ts`): `db` (Dexie "ireland-life-planner", version 1; tabelas `settings`, `categories`, `expenses`, `scenarios`, `locations`, `safetyRecords`, `properties`; índices: `categories: '++id,name'`, `expenses: '++id,categoryId'`, `safetyRecords: '++id,locationId'`, `properties: '++id,locationId,favorite'`, demais `'++id'`, settings `'id'`); `ensureSeeded(): Promise<void>`; `getSettings(): Promise<Settings>` (cria padrão com todos os campos nulos, `payFrequency:'mensal'`, `prsiClass:'A'`, `uscReducedRate:false`, `extraCredits:[]`, `projectionMonths:24`).
- Seed: 15 categorias do escopo. Grupo `moradia`: Aluguel, Eletricidade, Gás, Internet. Grupo `transporte`: Transporte público, Combustível, Seguro automóvel, Manutenção automóvel. Demais (Celular, Mercado, Saúde, Lazer, Restaurantes, Compras, Outros): `outros`. Locations **não** são semeadas aqui (Etapa 4).

- [ ] **Step 1: Testes falhando** (`import 'fake-indexeddb/auto'`; limpar o banco em `beforeEach`):
  - `ensureSeeded` cria 15 categorias; chamar duas vezes continua 15.
  - `Aluguel` tem `group === 'moradia'`, `Combustível` tem `'transporte'`, `Mercado` tem `'outros'`.
  - `getSettings()` sem dados retorna `grossAnnual === null` e `projectionMonths === 24`, e grava o registro (`db.settings.count() === 1`).
  - Gravar uma `Expense`, fechar e reabrir `db` → a despesa continua lá.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `types.ts`, `db.ts`, `seed.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: schema Dexie e categorias iniciais`.

### Task 3: Backup, importação e apagar dados

**Files:**
- Create: `src/db/backup.ts`, `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `db`, tipos da Task 2.
- Produces:
  - `BackupFile { app: 'ireland-life-planner'; schemaVersion: 1; exportedAt: string; tables: Record<TableName, unknown[]> }`
  - `exportBackup(): Promise<BackupFile>` — também grava `settings.lastBackupAt` (o valor exportado é o anterior à gravação, tudo bem).
  - `parseBackup(text: string): { ok: true; data: BackupFile; counts: Record<TableName, number> } | { ok: false; error: string }` — mensagens exatas: `"Arquivo inválido: não é um JSON."`, `"Arquivo inválido: não é um backup do Ireland Life Planner."`, `"Backup de versão mais nova (v{n}). Atualize o app antes de importar."`
  - `importBackup(data: BackupFile): Promise<void>` — em **uma transação** `rw` sobre todas as tabelas: limpa e insere.
  - `clearAllData(): Promise<void>` — limpa tudo e chama `ensureSeeded()`.
  - `downloadBackup(): Promise<void>` — gera arquivo `ireland-life-planner-backup-AAAA-MM-DD.json` (UI).

- [ ] **Step 1: Testes falhando:**
  - Roundtrip: gravar 1 despesa + 1 cenário → `exportBackup` → `clearAllData` → `importBackup` → despesa e cenário iguais aos originais.
  - Import substitui: existente "A", backup com "B" → após import só "B".
  - `parseBackup('xx')` → `{ok:false, error:'Arquivo inválido: não é um JSON.'}`; `parseBackup('{}')` → erro "não é um backup"; `schemaVersion: 2` → erro de versão.
  - Import com falha no meio (ex.: `tables.expenses` contendo item não-objeto que faz `bulkAdd` lançar) → dados anteriores intactos.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `backup.ts`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: backup, importação e limpeza de dados`.

### Task 4: Padrão visual, navegação, Dashboard vazio e Configurações

**Files:**
- Create: `src/styles/theme.css` (variáveis: `--green-900:#1F4D3A`, `--green-700`, `--green-100`, neutros `--gray-50…900`, `--danger`, `--warning`, espaçamentos, raio, fonte system-ui), `src/styles/base.css` (cards, tabelas, botões, inputs, `.empty-state`)
- Create: `src/app/nav.ts`, `src/app/AppShell.tsx`, `src/app/AppShell.test.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/SettingsPage.tsx`
- Modify: `src/main.tsx` (HashRouter, `ensureSeeded()` antes do render), `src/App.tsx`; remover CSS/arquivos de demonstração do template Vite
- `npm i react-router-dom`

**Interfaces:**
- Produces: `NAV_ITEMS: { path: string; label: string; stage: number; enabled: boolean }[]` na ordem das Global Constraints; paths: `/`, `/renda`, `/despesas`, `/cenarios`, `/mapa`, `/seguranca`, `/comparador`, `/imoveis`, `/configuracoes`; habilitados nesta etapa: `/` e `/configuracoes`; stages: renda 2, despesas 2, cenários 3, mapa 4, comparador 5, imóveis 5, segurança 6.
- Layout: ≥ 900 px menu lateral fixo; < 900 px barra superior com botão "Menu" que abre o menu sobreposto. Itens desabilitados: cinza, não clicáveis, sufixo "Etapa N".
- Dashboard: sem `grossAnnual` → estado vazio "Configure o simulador de renda para ver seus indicadores." (o botão para o simulador entra na Etapa 2).
- Configurações (nesta etapa): Exportar backup (mostra data do último backup ou "Nunca"); Importar backup (input de arquivo → `parseBackup` → pré-visualização das contagens por tabela → confirmação "Isso substituirá todos os dados deste aparelho. Continuar?" → `importBackup`); Apagar todos os dados (confirmação dupla).

- [ ] **Step 1: Teste falhando** `AppShell.test.tsx`: renderiza os 9 rótulos na ordem; "Simulador de renda" tem `aria-disabled="true"` e texto "Etapa 2"; "Configurações" é link para `#/configuracoes`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar estilos, `nav.ts`, `AppShell`, páginas e rotas.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Verificação no navegador** (`npm run dev`): desktop e viewport 375×812 — menu funciona, sem rolagem horizontal; exportar baixa o arquivo; importar arquivo inválido mostra erro e não apaga nada; importar o arquivo exportado funciona; recarregar mantém dados.
- [ ] **Step 6:** Commit `feat: navegação, padrão visual e configurações de backup`.

### Task 5: PWA instalável + proteção de dados no iPhone

**Files:**
- Create: `public/icon.svg` (folha/casa simples em `#1F4D3A`), PNGs gerados `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon-180x180.png`, `maskable-icon-512x512.png`
- Create: `src/app/storage.ts`, `src/app/storage.test.ts`, `src/app/InstallNotice.tsx`
- Modify: `vite.config.ts` (VitePWA: `registerType:'autoUpdate'`, manifest `name:'Ireland Life Planner'`, `short_name:'Life Planner'`, `lang:'pt-BR'`, `theme_color:'#1F4D3A'`, `background_color:'#F7F7F5'`, `display:'standalone'`, `start_url:'./'`), `index.html` (`lang="pt-BR"`, apple-touch-icon, `apple-mobile-web-app-capable`), `AppShell.tsx` (renderiza `InstallNotice`)
- `npm i -D vite-plugin-pwa @vite-pwa/assets-generator`

**Interfaces:**
- Produces: `isIOS(ua: string, maxTouchPoints: number): boolean` (iPhone/iPad, incl. iPadOS que se declara Mac com touch); `isStandalone(): boolean`; `backupOverdue(lastBackupAt: string|null, now: Date, days = 14): boolean` (null → true); `requestPersistence(): Promise<boolean>` (chama `navigator.storage?.persist?.()`, falso se indisponível).
- `InstallNotice`: iOS e não standalone → "No iPhone, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) para que o Safari não apague seus dados."; `backupOverdue` → "Seu último backup tem mais de 14 dias." com link para Configurações. Pode ser dispensado por sessão.

- [ ] **Step 1: Testes falhando** `storage.test.ts`: UA de iPhone Safari → `isIOS` true; UA Android Chrome → false; UA Mac + `maxTouchPoints 5` → true; `backupOverdue(null, …)` true; backup há 15 dias → true; há 3 dias → false.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `storage.ts`, `InstallNotice`, gerar ícones (`npx pwa-assets-generator --preset minimal-2023 public/icon.svg`), configurar VitePWA; chamar `requestPersistence()` no `main.tsx`.
- [ ] **Step 4:** `npm test` → PASS; `npm run build && npm run preview`.
- [ ] **Step 5: Verificação no navegador** (preview): manifest válido e service worker registrado (DevTools/Application ou `navigator.serviceWorker.controller`); após carregar uma vez, recarregar offline continua abrindo o app.
- [ ] **Step 6:** Criar `README.md` curto: como rodar (`npm install`, `npm run dev`, `npm test`, `npm run build`).
- [ ] **Step 7:** Commit `feat: PWA instalável e avisos de proteção de dados`.

---

**Fora desta etapa (registrado para não esquecer):** publicação no GitHub Pages e teste no Android/iPhone reais ficam para quando houver módulos úteis (fim da Etapa 2), com sua confirmação e conta GitHub.

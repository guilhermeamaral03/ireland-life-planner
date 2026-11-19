# Simplificação + Perfil — Implementation Plan

> Executado em linha (superpowers:executing-plans). Spec: seção **19** do design.

## Global Constraints
- Nenhum dado existente apagado; campos removidos da tela permanecem no tipo/banco.
- Dashboard é o único lugar com saldo/economia/projeção.
- Português BR; perfil local, sem login.

## Review Focus
1. Backup antigo com cenários/rentMonthlyOverride → importa; nada quebra.
2. Foto grande (ex.: 12 MP) → reduzida para ≤ 256 px antes de salvar.
3. "Usar este aluguel" com 0, 1 e várias despesas de Aluguel.
4. Rent Tax Credit ignora `rentMonthlyOverride` antigo salvo.
5. Imóvel antigo com campos extras continua abrindo e salvando.

### Task 1: Perfil
- `src/domain/image.ts`: `squareCrop(w, h): { sx: number; sy: number; side: number }` (recorte central) — testado; `resizeToDataUrl(file, size=256)` (canvas, JPEG 0,85).
- Settings + `profileName: string` (''), `profilePhoto: string | null`.
- Configurações → seção Perfil (nome, escolher foto, remover). AppShell mostra avatar (foto ou iniciais) + nome; Dashboard "Olá, nome".
- Teste: `squareCrop(4000,3000)` → `{sx:500, sy:0, side:3000}`; `squareCrop(300,600)` → `{sx:0, sy:150, side:300}`.

### Task 2: Remover Cenários e aluguel do Simulador
- Remover item de menu/rota e arquivos de Cenários (página, editor, comparação, domínio e testes).
- `computeTax` usa só `monthlyRentFromExpenses` (testar que `rentMonthlyOverride` antigo é ignorado). Remover `rentMonthlyFor`/`netMonthlyForRent` se ficarem sem uso.
- AppShell.test: 8 itens.

### Task 3: Imóveis enxuto + "Usar este aluguel"
- `applyRentToExpenses(rent: number, title: string, confirmReplace: () => boolean): Promise<'criada'|'atualizada'|'substituidas'|'cancelado'>` em `src/db/rent.ts` — testado (0/1/várias, cancelado).
- PropertyForm/PropertiesPage reduzidos; remover `housing.ts`, `HousingFormat.tsx` e testes se sem uso.

### Task 4: Comparador e ficha só com fatos
- Comparador sem linhas de custo/líquido/saldo/economia; ficha sem custo mensal de transporte.

### Task 5: Verificação, revisão, README

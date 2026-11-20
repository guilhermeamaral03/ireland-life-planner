# Ireland Life Planner

App pessoal para planejar finanças e escolher onde morar no Condado de Cork, Irlanda.
Funciona no computador e no celular (app instalável), em português, com valores em euro.

**Seus dados ficam somente no aparelho** (banco do navegador). Nada é enviado a servidores.
As únicas consultas externas levam apenas dados públicos ou coordenadas:
mapas (OpenStreetMap), rota de carro (OSRM) e ocorrências registradas (CSO).

Design completo e decisões: `docs/superpowers/specs/2026-11-19-ireland-life-planner-design.md`.

---

## Módulos

| Menu | O que faz |
|---|---|
| **Dashboard** | O único lugar com as contas: salário bruto/líquido, despesas, saldo, economia, reserva, distribuição e projeção. **"E se eu alugar um imóvel favorito?"** recalcula líquido e saldo com o aluguel de cada favorito. |
| **Simulador de renda** | Income Tax, USC, PRSI e Rent Tax Credit (usa o aluguel de Despesas), com detalhamento e fontes. 2026 (oficial) e 2027 (proposto). |
| **Despesas** | Todos os gastos, inclusive o aluguel (fonte única); frequência semanal, mensal, trimestral ou anual; categorias personalizadas. Despesas comuns em um toque (você informa só o valor). |
| **Mapa de Cork** | 31 localidades (OpenStreetMap), ficha editável, distância em linha reta, rota de carro (OSRM, todas de uma vez) e link de transporte público. Ordena por tempo de carro, filtra "até X min" e mostra os imóveis salvos em cada localidade. |
| **Segurança** | Ocorrências por estação da Garda (CSO, tabela CJA11) e avaliação da **tendência** — não é estatística oficial. |
| **Comparador de localidades** | Fatos de 2 a 4 localidades: aluguel, distância, tempos, imóveis salvos, dependência de carro, segurança e notas. Botão **"Enviar comparação"** gera um resumo em texto para o WhatsApp. |
| **Imóveis** | Anúncios para controle. Colando o link (Daft) ou o texto do anúncio, título, tipo, localidade, aluguel e contas são preenchidos; no Android dá para usar o botão **Compartilhar**. Botão **"Usar este aluguel nas minhas despesas"**. |
| **Configurações** | Perfil (nome e foto, sem login), backup, importação e apagar dados. |

Fluxo: **Simulador → Despesas → Dashboard**. As demais telas são de consulta — cada informação é digitada uma vez.

## Regras de honestidade dos dados

- Nada é inventado: sem dado, aparece **"Não disponível"**.
- Toda estimativa é rotulada (ex.: "estimativa sem trânsito — OSRM", "proposto — Finance Bill ainda não promulgado").
- A avaliação de segurança mostra o critério, a estação usada e as limitações.

## Fontes

| Dado | Fonte |
|---|---|
| Regras fiscais | Revenue, Citizens Information, gov.ie — links em cada arquivo `src/data/tax/<ano>.json` e na tela do simulador |
| Localidades (posição) | OpenStreetMap / Nominatim (consulta em 19/11/2026) |
| Rota de carro | OSRM público (`router.project-osrm.org`), sem trânsito |
| Ocorrências | CSO PxStat **CJA11** — Recorded crime incidents (New Garda Operating Model) |

---

## Usar em mais de um aparelho

Cada aparelho tem o próprio banco. Para levar seus dados:
1. No aparelho de origem: **Configurações → Exportar backup** (gera um arquivo `.json`).
2. Envie o arquivo para o outro aparelho (e-mail para você mesmo, Google Drive etc.).
3. No outro aparelho: **Configurações → Importar backup**. A importação **substitui** os dados daquele aparelho.

Faça backup com frequência: o app lembra quando o último tem mais de 14 dias.

### iPhone

Use sempre pelo ícone da **Tela de Início** (Safari → Compartilhar → *Adicionar à Tela de Início*).
Aberto só como site, o Safari pode apagar os dados após alguns dias sem uso.

### Android

Chrome → menu ⋮ → **Instalar app**.

---

## Atualizar regras fiscais

Quando a Revenue publicar valores novos (ex.: Finance Bill promulgado, casados em 2027):
1. Edite `src/data/tax/<ano>.json` — cada parâmetro tem `value`, `status` (`oficial` / `proposto` / `nao_disponivel`) e `source` (URL).
2. Rode `npm test` (os testes conferem que todo valor tem fonte).
3. Gere e publique de novo (`npm run build`). O app instalado se atualiza sozinho.

Ano novo: crie `src/data/tax/<ano>.json` e registre-o em `src/data/tax/index.ts`.

---

## Rodar no computador

Requisitos: Node.js 22+ (desenvolvido com Node 26).
**A pasta do projeto não pode ter `$` no caminho** — o Vite corrompe o caminho e a página fica em branco.

```powershell
npm install        # instala as dependências
npm run dev        # app em http://localhost:5173 (desenvolvimento)
npm test           # testes automáticos
npm run build      # gera a versão de produção em dist/
npm run preview    # serve dist/ em http://localhost:4173
```

O navegador embutido do app Claude bloqueia *service workers*; para testar a instalação/uso offline,
use o Chrome ou o celular.

## Estrutura

```
src/
  data/tax/        regras fiscais por ano (JSON com fontes)
  data/seed/       localidades iniciais (versões de lote)
  domain/          cálculos puros e testados (impostos, despesas, cenários, moradia, segurança…)
  services/        clientes externos (OSRM, CSO)
  db/              banco local (Dexie/IndexedDB), backup e importação
  pages/ components/ app/   telas
docs/superpowers/  design (spec) e planos de cada etapa
```

# Ireland Life Planner — Documento de Design

Data: 2026-11-19 · Status: **aprovado pelo usuário em 2026-11-19**

## 1. Intenção

App pessoal para decidir **onde morar no Condado de Cork** e **quanto dá para poupar**, com números reais: salário líquido pelas regras da Revenue, despesas, cenários, mapa, segurança e imóveis. Regra central: **nenhum dado inventado**; o que não existe aparece como "Não disponível".

Usuários: uso individual — cada pessoa usa no próprio aparelho (Android ou iPhone), com as próprias finanças. Não há finanças compartilhadas entre aparelhos.

## 2. Objetivos / Não-objetivos / Anti-objetivos

**Objetivos:** os 8 módulos + Configurações do escopo original; funcionar no PC, no Android e no iPhone; dados só no aparelho; backup/exportação/importação.

**Não-objetivos (v1):** login; sincronização automática entre aparelhos; scraping de portais; pontuação final de localidades; juros/inflação nas projeções; finanças conjuntas; tema escuro.

**Anti-objetivos (seria fracasso mesmo funcionando):** um número estimado parecer oficial; um valor de exemplo parecer real; uma classificação de segurança sem dados; perda silenciosa de dados no iPhone.

## 3. Restrições

- Português (BR), EUR (€), km.
- Dados financeiros nunca enviados a serviços externos.
- Internet usada apenas para: carregar o app, tiles do OpenStreetMap, rotas de carro OSRM (só coordenadas) e (Etapa 6, se viável) dados públicos de criminalidade do CSO — requisições que não carregam dados pessoais.
- Ambiente: Node 26.13, npm 11.20, git 2.56. Sem Rust/Python.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras | Decisão |
|---|---|---|---|
| Servidor local Node + SQLite + navegador | simples, um banco só | celular só no mesmo Wi-Fi com o PC ligado | descartada (precisa usar na rua) |
| Electron | janela própria | não roda em celular | descartada |
| **PWA (app web instalável) com dados no aparelho** | roda em PC, Android e iPhone, offline, sem servidor de dados | bancos separados por aparelho; código precisa ser hospedado em https | **escolhida pelo usuário** |

Consequências aceitas pelo usuário: código publicado num host estático gratuito (só código, nenhum dado); troca de dados entre aparelhos por arquivo de backup.

## 5. Arquitetura

**Stack** (justificativa em uma linha cada):
- React + TypeScript + Vite — pedido no escopo.
- `vite-plugin-pwa` — gera manifest e service worker (instalação e uso offline).
- **Dexie (IndexedDB)** no lugar de SQLite — banco nativo do navegador, estável no iPhone; SQLite-WASM é menos confiável no Safari. *Decisão técnica documentada aqui por desviar do escopo.*
- `react-router` com HashRouter — funciona em hospedagem estática sem configuração de servidor.
- Leaflet + react-leaflet + tiles OpenStreetMap — pedido no escopo.
- Recharts — gráficos para React, gratuito.
- Vitest — testes de cálculo e persistência.
- CSS próprio com variáveis (sem framework de UI) — menos dependências.

**Hospedagem:** GitHub Pages (requer conta GitHub; repositório público contém só código). Alternativa equivalente: Cloudflare Pages. Feita só na etapa de publicação, com confirmação do usuário.

**Estrutura:**
```
ireland-life-planner/
  src/
    domain/        # funções puras: impostos, despesas, projeções, distâncias (testadas)
    data/tax/      # regras fiscais por ano: 2026.json (+ fontes)
    data/seed/     # localidades iniciais (nome + coordenadas + fonte)
    db/            # schema Dexie, backup/import
    pages/         # uma por item do menu
    components/    # cards, tabelas, formulários reutilizados
  docs/
```

## 6. Dados (tabelas Dexie)

- `settings` (registro único): perfil fiscal (salário bruto, situação, créditos, frequência, classe PRSI, flags USC), reserva inicial, data do último backup.
- `categories`: 15 iniciais + personalizadas; campo `group` (`moradia`, `transporte`, `outros`) usado pelos comparadores.
- `expenses`: nome, categoria, valor, frequência (semanal/mensal/trimestral/anual), fixa/variável.
- `scenarios`: nome, salário (opcional, senão usa o atual), valores por grupo (aluguel, contas, alimentação, transporte, pessoais, outros), reserva inicial.
- `locations`: nome, coordenadas, descrição, infraestrutura, transporte público, supermercados, serviços, perfil residencial, observações, favorito, faixa de aluguel (+fonte+data), distância rodoviária e tempo de viagem (+modal, +status `confirmado`/`estimado`, +fonte), dependência de carro, links.
- `safetyRecords`: localidade, estação Garda/área, período, categoria, nº de ocorrências, fonte, data de atualização, limitações.
- `properties`: todos os campos do Módulo 8.

Todo valor factual tem campo de **fonte**; sem valor → "Não disponível".

## 7. Módulos — comportamento

**Simulador de renda.** Motor puro `calcNetPay(perfil, regras)` sobre `data/tax/<ano>.json`: faixas e alíquotas de Income Tax por situação, créditos, faixas de USC (incl. taxa reduzida), PRSI (com datas de vigência — a alíquota pode mudar no meio do ano). Valores de 2026 **buscados nas fontes oficiais (Revenue, gov.ie) na Etapa 2**, com URL registrada no JSON. Mostra detalhamento faixa a faixa e aviso de estimativa. Situações suportadas: solteiro, pai/mãe solteiro(a), casado(a) com uma renda, casado(a) com duas rendas (dado de entrada da própria pessoa).

**Despesas.** CRUD; conversão para mensal (semanal ×52/12, trimestral ÷3, anual ÷12); totais mensal/anual; % da renda líquida; saldo; economia potencial = saldo positivo.

**Dashboard.** Indicadores do escopo calculados a partir de settings + expenses; gráfico de pizza por categoria; projeção linear da reserva (reserva inicial + economia mensal × meses, 24 meses). Sem dados → estado vazio com botão "Configurar simulador".

**Cenários.** Criar/editar/duplicar/excluir; botão "preencher com minhas despesas atuais"; resultados recalculam ao digitar; comparação lado a lado de 2–4 cenários (tabela + gráfico de projeção).

**Mapa.** Leaflet centrado no County Cork; marcadores das 6 localidades iniciais (coordenadas do OpenStreetMap, com fonte); adicionar localidade clicando no mapa; favoritos; filtros (favoritos, com dados de aluguel, com dados de segurança, busca por nome); ficha lateral (no celular: painel inferior). Distância em **linha reta calculada** (Haversine), rotulada como tal. **Carro:** distância rodoviária e tempo obtidos automaticamente do serviço público OSRM (router.project-osrm.org, dados OpenStreetMap), rotulados "estimativa sem trânsito — fonte OSRM", com data da consulta, guardados no banco (consulta só ao criar/mover o ponto ou ao clicar "recalcular"); só coordenadas são enviadas. Falha/offline → "Não disponível" + botão tentar de novo. **Transporte público:** botão "Ver trajeto de transporte público" abre Google Maps (directions, modo transit) ou o planejador TFI com origem/destino preenchidos; o usuário pode registrar o tempo como "confirmado" com fonte. Vale para localidades e imóveis com posição no mapa.

**Segurança.** Registros por localidade; classificação visual (Baixa / Moderada / Elevada / Dados insuficientes) **calculada pelo app, rotulada como não oficial**, com critério configurável e explicado na tela; padrão "Dados insuficientes". Fonte preferida: CSO "Recorded Crime Offences by Garda Station" (estatística *under reservation*; área da estação ≠ cidade — limitação exibida). Importação via API PxStat se o navegador permitir (verificar na Etapa 6); senão, entrada manual com fonte.

**Comparador de localidades.** Seleciona 2+ localidades; tabela com todos os critérios do escopo; custo mensal = faixa de aluguel da localidade + despesas do usuário fora do grupo moradia; economia estimada como faixa (mín–máx). Sem pontuação final; destaques por critério (ex.: "menor aluguel") apenas onde há dados.

**Imóveis.** CRUD manual; custo total = aluguel + contas (0 se incluídas, senão valor informado) + transporte informado; impacto: saldo = líquido − custo do imóvel − despesas fora dos grupos moradia/transporte; comparação lado a lado; favoritos.

**Configurações.** Perfil fiscal, ano fiscal, categorias, exportar backup (JSON com versão de schema), importar (substitui tudo, com confirmação e pré-visualização), apagar todos os dados.

## 8. Mobile e iPhone

Layout responsivo: menu lateral no desktop, menu inferior/hambúrguer no celular. No iPhone, o Safari pode apagar dados de sites não instalados → app mostra aviso "Adicione à Tela de Início", chama `navigator.storage.persist()` e exibe lembrete de backup se o último tiver mais de 14 dias.

## 9. Design visual

Verde escuro primário (#1F4D3A aprox.), neutros, cards de indicadores, tabelas legíveis, sem animações supérfluas. Valores de demonstração não existem; dados vazios mostram "Não disponível".

## 10. Qualidade

Testes Vitest para: cálculo fiscal (casos conferidos à mão contra as regras oficiais), conversão de frequência, projeções, Haversine, roundtrip de backup. Verificação manual no navegador (desktop e viewport mobile) de cada módulo antes de considerá-lo concluído.

## 11. Decisões de quem implementa (marcadas como minhas)

- IndexedDB/Dexie em vez de SQLite.
- Projeção linear sem juros/inflação; horizonte padrão 24 meses (editável).
- Importação substitui (não mescla) dados.
- Tempo de carro via OSRM público (aprovado pelo usuário); transporte público via link externo + registro manual.
- Grupos de categoria (moradia/transporte/outros) para os comparadores.
- Situação fiscal casada aceita como entrada individual, sem somar renda do cônjuge.

## 12. Em aberto (resolver na etapa correspondente)

- Valores fiscais 2026 exatos (Etapa 2, fontes oficiais).
- Viabilidade da API CSO no navegador (Etapa 6).
- Conta GitHub para publicação (etapa de publicação).

## 13. Etapa 2 — decisões aprovadas (2026-11-19)

**Anos fiscais:** 2026 (oficial) e 2027 ("proposto — Finance (No.2) Bill 2026 ainda não promulgado"). A situação fiscal pode ser trocada no simulador para comparar.

**Arquivos de regras** `src/data/tax/<ano>.json`: cada parâmetro tem `value`, `status` (`oficial` | `proposto` | `nao_disponivel`) e `source` (URL). Atualizar = editar o JSON e republicar; o PWA se atualiza sozinho.

**Valores verificados (fontes lidas em 2026-11-19):**
- 2026 (Revenue tax-relief-charts, USC pages): faixa 20% solteiro €44.000; SPCC €48.000; casado uma renda €53.000; casado duas rendas €53.000 + menor de (renda do cônjuge de menor renda, €35.000). Créditos: pessoal €2.000 (casado €4.000), empregado €2.000, SPCC €1.900. USC 0,5% até €12.012; 2% até €28.700; 3% até €70.044; 8% acima; isento se renda ≤ €13.000. PRSI classe A: 4,2% até 30/09, 4,35% de 01/10; isento se semana ≤ €352; crédito semanal = €12 − (renda semanal − €352)/6 entre €352,01 e €424. Rent Tax Credit: 20% do aluguel (sem contas), máx €1.000 (casal conjunto €2.000), limitado ao Income Tax devido.
- 2027 (Citizens Information Budget 2027; gov.ie Your guide to Budget 2027): faixa solteiro €46.500; créditos pessoal/empregado €2.125; USC 2% até €30.300 (demais faixas sem mudança anunciada); Rent Tax Credit máx €1.150 (casal €2.300). PRSI 4,35% até 30/09/2027 e 4,5% de 01/10/2027 (calendário do PRSI Roadmap, Dept. of Finance). Valores **casados e SPCC 2027: não disponíveis** (fonte só diz "aumentos proporcionais"). Isenção USC €13.000, limite/crédito PRSI e crédito SPCC: "sem alteração anunciada" (status proposto).

**Cálculo:** Income Tax = max(0, imposto bruto − créditos), com Rent Tax Credit = min(20% × aluguel anual, teto, imposto restante). USC sobre a renda total se > isenção. PRSI semanal em 52 semanas, rateado por dias entre as alíquotas (273 dias a 4,2/4,35 e 92 dias à nova, em anos não bissextos). Mensal = anual/12; semanal = anual/52.

**Despesas, Dashboard:** conforme seção 7. Aluguel do simulador (Rent Tax Credit) vem da soma das despesas da categoria Aluguel, podendo ser sobrescrito no simulador.

## 14. Etapa 3 — Cenários: decisões aprovadas (2026-11-19)

- Cenário = nome + valores mensais de 6 grupos (aluguel, contas, alimentação, transporte, pessoais, outros) + substituições opcionais: salário bruto, situação fiscal (+ renda do cônjuge) e reserva inicial. Campo vazio = herda do simulador. Ano fiscal, USC reduzida e créditos extras sempre vêm do simulador.
- Rent Tax Credit do cenário usa o aluguel do próprio cenário.
- "Preencher com minhas despesas atuais": Aluguel→aluguel; Eletricidade, Gás, Internet, Celular→contas; Mercado, Restaurantes→alimentação; grupo transporte→transporte; Saúde, Lazer, Compras→pessoais; Outros→outros. Personalizadas: grupo moradia→contas, transporte→transporte, outros→outros.
- Resultado ao vivo: renda líquida, despesas, saldo, economia mensal/anual, projeção (saldo com sinal).
- Comparação lado a lado de 2 a 4 cenários: tabela + gráfico de projeção com uma linha por cenário (paleta categórica validada).

## 15. Etapa 4 — Mapa: decisões aprovadas (2026-11-19)

- Localidades iniciais (Nominatim/OpenStreetMap, consultado em 2026-11-19): Cork City 51.8985136, -8.4726423 (relation 11797890); Ballincollig 51.8882643, -8.5918414 (node 52231176, suburb); Cobh 51.8502284, -8.2950649 (relation 14579064); Midleton 51.9142741, -8.1700962 (relation 14571803); Bandon 51.7461712, -8.7369303 (relation 14584354); Glanmire 51.9192272, -8.3959789 (node 52252757, suburb). Fonte = URL do objeto no openstreetmap.org. Demais campos vazios ("Não disponível").
- Semeadas uma única vez (flag em settings); Cork City é referência de distância e não pode ser excluída.
- Mapa Leaflet + tiles OSM (atribuição obrigatória); sem cache offline de tiles (aviso quando offline). Adicionar localidade clicando no mapa.
- Linha reta: Haversine, rótulo "em linha reta". Carro: OSRM público (CORS ok), rótulo "estimativa sem trânsito — OSRM" + data; consulta ao criar/mover ou "recalcular". Transporte público: link Google Maps (travelmode=transit), registro manual "confirmado" com fonte.
- Filtros: favoritos, com aluguel, busca por nome (segurança na Etapa 6).
- hasUserData ignora localidades iniciais não alteradas.
- Incluída correção do Simulador: aluguel/crédito extra inválidos bloqueiam em vez de virar outro valor.

## 16. Localidades — lote 2 (aprovado em 2026-11-19)

Usuário pediu base maior; critério: até ~1 h de deslocamento até Cork City. Incluídas 25 (Nominatim/OSM, mesma regra: só nome + posição + fonte): Douglas, Bishopstown, Wilton, Togher, Blackrock, Mahon, Mayfield, Ballyvolane, Rochestown, Carrigaline, Passage West, Monkstown, Blarney, Tower, Little Island, Carrigtwohill, Ovens, Crosshaven, Kinsale, Mallow, Fermoy, Youghal, Macroom, Clonakilty, Mitchelstown. Tempo de carro até Cork City (OSRM, sem trânsito, 2026-11-19): 7–52 min; mais distantes Clonakilty 52, Youghal 45, Mitchelstown 43. Seeds versionados (`locationsSeedVersion`): aparelhos existentes recebem só o lote novo; localidades excluídas não voltam.

## 17. Etapa 5 — Comparador e Imóveis: decisões aprovadas (2026-11-19)

- **Moradores:** o aluguel digitado no imóvel já é a parte do usuário; "número de moradores" é só informação.
- **Localidade ganha `transportMonthly: Sourced<number>`** (custo mensal de transporte até Cork City, com fonte). Vazio → usa as despesas atuais do grupo transporte, rotulado "das suas despesas".
- **Regra única de composição do custo mensal** (localidade e imóvel): aluguel (do imóvel, ou faixa da localidade) + contas (do imóvel se informado / 0 se incluídas; senão despesas atuais do grupo moradia exceto Aluguel) + transporte (do imóvel/localidade se informado; senão despesas atuais do grupo transporte) + demais despesas atuais (grupo outros). Cada parcela mostra de onde veio. Saldo = líquido − custo; economia = máx(saldo, 0).
- **Comparador de localidades:** 2 a 4 localidades; faixa de aluguel gera faixa de custo e de economia; destaques por critério só entre as que têm dado (menor aluguel máx., menor tempo de carro, maior economia no pior caso); sem pontuação final. Segurança: "Etapa 6".
- **Imóveis:** cadastro manual (todos os campos do Módulo 8), favoritos, localidade vinculada (opcional), posição opcional (lat/lng decimais) → rota de carro OSRM até Cork City; comparação lado a lado 2 a 4 (cor segue o imóvel). Sem scraping.

## 18. Etapa 6 — Segurança: decisões aprovadas (2026-11-19)

- **Fonte:** CSO PxStat **CJA11** "Recorded crime incidents (New Garda Operating Model)" — por estação da Garda, tipo de ofensa (14) e ano (2003–2025), JSON-stat 2.0 em `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CJA11/JSON-stat/2.0/en` (CORS liberado, ~200 KB, sem dados pessoais). Notas oficiais: sujeito a revisão; fraude (09) não comparável antes/depois de Q3 2023.
- **Sem população por área de estação** (SNSA35 cobre só Blackrock/Mahon) → não há taxa por habitante; níveis entre estações não são comparáveis.
- **Classificação pela TENDÊNCIA** (escolha do usuário): último ano vs. média dos 3 anos anteriores, somando ofensas 03, 06, 07, 08, 12, 13 (padrão). Alta > 15% → Atenção elevada; 5–15% → Atenção moderada; ≤ 5% (estável/queda) → Baixa atenção; sem estação, < 4 anos com dado ou média 0 → Dados insuficientes. Limites, anos de base e tipos editáveis. Rótulo fixo: "avaliação do app sobre a tendência da estação — não é nível de segurança nem estatística oficial".
- **Estação ↔ localidade:** automática só quando o nome da estação é igual ao da localidade; demais (incl. Cork City) o usuário escolhe; origem registrada ("mesmo nome" / "escolhida por você").
- **Dados guardados no aparelho** após "Atualizar dados do CSO" (funciona offline depois), com data da consulta e data de atualização do CSO; apenas estações das divisões Cork City e Cork County.

## 19. Simplificação pós-uso (aprovada em 2026-11-19)

Retorno de uso: informações repetidas em várias abas e muitas telas fazendo contas próprias.

- **Fonte única das finanças:** Simulador (renda) → Despesas (todos os gastos, inclusive aluguel) → Dashboard (único lugar com saldo, economia e projeção).
- **Cenários removido** (menu, rota e telas). Dados antigos permanecem no banco/backup.
- **Simulador:** sem campo de aluguel; Rent Tax Credit usa sempre o aluguel de Despesas.
- **Imóveis:** lista de controle — título, link, localidade, tipo, aluguel, contas incluídas, observações, favorito. Sem custo/saldo/comparação. Botão "Usar este aluguel nas minhas despesas": 0 despesas de Aluguel → cria; 1 → atualiza para mensal com o valor; >1 → pede confirmação e substitui por uma.
- **Comparador de localidades:** só fatos (aluguel, distância, tempos, dependência de carro, segurança, notas).
- **Ficha da localidade:** sem "custo mensal de transporte".
- **Perfil local (sem login/senha):** nome e foto por aparelho, em Configurações; foto recortada em quadrado e reduzida (256 px, JPEG); aparece no menu e no Dashboard ("Olá, nome"); entra no backup.
- Campos que saíram das telas continuam guardados (nenhum dado apagado).

## 20. Imóveis — preenchimento a partir do anúncio (2026-11-20)

Sem scraping e sem servidor (o navegador não pode ler o site do portal; os portais vedam extração):
- **Link:** do endereço do Daft (`/for-rent/<tipo>-<endereço>/<id>` e `/share/...`) saem título, tipo e localidade conhecida (a que aparece mais ao fim do endereço). Outros portais: só a localidade, se aparecer no link.
- **Texto colado:** aluguel (semanal convertido ×52/12; faixa → menor valor; sem período → mensal, com aviso), contas incluídas e tipo.
- **Compartilhar (Android):** o app aparece no botão Compartilhar (Web Share Target, GET `?title&text&url`) e abre Imóveis já preenchido. iPhone não suporta: usar colar.
- Nunca sobrescreve o que o usuário já preencheu ou mexeu; mostra o que foi preenchido e os avisos.

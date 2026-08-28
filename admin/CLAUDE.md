# Ateliê do Laço — Sistema Admin

PWA single-file (HTML+CSS+JS tudo em `index.html`) pra controle de pedidos, produtos/estoque e financeiro de um ateliê de laços de cabelo artesanais. Sem build step, sem framework — é ES5/ES6 puro direto no browser.

## Stack

- Frontend: `index.html` único (~1600 linhas), Supabase JS SDK via CDN, html2pdf.js pra gerar PDF de resumo de pedido.
- Backend: Supabase (Postgres + Auth + RLS). Projeto: `pbpjawesltqtmhnqdvkv` (região us-west-2, org `dffysigorbbdrixjzpdm`).
- PWA: `sw.js` (service worker) + `manifest.json`.
- Deploy: hospedado em `ateliedolaco.com.br`, repositório GitHub público `wesleywcs1306-blip/atelie-do-laco`.

## ⚠️ ARMADILHA DE DEPLOY — leia antes de mexer

**O repositório GitHub tem DUAS cópias completas e independentes do sistema:**

- `index.html` + `sw.js` + `manifest.json` na **raiz** do repo → serve `https://ateliedolaco.com.br/`
- `admin/index.html` + `admin/sw.js` + `admin/manifest.json` na **subpasta** → serve `https://ateliedolaco.com.br/admin/`

As duas rodam contra o mesmo banco Supabase, mas são arquivos fisicamente separados. **Não existe sincronização automática entre elas.** Se você editar só uma, a outra fica pra trás — foi exatamente o que causou o bug de "atualizei o GitHub mas não mudou nada" em ago/2026 (a raiz ficou travada numa versão do `sw.js` v11 enquanto a subpasta já estava em v13, e a raiz não tinha a funcionalidade de pagamentos parciais que só tinha sido colada na subpasta).

**Toda vez que alterar `index.html`, `sw.js` ou `manifest.json`: atualize os DOIS lugares no GitHub (raiz e `/admin/`).** Não se sabe ainda com certeza qual URL está instalada como PWA no celular/computador da usuária (ela não tinha certeza em ago/2026) — então não dá pra simplesmente abandonar uma das duas cópias sem antes confirmar isso com ela e migrar o ícone instalado.

Esta pasta local (a que está montada aqui) corresponde só à subpasta `/admin/` do repo. Eu não tenho acesso direto de escrita ao GitHub (sem token/push configurado) — qualquer mudança feita aqui precisa ser colada manualmente no GitHub pela usuária (via GitHub web UI, "Add file → Upload files" na raiz e na pasta `admin/`).

**Atualização ago/2026**: a divergência entre as duas cópias aumentou bastante — a raiz (`Sistema/sistema-atelie/index.html`) tem ~495 linhas contra ~1600 desta cópia. Ainda não está confirmado se a raiz continua em uso. Antes de sincronizar ou aposentar uma das duas, confirme com a usuária.

Existe também um `reset.html` nesta pasta — página de "quebra-vidro" que desregistra o service worker, limpa cache e localStorage, e redireciona pro app. Útil se alguém ficar preso numa versão cacheada antiga do PWA que não atualiza sozinha.

## Banco de dados (Supabase)

Tabelas em `public`, todas com RLS habilitado, policy única `for all using (auth.role() = 'authenticated')` (só usuário logado lê/escreve, sem distinção de dono — sistema é single-tenant, uma admin só).

- **`orders`**: pedidos. Campos principais: `cliente`, `whatsapp`, `origem`, `status` (novo/producao/pronto/entregue/cancelado), `itens` (jsonb array de `{desc,qtd,precoUnit,custoUnit}`), `desconto`/`desconto_tipo` (percent|fixed), `pagamento` (forma), `pago` (pendente/parcial/pago — **calculado automaticamente a partir de `payments`, não editar manualmente em código novo**), `pago_em`, `entrega`, `obs`, `criado`.
- **`products`**: catálogo. `nome`, `categoria`, `preco`, `custo`, `estoque`, `estoque_min`, `obs`. **Não há baixa automática de estoque quando um produto é usado num pedido** — é uma lacuna conhecida, não implementada ainda (ver seção "Melhorias sugeridas").
- **`payments`** (criada ago/2026): histórico de pagamentos por pedido. `order_id` (FK → orders), `valor`, `data`, `obs`. Adicionada pra suportar pagamento parcial/parcelado — antes disso só existia o campo `pago` como enum sem valor associado.

### Lógica de pagamento parcial (implementada ago/2026)

- `orderPaidTotal(o)` = soma de `payments` daquele pedido.
- `orderSaldo(o)` = `orderTotal(o) - orderPaidTotal(o)`, nunca negativo.
- `syncOrderPaymentStatus(orderId)`: toda vez que um pagamento é adicionado/removido, recalcula `pago` automaticamente — `pendente` se nada pago, `parcial` se `0 < pago < total`, `pago` se `pago >= total` (com tolerância de R$0,01), carimbando `pago_em` com a data do último pagamento.
- O dropdown "Situação" no form ainda existe mas só é autoritativo quando não há nenhum pagamento lançado (serve pra casos manuais tipo "cancelado").
- Botão "💰 Pago" na lista de pedidos registra um pagamento do saldo total restante (não seta a flag direto) — mantém o histórico sempre consistente com o status.

### Regime de caixa no Dashboard/Financeiro

Receita do mês (Dashboard e aba "Por pagamento" do Financeiro) = soma dos **pagamentos recebidos naquele mês**, incluindo parciais — não o valor total do pedido. Custo/despesa reconhecido **proporcional** ao quanto daquele pedido foi pago no período (`prop = valor_pago / total_pedido`; custo_periodo = prop × (custo + despesas)). Isso é uma decisão de design: evita que receita e custo apareçam em meses diferentes de forma descolada.

"A receber" (Dashboard e lista de Pedidos) = soma do **saldo devedor real** (`orderSaldo`), não do valor cheio do pedido — pedidos parciais contam só o que falta.

### Backfill histórico

Em ago/2026, ao criar a tabela `payments`, os 153 pedidos que já estavam com `pago = 'pago'` receberam retroativamente um registro de pagamento de valor cheio, datado com `pago_em` (ou `criado` como fallback). Soma conferida: R$ 10.337,41. Não havia nenhum pedido `parcial` histórico na época, então não houve dado incerto a inferir.

### Bug corrigido em 27/ago/2026: "pago" sem pagamento registrado

O form de pedido (`submitOrder`) salvava o campo `pago` direto do dropdown "Situação" sem nunca checar contra o histórico de `payments`. Resultado: bastava a usuária escolher "Pago" ao criar/editar um pedido (sem passar por "Registrar pagamento") pra ele ficar com `pago='pago'` e **zero** pagamento na tabela `payments`. Isso é pior do que parece porque esse pedido some dos dois lados do Financeiro ao mesmo tempo: não conta como receita (que soma só `payments` reais) e não aparece em "A receber" (que exclui tudo que já é `pago='pago'`) — o dinheiro simplesmente desaparecia do dashboard.

Achado e corrigido: 17 pedidos criados entre 06/ago e 26/ago/2026, R$ 822,50 no total, todos com `pago_em` já carimbado mas sem registro em `payments`. Corrigido com um backfill pontual (INSERT de um pagamento de valor cheio por pedido, datado com o `pago_em` já existente — mesmo critério do backfill original acima).

**Fix de código**: `submitOrder` agora, sempre que o pedido é salvo com `pago==='pago'`, calcula `orderTotal(order) - orderPaidTotal(order)` e, se sobrar saldo positivo, chama `addPayment()` pra completar automaticamente — igual o botão "💰 Pago" da lista já fazia. Isso garante o invariante "pago='pago' ⇒ soma(payments) >= total" sempre, não importa se o pagamento chegou por "Registrar pagamento", pelo botão rápido, ou pelo dropdown do form.

### Teto MEI e R$/hora estimado (implementado ago/2026, pendente deploy)

Aba Financeiro ganhou dois cards novos, calculados a partir do ano exibido no month-picker (`selYear`):

- **Teto MEI**: soma os `payments` recebidos (regime de caixa, mesma lógica do resto do Financeiro) no ano selecionado e compara contra `MEI_CEILING` (constante = R$81.000, valor de 2026 — **revisar todo ano** se a Receita Federal reajustar o teto). Mostra barra de progresso, restante até o teto e, quando `selYear` é o ano corrente, uma projeção simples (`recebido / meses decorridos × 12`).
- **R$/hora estimado**: `avgMargin` = média de (`preco - custo`) de todos os produtos cadastrados com preço > 0, dividido pelo tempo médio de produção por peça. O tempo é um campo editável (`#tempoProducaoMin`, default 20 min) persistido em `localStorage` (`atelie_tempoProducaoMin`) — não vem do banco, é só uma estimativa manual da usuária, não por produto.

Funções: `renderMeiPanel()` e `renderHourlyRate()`, chamadas no fim de `renderFinanceiro()`.

**Pendente**: só existe nesta cópia local (`admin/index.html`). Ainda não testado no navegador nem colado no GitHub — ver ARMADILHA DE DEPLOY acima antes de publicar.

## Segurança (checado ago/2026)

- RLS ativo e correto em `orders`/`products`/`payments` (authenticated-only).
- Nenhuma chave `service_role` ou segredo vazado no histórico do repo (git log completo verificado).
- Único achado do advisor de segurança do Supabase: "Leaked Password Protection" desabilitado (não crítico, ativável em Authentication → Providers no painel).
- Repositório GitHub é **público** — decisão consciente pendente: código do sistema (lógica de precificação, margem, fluxo) fica visível pra qualquer um. Considerar tornar privado se isso incomodar.

## Melhorias sugeridas (não implementadas, discutidas em ago/2026)

Por ordem de prioridade sugerida:
1. Baixa automática de estoque ao usar produto do catálogo num pedido (maior lacuna atual — o alerta de "estoque baixo" no dashboard não é confiável sem isso).
2. Separar matéria-prima (fita, elástico etc.) de produto acabado — ficha técnica/BOM por produto. Esforço alto, só vale se sentir a dor na prática — também deixaria o R$/hora estimado (ver acima) preciso por produto em vez de uma média genérica.
3. Custos fixos mensais do negócio (embalagem, taxas, internet) — hoje o "lucro" é só por pedido, ignora overhead do negócio.
4. Exportar relatório em CSV/Excel pra contador (hoje só existe backup em JSON bruto).

Painel de teto MEI e R$/hora estimado: já implementados, ver "Teto MEI e R$/hora estimado" acima.

Descartado por ora: multiusuário/permissões (só uma admin), catálogo com foto de produto, calendário de produção separado (o "próximas entregas" do dashboard já cobre o volume atual).

## Créditos de dados (pra referência rápida)

Em ago/2026: 289 produtos cadastrados, 154 pedidos (153 pago + 7 pendente na época), R$ 10.337,41 em pagamentos históricos registrados.

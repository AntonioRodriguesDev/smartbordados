# Controle Financeiro de Custos + Redesign do Dashboard

## 1. Banco de dados — nova estrutura de custos

Criar duas tabelas no backend (com RLS por `user_id`):

**`cost_categories`** — categorias livres de custo
- `nome` (ex.: Salários, Energia, Aluguel, Máquinas, Marketing)
- `tipo_padrao` (fixo / variavel)
- `cor` opcional para gráficos

**`costs`** — lançamentos de custo
- `category_id` → cost_categories
- `descricao` (ex.: "Aluguel galpão", "Parcela máquina Brother 6")
- `tipo`: `fixo` (recorrente todo mês), `parcelado` (N parcelas), `unico` (lançamento avulso)
- `valor` (valor da parcela ou do mês)
- `data_inicio` (mês de início / data do lançamento único)
- `parcelas_total` e `parcelas_pagas` (para tipo parcelado)
- `dia_vencimento` (1–31, para fixos/parcelados)
- `ativo` (bool — permite "desativar" um custo fixo sem apagar histórico)
- `pago` (bool, usado para `unico`)

**Salários integrados automaticamente**: a página de Custos vai somar `employees.salario` (ativos) como categoria "Folha de Pagamento" sem precisar lançar manualmente — o usuário só lança custos que NÃO são de funcionários.

## 2. Nova tela: **Custos** (`/custos`)

Acessível pelo menu lateral. Layout no mesmo padrão visual do sistema.

**Topo — 4 KPIs do mês:**
- Custos Fixos
- Parcelas do mês
- Custos Únicos do mês
- **Total do Mês** (soma + folha de pagamento)

**Corpo:**
- Aba **Lançamentos**: tabela com filtro por tipo/categoria/status, com botão "Novo custo" (modal: tipo, categoria, descrição, valor, data, parcelas, dia vencimento)
- Aba **Categorias**: gerenciar categorias (CRUD simples)
- Aba **Folha**: leitura — lista funcionários ativos e total da folha (link para /funcionarios)
- Gráfico de barras: custos por categoria no mês corrente
- Lista lateral: próximos vencimentos (7 dias) com botão "marcar pago"

**Ações rápidas em cada lançamento:**
- Marcar parcela como paga (incrementa `parcelas_pagas`)
- Editar / desativar / excluir

## 3. Dashboard redesenhado (igual à imagem)

Manter cards atuais **Meta do Dia**, **Acumulado do Mês**, **Recebimentos**, **Em Atraso** na primeira linha (4 cards).

Segunda linha:
- **Faturamento Diário** (gráfico — mantém)
- **Lucro Estimado** (novo card lateral, igual à imagem):
  - Faturamento do mês
  - Custos Totais do mês (folha + fixos + parcelas + únicos pagos)
  - Margem % (ring gauge)
  - Lucro Estimado
  - Ponto de Equilíbrio (custos totais — quanto precisa faturar para zerar)

Terceira linha:
- **Próximos Recebimentos** (mantém)
- **Custos do Mês** (novo — resumo: Funcionários, Custos Fixos, Outros Custos, Total) com link "Ver detalhes" → /custos
- **Top Clientes** (mantém)

## 4. Aniversários como notificação

Remover o card "Aniversários" do Dashboard. Criar componente `BirthdayBanner` no `AppShell` (topo da área de conteúdo, dispensável) que:
- Aparece apenas se houver aniversariante nos próximos **14 dias** (inclusive hoje)
- Mostra avatar, nome, cargo, "Hoje 🎂 / Amanhã / em Xd"
- Botão "X" fecha por 24h (localStorage com data)
- Visual sutil (faixa dourada com ícone de bolo), responsivo

## 5. Detalhes técnicos

- Migration única criando `cost_categories` + `costs` com RLS `auth.uid() = user_id` em ambas
- Lógica do mês corrente para custos:
  - **fixo**: conta se `ativo` e `data_inicio <= fim do mês`
  - **parcelado**: conta se `parcelas_pagas < parcelas_total` e o mês corrente está dentro do período
  - **unico**: conta se `data_inicio` está no mês
- `lucroEstimado = faturadoMes - custosTotaisMes`
- `pontoEquilibrio = custosTotaisMes` (mostrado como meta mínima)
- Adicionar rota `/custos` em `Index.tsx` e item de menu em `AppShell.tsx`
- Reaproveitar componentes existentes (`Card`, `Badge`, `Dialog`, `Tabs`, `RingProgress`)

## Arquivos a criar/editar

- **Criar**: `src/pages/Custos.tsx`, `src/components/BirthdayBanner.tsx`, `src/lib/costs.ts` (helpers de cálculo)
- **Editar**: `src/pages/Dashboard.tsx`, `src/components/AppShell.tsx`, `src/pages/Index.tsx`
- **Migration**: `cost_categories` + `costs` + RLS

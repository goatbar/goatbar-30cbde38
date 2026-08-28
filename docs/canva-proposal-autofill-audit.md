# Auditoria do autofill da Proposta Comercial no Canva

## Causas-raiz

1. Datas dependiam do `formatter` salvo no mapping. Com `raw`, uma data brasileira ou ISO
   chegava ao Canva sem a apresentação canônica. Os três Data Fields de data agora aplicam
   `DD.MM.YYYY` por semântica, inclusive quando a data faz parte de um texto de pagamento.
2. `QUANTIDADE_DRINKS` tinha aliases históricos apontando tanto para consumo total quanto
   para variedades. A fonte oficial é `computed.total_drink_varieties`: a contagem distinta da
   coleção versionada `event_budget_versions.selected_drinks`, depois de hidratar seus IDs com
   `drinks.nome`. Não há cálculo por IA nem valor inventado.
3. O `0` isolado vinha de `QUANTIDADE_HORAS_EVENTO`, mapeado para
   `events.duration_hours`. O valor default `0` (duração não preenchida) era serializado como
   texto e o elemento desse Data Field fica visualmente abaixo de `QUANTIDADE_PESSOAS` no
   Brand Template. Zero ou duração negativa agora significam ausência; durações positivas
   continuam sendo enviadas. O campo de convidados não era a origem do zero.

## Inventário dos 15 Data Fields oficiais

| Data Field Canva          | Fonte canônica                                | Valor do cenário de regressão / regra    |
| ------------------------- | --------------------------------------------- | ---------------------------------------- |
| `NOME_EVENTO`             | `events.event_name`                           | texto do evento                          |
| `DATA_ORCAMENTO`          | `event_budget_versions.created_at`            | `18.08.2026`                             |
| `DATA_EVENTO`             | `events.date`                                 | `20.10.2026`                             |
| `INO`                     | primeira letra de `events.groom_name`         | `P`                                      |
| `INA`                     | primeira letra de `events.bride_name`         | `R`                                      |
| `QUANTIDADE_PESSOAS`      | `events.guests`                               | `150` (somente número)                   |
| `DRINKS`                  | `selected_drinks` hidratado por `drinks.nome` | lista com bullets                        |
| `BEBIDAS`                 | `event_budget_versions.beverages`             | lista com bullets                        |
| `QTD_BARTENDERS`          | `bartender_quantity`                          | quantidade + função; vazio quando zero   |
| `QTD_COPEIRAS`            | `copeira_quantity`                            | quantidade + função; vazio quando zero   |
| `QTD_BAR_KEEPERS`         | `keeper_quantity`                             | quantidade + função; vazio quando zero   |
| `QUANTIDADE_DRINKS`       | `computed.total_drink_varieties`              | quantidade de nomes/IDs distintos        |
| `VALOR_INVESTIMENTO`      | `final_budget_value`                          | moeda BRL                                |
| `DATA_FINAL_PAGAMENTO`    | `events.date` menos 7 dias                    | `13.10.2026`                             |
| `QUANTIDADE_HORAS_EVENTO` | `events.duration_hours`                       | inteiro positivo; vazio para default `0` |

O payload efetivo varia por evento e pelos mappings persistidos. Antes de chamar `/autofills`,
a função registra `[canva-generate-proposal][payload-audit]` com cada chave enviada, fonte,
valor final e status `filled`/`empty`. A validação anterior também compara todas as chaves
mapeadas com o dataset real do Brand Template e rejeita chaves inexistentes, em vez de gerar
silenciosamente placeholders incorretos.

Campos opcionais sem dados são enviados como string vazia, nunca como `null`, `undefined`,
`NaN` ou objeto serializado. Campos obrigatórios vazios interrompem a geração com
`required_field_empty`.

## Área segura da página “Drinks & Experiências”

`DRINKS` e `BEBIDAS` são enviados como texto, com uma linha por item. A API de Autofill do
Canva não permite informar posição, altura, coordenadas, overflow ou redimensionamento da
caixa de um Data Field: essas propriedades pertencem ao Brand Template. A exportação e o
preview recebem o design depois dessa composição e, portanto, não originam a colisão.

No template atual, a caixa dinâmica `BEBIDAS` pode continuar verticalmente até a logo
`GOATBAR` do rodapé. A correção visual definitiva no Canva é limitar a caixa de `BEBIDAS`
acima da reserva da logo (e manter a mesma reserva na caixa `DRINKS`). Enquanto o template
não oferece paginação dinâmica, a geração valida o texto antes do Autofill: até 8 linhas
visuais em `DRINKS` e 5 em `BEBIDAS`, incluindo quebras estimadas para nomes longos. Poucos
itens mantêm exatamente a tipografia e o layout atuais; excedentes geram
`canva_menu_overflow` e não produzem um PDF potencialmente sobreposto. A arquitetura atual
não suporta criar automaticamente uma página adicional no Brand Template durante Autofill.

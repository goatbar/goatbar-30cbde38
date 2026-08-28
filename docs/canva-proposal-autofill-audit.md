# Auditoria do autofill da Proposta Comercial no Canva

## Auditoria de cota, token e identidade

O Autofill é criado por `POST https://api.canva.com/rest/v1/autofills`; a consulta do job usa
`GET /rest/v1/autofills/{job_id}`. A resposta de regressão que motivou este tratamento,
já sem credenciais, é:

```json
{
  "code": "limit_exceeded",
  "message": "Free autofill quota has been exceeded. Present the `upsell_url` to the user and prompt them to upgrade their Canva account to continue using the autofill feature.",
  "upsell_url": "https://www.canva.com/upgrade?feature=autofill&source=api_quota"
}
```

Ela chegou com HTTP `429`. O código antigo tratava **qualquer** HTTP 429 como
`canva_autofill_quota_exceeded`, e o modal acrescentava por conta própria que a conta havia
atingido o “limite gratuito”. Essa conclusão não é segura: 429 também pode ser rate limiting,
e uma mensagem de cota não comprova o plano comercial efetivo da conta.

Agora somente código/mensagem que mencione explicitamente a cota/limite de **Autofill** é
classificado como `canva_autofill_quota_exceeded`. Um 429 genérico é
`canva_rate_limited`. Todo erro registra endpoint/etapa, método, HTTP status, código e mensagem
do Canva, request/correlation/trace id, `retry-after`, campos de quota/entitlement/team/workspace
presentes e o body recursivamente sanitizado. Tokens, authorization, refresh tokens e secrets
nunca são registrados ou devolvidos.

O token usado na geração vem da linha mais recente de `canva_integrations` do usuário Goat Bar,
com refresh atômico quando necessário. A auditoria compara o token efetivamente usado com essa
linha (sem registrar o token), detecta linhas duplicadas e consulta
`GET https://api.canva.com/rest/v1/users/me/profile`. O `id` devolvido é comparado e, se estiver
ausente/desatualizado, persistido em `canva_user_id`. Isso corrige integrações antigas nas quais
o perfil não havia sido salvo; falhas do endpoint de perfil antes eram engolidas pela geração e
resultavam em “Não informado”.

O endpoint de perfil confirma o usuário dono do token, mas não informa plano, equipe nem a
entidade à qual a cota de Autofill está vinculada. Portanto, a aplicação não afirma que o token
pertence a uma equipe Pro+ nem deduz se a cota é de usuário, equipe, OAuth `client_id` ou Brand
Template. Se o Canva devolver `team`, `workspace`, `account`, `plan`, `entitlement` ou `quota`,
esses campos são preservados no diagnóstico seguro e destacados no log. Na ausência desses
campos, confirmar a titularidade Pro+/equipe exige inspeção operacional no Canva; não pode ser
deduzida da resposta 429.

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

# Auditoria: eventos confirmados da GIA

## Fonte de verdade do Pipeline

`eventos.index.tsx` chama `eventBudgetService.listEvents()`. O serviço consulta
diretamente `public.events` com `select('*')`, ordenado por `date ASC`, e enriquece
somente os dados financeiros com a versão de orçamento onde `is_current = true`.
Esse join em memória não altera status nem a inclusão do evento.

O filtro **Confirmados** é aplicado no frontend sobre `events.status`: o valor é
convertido para maiúsculas e comparado por igualdade a `CONFIRMADO`. Logo, o valor
canônico persistido é `confirmado` (a comparação da tela apenas tolera caixa). Não
há filtro de data, usuário, proposta, contrato, unidade ou orçamento; não há
paginação; e não existem colunas de tenant, arquivamento ou soft delete no schema
de `events`. Registros cancelados/recusados/finalizados não passam pela igualdade.
Exclusão real é física (`delete`), e a FK dos orçamentos usa `ON DELETE CASCADE`.

As policies existentes dão acesso integral a `events`; portanto, o cliente
autenticado da tela e o service-role da GIA observam o mesmo conjunto. A tela não
usa view ou RPC para essa listagem.

Query equivalente à regra efetiva:

```sql
select *
from public.events
where upper(status) = 'CONFIRMADO'
order by date asc;
```

## Causa raiz na GIA

`search_events` usava a tabela correta (`events`), porém não reproduzia o contrato
da tela:

1. status era filtrado com `ILIKE '%confirmado%'`, em vez de igualdade canônica;
2. a ferramenta pré-limitava a consulta a 40 e aplicava um limite implícito de 15;
3. aceitava do Gemini qualquer `limit` (inclusive 3) e reportava o tamanho da fatia
   como se fosse a contagem do sistema;
4. ordenava por data descendente, ao contrário do Pipeline;
5. a intenção e os argumentos ficavam a cargo do modelo após receber até dez
   mensagens anteriores e todos os eventos recentes. Assim, uma intenção anterior
   ("próximo evento") podia reaparecer no texto/resposta ou em outra tool call.

Os três registros diferentes não vieram de cache, tabela/view antiga, relação de
contrato/proposta ou campo de cliente: eram consequência de argumentos e
paginação escolhidos pelo modelo, combinados à semântica divergente da ferramenta.

## Correção

Pedidos explícitos de eventos confirmados agora são reconhecidos somente a partir
da mensagem atual, antes da chamada ao provedor. O agente executa exatamente uma
`search_events` com status canônico e só envia `limit` quando o usuário o declarou.
Histórico, `pendingAction`, resultados anteriores e `recentEntities` não participam
da detecção; entidades recentes continuam sendo gravadas apenas para referências
posteriores ("o segundo", "esse evento" etc.).

A ferramenta usa igualdade case-insensitive com `confirmado`, `date ASC`, sem
pré-limite e sem limite silencioso nas listagens por status. A apresentação mantém
`client_name` como cliente/contratante e `event_name` como nome do evento; noivos
(`bride_name`/`groom_name`) são apenas fallback do título, enquanto local e data
vêm de `event_location`/`city` e `date`.

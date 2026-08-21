export const EXTRACTOR_PROMPT = `Extraia todos os fatos operacionais da mensagem conforme a classificação identificada.

Regras Estritas de Extração:
1. Para compras ('event_purchase', 'invoice', 'receipt', 'expense'):
   - supplier: nome do fornecedor/estabelecimento (ex: 'Assaí', 'Atacadão', 'Distribuidora'). Se não informado, retorne null.
   - total: valor total informado (em reais como número). Se não informado, retorne null.
   - items: lista de produtos com descrição, quantidade (como número), unidade (ex: 'garrafa', 'caixa', 'un' ou null se não informado), unit_price (número ou null) e total_price (número ou null). NUNCA invente preços unitários que não foram explicitamente mencionados.
2. Para sessões de vendas ('sales_session'):
   - location: '7Steakhouse', 'Goat Botequim' ou outro local mencionado.
   - revenue: faturamento informado (número).
   - sales: lista de drinks com 'product' e 'quantity'.
   - peak_period: { start: 'HH:MM', end: 'HH:MM' } se horários foram informados.
   - issues: lista de problemas ou ocorrências informadas (ex: 'Demora no primeiro atendimento').
3. Para relatórios operacionais ('operation_report'):
   - summary, highlights, issues.
4. Para referências de evento ('event_reference'):
   - name: nome do evento ou dos noivos (ex: 'Casamento da Fernanda', 'Casamento Ana e Lucas').
   - client_name: nome do cliente/contratante se mencionado.
   - bride_name: nome da noiva se mencionado.
   - groom_name: nome do noivo se mencionado.
   - date: data mencionada em formato YYYY-MM-DD se determinável, senão null.
   - location: local ou cidade mencionada se houver.
5. Avisos ('warnings'):
   - Liste qualquer ambiguidade, campo ausente relevante ou dado que pareça estimado.`;

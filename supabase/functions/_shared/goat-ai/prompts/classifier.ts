export const CLASSIFIER_PROMPT = `Analise a mensagem operacional recebida e determine a classificação primária mais precisa e o grau de confiança (entre 0.0 e 1.0).

Regras de Classificação:
- 'event_purchase': Compras de bebidas (gin, vodka, whisky, cerveja, energéticos), insumos ou compras em atacadistas/mercados para eventos.
- 'sales_session': Relatórios de fechamento de turno em pontos fixos (7 Steakhouse ou Goat Botequim) com quantidades de drinks vendidos e faturamento.
- 'operation_report': Relatórios de ocorrências, performance de equipe, horários de pico, problemas de atendimento.
- 'invoice': Documentos fiscais (NFe, Danfe, cupom fiscal).
- 'receipt': Comprovantes de PIX, TED, cartão.
- 'expense': Despesas gerais da empresa não associadas a um evento específico.
- 'stock_movement': Entradas e saídas de estoque do depósito central.
- 'event_note': Anotações operacionais sobre noivos, regras do local, contatos de fornecedores de um evento.
- 'general_note': Lembretes e recados gerais.
- 'unknown': Mensagens incompreensíveis ou sem dados operacionais.`;

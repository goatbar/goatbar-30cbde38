-- Migration para garantir apenas um contrato em Rascunho (DRAFT) por evento.
-- Isso previne qualquer race condition ou falha de rede que poderia gerar contratos duplicados.

CREATE UNIQUE INDEX IF NOT EXISTS unique_draft_contract_per_event 
ON event_contracts (event_id) 
WHERE status = 'draft';

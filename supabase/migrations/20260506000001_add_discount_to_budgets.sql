-- Migration: Adicionar suporte a descontos nos orçamentos
ALTER TABLE event_budget_versions 
ADD COLUMN discount_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN discount_description TEXT;

-- Atualizar o histórico para registrar descontos também se necessário
ALTER TABLE event_budget_history
ADD COLUMN discount_applied DECIMAL(12,2) DEFAULT 0;

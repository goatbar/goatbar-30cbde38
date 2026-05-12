-- Migration: Adicionar suporte a descontos nos orçamentos

ALTER TABLE event_budget_versions
ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0;

ALTER TABLE event_budget_versions
ADD COLUMN IF NOT EXISTS discount_description TEXT;

ALTER TABLE event_budget_history
ADD COLUMN IF NOT EXISTS discount_applied DECIMAL(12,2) DEFAULT 0;
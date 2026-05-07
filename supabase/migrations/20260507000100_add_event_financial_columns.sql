
-- Adiciona colunas financeiras na tabela de eventos para melhor integração com o dashboard
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_percent_received NUMERIC DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_budget_value NUMERIC DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_profit_value NUMERIC DEFAULT 0;

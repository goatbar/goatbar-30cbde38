-- Adiciona a coluna event_name na tabela events
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name text;

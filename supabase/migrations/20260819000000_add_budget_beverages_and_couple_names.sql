-- Explicit couple roles prevent gender inference; beverages belong to an immutable budget version.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS groom_name text,
  ADD COLUMN IF NOT EXISTS bride_name text;

ALTER TABLE public.event_budget_versions
  ADD COLUMN IF NOT EXISTS beverages jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.groom_name IS 'Nome do noivo informado explicitamente; nunca inferido a partir de client_name.';
COMMENT ON COLUMN public.events.bride_name IS 'Nome da noiva informado explicitamente; nunca inferido a partir de client_name.';
COMMENT ON COLUMN public.event_budget_versions.beverages IS 'Lista de bebidas congelada nesta versão do orçamento, separada dos coquetéis em selected_drinks.';

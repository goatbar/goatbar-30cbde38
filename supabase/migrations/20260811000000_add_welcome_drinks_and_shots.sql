ALTER TABLE public.event_budget_versions
  ADD COLUMN IF NOT EXISTS has_welcome_drinks boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_drinks_per_person integer NOT NULL DEFAULT 0 CHECK (welcome_drinks_per_person >= 0),
  ADD COLUMN IF NOT EXISTS welcome_drinks_profit_percentage numeric NOT NULL DEFAULT 0 CHECK (welcome_drinks_profit_percentage >= 0),
  ADD COLUMN IF NOT EXISTS welcome_drinks_selected jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS welcome_drinks_cost numeric NOT NULL DEFAULT 0 CHECK (welcome_drinks_cost >= 0),
  ADD COLUMN IF NOT EXISTS welcome_drinks_final_value numeric NOT NULL DEFAULT 0 CHECK (welcome_drinks_final_value >= 0),
  ADD COLUMN IF NOT EXISTS has_shots boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shots_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shots_total_value numeric NOT NULL DEFAULT 0 CHECK (shots_total_value >= 0);

COMMENT ON COLUMN public.event_budget_versions.welcome_drinks_selected IS 'Immutable name and unit-cost snapshots used by this budget version.';
COMMENT ON COLUMN public.event_budget_versions.shots_items IS 'Immutable shot name, quantity and unit-value snapshots used by this budget version.';

-- ------------------------------------------------------------
-- Migration: Drink Aliases and Alias History for GIA
-- ------------------------------------------------------------

-- 1. Create drink_aliases table
CREATE TABLE IF NOT EXISTS public.drink_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  drink_id text NOT NULL REFERENCES public.drinks(id) ON DELETE CASCADE,
  business_unit text, -- 'goat_botequim', 'steakhouse', 'eventos', or NULL for global
  source text NOT NULL DEFAULT 'manual_chat',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

-- Partial Unique Indexes for proper handling of NULL vs non-NULL business_unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_drink_aliases_unique_unit 
  ON public.drink_aliases (normalized_alias, business_unit) 
  WHERE business_unit IS NOT NULL AND active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drink_aliases_unique_global 
  ON public.drink_aliases (normalized_alias) 
  WHERE business_unit IS NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_drink_aliases_lookup 
  ON public.drink_aliases (normalized_alias, business_unit) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_drink_aliases_drink_id 
  ON public.drink_aliases (drink_id);

-- 2. Audit History table for drink aliases
CREATE TABLE IF NOT EXISTS public.drink_alias_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_id uuid,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  old_drink_id text,
  new_drink_id text NOT NULL,
  business_unit text,
  action text NOT NULL, -- 'CREATED', 'UPDATED', 'DEACTIVATED', 'CONFLICT_REJECTED'
  source text NOT NULL DEFAULT 'manual_chat',
  changed_by uuid,
  performer_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drink_alias_history_normalized_alias 
  ON public.drink_alias_history (normalized_alias);

-- 3. Enable RLS
ALTER TABLE public.drink_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_alias_history ENABLE ROW LEVEL SECURITY;

-- Policies for drink_aliases
DROP POLICY IF EXISTS "auth_select_drink_aliases" ON public.drink_aliases;
CREATE POLICY "auth_select_drink_aliases" ON public.drink_aliases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_manage_drink_aliases" ON public.drink_aliases;
CREATE POLICY "auth_manage_drink_aliases" ON public.drink_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for drink_alias_history
DROP POLICY IF EXISTS "auth_select_drink_alias_history" ON public.drink_alias_history;
CREATE POLICY "auth_select_drink_alias_history" ON public.drink_alias_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_drink_alias_history" ON public.drink_alias_history;
CREATE POLICY "auth_insert_drink_alias_history" ON public.drink_alias_history FOR INSERT TO authenticated WITH CHECK (true);

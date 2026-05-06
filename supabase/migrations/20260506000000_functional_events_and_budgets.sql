-- Migration: Functional Events and Budgets
-- Adds support for full budget management, versioning and history.

-- 1. Reset and Create events table
-- Se você quiser manter os dados, remova o DROP TABLE e use apenas os ALTER TABLE abaixo
DROP TABLE IF EXISTS public.event_negotiation_history CASCADE;
DROP TABLE IF EXISTS public.event_budget_history CASCADE;
DROP TABLE IF EXISTS public.event_budget_versions CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

CREATE TABLE public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name text NOT NULL,
    date date NOT NULL,
    event_type text NOT NULL,
    guests integer NOT NULL DEFAULT 100,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_location text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS drinks text[];
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text DEFAULT 'novo_orcamento';

-- 2. Create budget versions table
CREATE TABLE IF NOT EXISTS public.event_budget_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    is_current boolean DEFAULT false,
    status text DEFAULT 'draft',
    
    -- Budget Details
    selected_drinks jsonb DEFAULT '[]'::jsonb,
    drinks_per_person integer DEFAULT 0,
    drinks_markup_percentage numeric DEFAULT 0,
    drinks_cost_sum numeric DEFAULT 0,
    average_drink_cost numeric DEFAULT 0,
    drinks_base_cost numeric DEFAULT 0,
    drinks_final_value numeric DEFAULT 0,
    
    -- Staff
    bartender_quantity integer DEFAULT 0,
    bartender_unit_value numeric DEFAULT 200,
    keeper_quantity integer DEFAULT 0,
    keeper_unit_value numeric DEFAULT 200,
    copeira_quantity integer DEFAULT 0,
    copeira_unit_value numeric DEFAULT 200,
    team_total_value numeric DEFAULT 0,
    
    -- Ice
    ice_packages_quantity integer DEFAULT 0,
    ice_package_unit_value numeric DEFAULT 6,
    ice_total_value numeric DEFAULT 0,
    
    -- Travel
    has_travel boolean DEFAULT false,
    fuel_value numeric DEFAULT 0,
    
    -- Misc
    miscellaneous_items jsonb DEFAULT '[]'::jsonb,
    miscellaneous_total_value numeric DEFAULT 0,
    
    -- Profit & Final
    discount_value numeric DEFAULT 0,
    discount_description text,
    profit_value numeric DEFAULT 0,
    final_budget_value numeric DEFAULT 0,
    average_value_per_person numeric DEFAULT 0,
    
    -- Payment
    payment_method text,
    paid_percentage numeric DEFAULT 0,
    paid_value numeric DEFAULT 0,
    pending_percentage numeric DEFAULT 100,
    pending_value numeric DEFAULT 0,
    pending_payment_date date,
    
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create budget history table
CREATE TABLE IF NOT EXISTS public.event_budget_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    budget_version_id uuid REFERENCES public.event_budget_versions(id) ON DELETE SET NULL,
    action text NOT NULL,
    changed_fields jsonb,
    previous_data jsonb,
    new_data jsonb,
    previous_final_value numeric,
    new_final_value numeric,
    discount_applied numeric DEFAULT 0,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 4. Create negotiation history table
CREATE TABLE IF NOT EXISTS public.event_negotiation_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    status text NOT NULL,
    note text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS and Policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_budget_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_negotiation_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "authenticated full access events" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "authenticated full access budget_versions" ON public.event_budget_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "authenticated full access budget_history" ON public.event_budget_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "authenticated full access negotiation_history" ON public.event_negotiation_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

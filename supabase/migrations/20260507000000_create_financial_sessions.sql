-- Migration: Create Financial Sessions and Items
-- Support for Botequim and Steakhouse operational sales.

CREATE TABLE IF NOT EXISTS public.financial_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL DEFAULT CURRENT_DATE,
    modality text NOT NULL CHECK (modality IN ('Goat Botequim', '7Steakhouse')),
    labor_value numeric DEFAULT 0,
    labor_quantity integer DEFAULT 0,
    labor_names text,
    labor_details jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_session_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.financial_sessions(id) ON DELETE CASCADE,
    drink_id uuid, -- Reference if drinks table exists, otherwise just metadata
    drink_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL DEFAULT 0,
    unit_cost numeric NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_session_items ENABLE ROW LEVEL SECURITY;

-- Permissive policies for initial phase
DROP POLICY IF EXISTS "public full access financial_sessions" ON public.financial_sessions;
CREATE POLICY "public full access financial_sessions" ON public.financial_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public full access financial_session_items" ON public.financial_session_items;
CREATE POLICY "public full access financial_session_items" ON public.financial_session_items FOR ALL USING (true) WITH CHECK (true);

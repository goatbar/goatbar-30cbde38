-- ============================================================
-- Migration: Event Planning & OCR Items
-- Adds tables and relations for receipt items, event planning,
-- and event closing functionalities.
-- ============================================================

-- 1. Link financial_expenses to events
ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

-- 2. financial_expense_items: extracted from OCR receipts
CREATE TABLE IF NOT EXISTS public.financial_expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.financial_expenses(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(15,2),
  total_price numeric(15,2),
  suggested_category text,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on financial_expense_items"
ON public.financial_expense_items FOR ALL USING (true) WITH CHECK (true);

-- 3. event_planning_items: Insumos Levados
CREATE TABLE IF NOT EXISTS public.event_planning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  source_expense_item_id uuid REFERENCES public.financial_expense_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  planned_quantity numeric(10,3) NOT NULL DEFAULT 1,
  unit text,
  estimated_unit_cost numeric(15,2) DEFAULT 0,
  estimated_total_cost numeric(15,2) DEFAULT 0,
  origin text, -- 'Comprado para evento', 'Estoque', 'Sobra', 'Outro'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_planning_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on event_planning_items"
ON public.event_planning_items FOR ALL USING (true) WITH CHECK (true);

-- 4. event_closings: Fechamento principal do evento
CREATE TABLE IF NOT EXISTS public.event_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  closing_date timestamptz,
  revenue_amount numeric(15,2) DEFAULT 0,
  total_purchase_cost numeric(15,2) DEFAULT 0,
  total_team_cost numeric(15,2) DEFAULT 0,
  total_logistics_cost numeric(15,2) DEFAULT 0,
  total_consumed_cost numeric(15,2) DEFAULT 0,
  total_lost_cost numeric(15,2) DEFAULT 0,
  total_event_cost numeric(15,2) DEFAULT 0,
  event_profit numeric(15,2) DEFAULT 0,
  event_margin numeric(5,2) DEFAULT 0,
  general_notes text,
  improvement_points text,
  status text NOT NULL DEFAULT 'Planejado', -- Planejado, Em preparação, Realizado, Fechado, Cancelado
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on event_closings"
ON public.event_closings FOR ALL USING (true) WITH CHECK (true);

-- 5. event_closing_items: Uso real dos insumos levados
CREATE TABLE IF NOT EXISTS public.event_closing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  planning_item_id uuid REFERENCES public.event_planning_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  quantity_taken numeric(10,3) NOT NULL DEFAULT 0,
  quantity_used numeric(10,3) NOT NULL DEFAULT 0,
  quantity_returned numeric(10,3) NOT NULL DEFAULT 0,
  quantity_lost_or_broken numeric(10,3) NOT NULL DEFAULT 0,
  unit text,
  unit_cost numeric(15,2) DEFAULT 0,
  consumed_cost numeric(15,2) DEFAULT 0,
  lost_cost numeric(15,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_closing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for authenticated users on event_closing_items"
ON public.event_closing_items FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_expense_items
BEFORE UPDATE ON public.financial_expense_items
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_planning_items
BEFORE UPDATE ON public.event_planning_items
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_closings
BEFORE UPDATE ON public.event_closings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_closing_items
BEFORE UPDATE ON public.event_closing_items
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

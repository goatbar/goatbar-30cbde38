ALTER TABLE public.financial_session_items
ADD COLUMN IF NOT EXISTS ingredient_cost numeric;

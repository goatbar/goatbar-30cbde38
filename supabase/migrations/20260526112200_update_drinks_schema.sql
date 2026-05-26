-- Drop foreign key constraint on sales_items referencing drinks
ALTER TABLE IF EXISTS public.sales_items DROP CONSTRAINT IF EXISTS sales_items_drink_id_fkey;

-- Drop the existing drinks table
DROP TABLE IF EXISTS public.drinks CASCADE;

-- Create the new drinks table with a text ID
CREATE TABLE public.drinks (
  id text PRIMARY KEY,
  nome text NOT NULL,
  categoria text,
  descricao text,
  custo_unitario numeric NOT NULL DEFAULT 0,
  insumos jsonb DEFAULT '[]'::jsonb,
  modality_config jsonb DEFAULT '{}'::jsonb,
  imagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drinks ENABLE ROW LEVEL SECURITY;

-- Create full access policy for authenticated users
CREATE POLICY "authenticated full access drinks"
ON public.drinks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Re-create constraint on sales_items (altering the column to text first)
ALTER TABLE IF EXISTS public.sales_items ALTER COLUMN drink_id TYPE text;
ALTER TABLE IF EXISTS public.sales_items ADD CONSTRAINT sales_items_drink_id_fkey FOREIGN KEY (drink_id) REFERENCES public.drinks(id) ON DELETE CASCADE;

-- Also alter financial_session_items.drink_id column to text so it can store text IDs
ALTER TABLE IF EXISTS public.financial_session_items ALTER COLUMN drink_id TYPE text;

ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'despesa',
  ADD COLUMN IF NOT EXISTS supplier_cnpj text,
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'Precisa revisar',
  ADD COLUMN IF NOT EXISTS ocr_raw_text text,
  ADD COLUMN IF NOT EXISTS ocr_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_filled_fields text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS manually_edited_fields text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.financial_expense_receipt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.financial_expenses(id) ON DELETE CASCADE,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_ocr_generated boolean NOT NULL DEFAULT false,
  auto_filled_fields text[] NOT NULL DEFAULT '{}'::text[],
  manually_edited_fields text[] NOT NULL DEFAULT '{}'::text[],
  reading_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.financial_expense_receipt_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_expense_receipt_logs_select_authenticated" ON public.financial_expense_receipt_logs;
CREATE POLICY "financial_expense_receipt_logs_select_authenticated"
  ON public.financial_expense_receipt_logs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "financial_expense_receipt_logs_insert_authenticated" ON public.financial_expense_receipt_logs;
CREATE POLICY "financial_expense_receipt_logs_insert_authenticated"
  ON public.financial_expense_receipt_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

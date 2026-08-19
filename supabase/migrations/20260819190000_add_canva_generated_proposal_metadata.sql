-- Keep durable Canva generation metadata on the existing proposal record.
ALTER TABLE public.generated_proposals
  ADD COLUMN IF NOT EXISTS canva_design_id text,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_path text;

COMMENT ON COLUMN public.generated_proposals.canva_design_id IS 'Design created by Canva Autofill.';
COMMENT ON COLUMN public.generated_proposals.storage_path IS 'Durable PDF path in the generated-proposals bucket.';

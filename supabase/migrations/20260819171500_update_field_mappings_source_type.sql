-- Migration: 20260819171500_update_field_mappings_source_type.sql
-- Description: Updates proposal_template_field_mappings to support source_type ('field', 'static', 'none') and nullable source_field_key / static_value

ALTER TABLE public.proposal_template_field_mappings
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'field',
ADD COLUMN IF NOT EXISTS static_value TEXT;

-- Make source_field_key nullable for static/none source types
ALTER TABLE public.proposal_template_field_mappings
ALTER COLUMN source_field_key DROP NOT NULL;

-- Constraint to ensure valid source_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ptfm_source_type'
  ) THEN
    ALTER TABLE public.proposal_template_field_mappings
    ADD CONSTRAINT chk_ptfm_source_type
    CHECK (source_type IN ('field', 'static', 'none'));
  END IF;
END $$;

-- Migration: 20260819153000_add_canva_to_proposal_templates.sql
-- Description: Adds Canva Brand Template support to proposal_templates and creates proposal_template_field_mappings

-- 1. Add Canva columns to proposal_templates
ALTER TABLE public.proposal_templates
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS canva_brand_template_id TEXT,
ADD COLUMN IF NOT EXISTS canva_brand_template_title TEXT,
ADD COLUMN IF NOT EXISTS canva_brand_template_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS canva_last_synced_at TIMESTAMPTZ;

-- 2. Create proposal_template_field_mappings table
CREATE TABLE IF NOT EXISTS public.proposal_template_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.proposal_templates(id) ON DELETE CASCADE,
    canva_field_key TEXT NOT NULL,
    canva_field_type TEXT NOT NULL DEFAULT 'text',
    source_field_key TEXT NOT NULL,
    formatter TEXT NOT NULL DEFAULT 'raw',
    required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_template_canva_field UNIQUE (template_id, canva_field_key)
);

-- Index for fast lookup by template_id
CREATE INDEX IF NOT EXISTS idx_ptfm_template_id ON public.proposal_template_field_mappings(template_id);

-- 3. Row Level Security linked to proposal_templates access
ALTER TABLE public.proposal_template_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_field_mappings" ON public.proposal_template_field_mappings;
CREATE POLICY "authenticated_select_field_mappings"
ON public.proposal_template_field_mappings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposal_templates pt
    WHERE pt.id = proposal_template_field_mappings.template_id
  )
);

DROP POLICY IF EXISTS "authenticated_insert_field_mappings" ON public.proposal_template_field_mappings;
CREATE POLICY "authenticated_insert_field_mappings"
ON public.proposal_template_field_mappings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposal_templates pt
    WHERE pt.id = proposal_template_field_mappings.template_id
  )
);

DROP POLICY IF EXISTS "authenticated_update_field_mappings" ON public.proposal_template_field_mappings;
CREATE POLICY "authenticated_update_field_mappings"
ON public.proposal_template_field_mappings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposal_templates pt
    WHERE pt.id = proposal_template_field_mappings.template_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposal_templates pt
    WHERE pt.id = proposal_template_field_mappings.template_id
  )
);

DROP POLICY IF EXISTS "authenticated_delete_field_mappings" ON public.proposal_template_field_mappings;
CREATE POLICY "authenticated_delete_field_mappings"
ON public.proposal_template_field_mappings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposal_templates pt
    WHERE pt.id = proposal_template_field_mappings.template_id
  )
);

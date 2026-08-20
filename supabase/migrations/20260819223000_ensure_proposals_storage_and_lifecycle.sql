-- Migration: ensure generated-proposals storage bucket and lifecycle indexing
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-proposals', 'generated-proposals', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for generated-proposals
DROP POLICY IF EXISTS "Acesso Publico Generated Proposals" ON storage.objects;
CREATE POLICY "Acesso Publico Generated Proposals"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-proposals');

DROP POLICY IF EXISTS "Upload Autenticado Generated Proposals" ON storage.objects;
CREATE POLICY "Upload Autenticado Generated Proposals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generated-proposals');

DROP POLICY IF EXISTS "Atualizacao Autenticada Generated Proposals" ON storage.objects;
CREATE POLICY "Atualizacao Autenticada Generated Proposals"
ON storage.objects FOR UPDATE
TO authenticated
WITH CHECK (bucket_id = 'generated-proposals');

DROP POLICY IF EXISTS "Exclusao Autenticada Generated Proposals" ON storage.objects;
CREATE POLICY "Exclusao Autenticada Generated Proposals"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'generated-proposals');

-- Ensure index on generated_proposals for quick lookup per event and budget version
CREATE INDEX IF NOT EXISTS idx_generated_proposals_event_budget
ON public.generated_proposals (event_id, budget_id, created_at DESC);

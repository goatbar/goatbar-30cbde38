-- ============================================================
-- FIX TOTAL: Recriar todas as políticas de RLS do storage
-- e das tabelas de proposta e contrato
-- ============================================================

-- ============================================================
-- 1. STORAGE: proposal-templates
-- ============================================================

-- Limpar TODAS as políticas existentes deste bucket
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (policyname ILIKE '%proposal%' OR policyname ILIKE '%Proposta%' OR policyname ILIKE '%Template%')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
  END LOOP;
END $$;

-- Recriar policy de SELECT (leitura pública)
CREATE POLICY "storage_proposal_templates_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proposal-templates');

-- Recriar policy de INSERT (qualquer role)
CREATE POLICY "storage_proposal_templates_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proposal-templates');

-- Recriar policy de UPDATE (qualquer role)
CREATE POLICY "storage_proposal_templates_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'proposal-templates')
  WITH CHECK (bucket_id = 'proposal-templates');

-- Recriar policy de DELETE (qualquer role)
CREATE POLICY "storage_proposal_templates_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'proposal-templates');

-- ============================================================
-- 2. STORAGE: generated-proposals
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (policyname ILIKE '%generated%' OR policyname ILIKE '%Gerada%')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
  END LOOP;
END $$;

CREATE POLICY "storage_generated_proposals_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-proposals');

CREATE POLICY "storage_generated_proposals_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'generated-proposals');

CREATE POLICY "storage_generated_proposals_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'generated-proposals')
  WITH CHECK (bucket_id = 'generated-proposals');

CREATE POLICY "storage_generated_proposals_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'generated-proposals');

-- ============================================================
-- 3. STORAGE: contract-templates e signed-contracts
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (policyname ILIKE '%contract%' OR policyname ILIKE '%signed%' OR policyname ILIKE '%Contrato%')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
  END LOOP;
END $$;

CREATE POLICY "storage_contract_templates_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-templates');

CREATE POLICY "storage_contract_templates_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-templates');

CREATE POLICY "storage_contract_templates_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'contract-templates')
  WITH CHECK (bucket_id = 'contract-templates');

CREATE POLICY "storage_signed_contracts_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signed-contracts');

CREATE POLICY "storage_signed_contracts_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signed-contracts');

CREATE POLICY "storage_signed_contracts_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'signed-contracts')
  WITH CHECK (bucket_id = 'signed-contracts');

-- ============================================================
-- 4. TABELAS: Garantir RLS aberta em todas as tabelas de proposta/contrato
-- ============================================================

-- proposal_templates
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public full access proposal_templates" ON public.proposal_templates;
CREATE POLICY "public full access proposal_templates"
  ON public.proposal_templates FOR ALL USING (true) WITH CHECK (true);

-- generated_proposals
ALTER TABLE public.generated_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public full access generated_proposals" ON public.generated_proposals;
CREATE POLICY "public full access generated_proposals"
  ON public.generated_proposals FOR ALL USING (true) WITH CHECK (true);

-- event_contracts
ALTER TABLE public.event_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_event_contracts" ON public.event_contracts;
DROP POLICY IF EXISTS "auth_insert_event_contracts" ON public.event_contracts;
DROP POLICY IF EXISTS "anon_insert_event_contracts" ON public.event_contracts;
DROP POLICY IF EXISTS "auth_update_event_contracts" ON public.event_contracts;
DROP POLICY IF EXISTS "auth_delete_event_contracts" ON public.event_contracts;
DROP POLICY IF EXISTS "public full access event_contracts" ON public.event_contracts;
CREATE POLICY "public full access event_contracts"
  ON public.event_contracts FOR ALL USING (true) WITH CHECK (true);

-- contract_templates
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_contract_templates" ON public.contract_templates;
DROP POLICY IF EXISTS "auth_insert_contract_templates" ON public.contract_templates;
DROP POLICY IF EXISTS "auth_update_contract_templates" ON public.contract_templates;
DROP POLICY IF EXISTS "auth_delete_contract_templates" ON public.contract_templates;
CREATE POLICY "public full access contract_templates"
  ON public.contract_templates FOR ALL USING (true) WITH CHECK (true);

-- contract_signers
ALTER TABLE public.contract_signers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_contract_signers" ON public.contract_signers;
DROP POLICY IF EXISTS "auth_insert_contract_signers" ON public.contract_signers;
DROP POLICY IF EXISTS "auth_update_contract_signers" ON public.contract_signers;
CREATE POLICY "public full access contract_signers"
  ON public.contract_signers FOR ALL USING (true) WITH CHECK (true);

-- event_contract_client_data
ALTER TABLE public.event_contract_client_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_client_data" ON public.event_contract_client_data;
DROP POLICY IF EXISTS "anon_insert_client_data" ON public.event_contract_client_data;
DROP POLICY IF EXISTS "anon_update_client_data" ON public.event_contract_client_data;
CREATE POLICY "public full access event_contract_client_data"
  ON public.event_contract_client_data FOR ALL USING (true) WITH CHECK (true);

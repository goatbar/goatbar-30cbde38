-- ============================================================
-- Fix RLS: permitir anon também fazer upload nos buckets de proposta
-- Garante que usuários autenticados E anônimos possam inserir/ler
-- ============================================================

-- Storage: proposal-templates — liberar para anon também
DROP POLICY IF EXISTS "Upload Anon Proposal Templates" ON storage.objects;
CREATE POLICY "Upload Anon Proposal Templates"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'proposal-templates');

-- Storage: generated-proposals — liberar para anon também  
DROP POLICY IF EXISTS "Upload Anon Generated Proposals" ON storage.objects;
CREATE POLICY "Upload Anon Generated Proposals"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'generated-proposals');

-- Tabela: proposal_templates — garantir política ampla para todos os roles
DROP POLICY IF EXISTS "public full access proposal_templates" ON public.proposal_templates;
CREATE POLICY "public full access proposal_templates"
  ON public.proposal_templates FOR ALL USING (true) WITH CHECK (true);

-- Tabela: generated_proposals — garantir política ampla
DROP POLICY IF EXISTS "public full access generated_proposals" ON public.generated_proposals;
CREATE POLICY "public full access generated_proposals"
  ON public.generated_proposals FOR ALL USING (true) WITH CHECK (true);

-- Tabela: event_contracts — garantir política ampla para insert sem autenticação
DROP POLICY IF EXISTS "public full access event_contracts" ON public.event_contracts;
CREATE POLICY "public full access event_contracts"
  ON public.event_contracts FOR ALL USING (true) WITH CHECK (true);

-- Storage: contract-templates — liberar para anon
DROP POLICY IF EXISTS "Upload Anon Contract Templates" ON storage.objects;
CREATE POLICY "Upload Anon Contract Templates"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'contract-templates');

-- Storage: signed-contracts — liberar para anon
DROP POLICY IF EXISTS "Upload Anon Signed Contracts" ON storage.objects;
CREATE POLICY "Upload Anon Signed Contracts"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'signed-contracts');

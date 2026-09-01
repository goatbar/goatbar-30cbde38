-- Migration: 20260902000000_create_contract_addendums_schema.sql
-- Adiciona vínculo de versão de proposta em event_contracts e cria a tabela de Termos Aditivos Contratuais.

BEGIN;

-- 1. Vincula versão de proposta ao contrato original
ALTER TABLE public.event_contracts
  ADD COLUMN IF NOT EXISTS budget_version_id UUID REFERENCES public.event_budget_versions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_contracts.budget_version_id IS
  'Versão imutável da proposta comercial que originou este contrato original.';

-- 2. Backfill determinístico para contratos legados que possuem exatamente 1 versão de proposta
DO $$
DECLARE
  r RECORD;
  v_budget_id UUID;
  v_count INTEGER;
BEGIN
  FOR r IN SELECT id, event_id FROM public.event_contracts WHERE budget_version_id IS NULL LOOP
    SELECT COUNT(*)
      INTO v_count
      FROM public.event_budget_versions
     WHERE event_id = r.event_id::uuid;

    IF v_count = 1 THEN
      SELECT id
        INTO v_budget_id
        FROM public.event_budget_versions
       WHERE event_id = r.event_id::uuid
       LIMIT 1;

      UPDATE public.event_contracts
         SET budget_version_id = v_budget_id
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 3. Tabela de Termos Aditivos Contratuais
CREATE TABLE IF NOT EXISTS public.contract_addendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  addendum_number INTEGER NOT NULL DEFAULT 1,
  
  -- Vínculos históricos de versão da proposta
  base_budget_version_id UUID REFERENCES public.event_budget_versions(id) ON DELETE SET NULL,
  updated_budget_version_id UUID REFERENCES public.event_budget_versions(id) ON DELETE SET NULL,
  
  -- Snapshots imutáveis
  contractant_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  contracted_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  financial_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Datas jurídicas
  original_contract_date TIMESTAMPTZ NOT NULL,
  addendum_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Documento gerado e estado do aditivo
  generated_html TEXT,
  generated_file_url TEXT,
  signed_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  
  -- Rastreamento de assinatura remota (Assinafy / ZapSign)
  external_document_id TEXT,
  external_assignment_id TEXT,
  sent_for_signature_at TIMESTAMPTZ,
  fully_signed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Índice parcial único para idempotência (permite novo aditivo se o anterior foi cancelado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_contract_addendum_transition
  ON public.contract_addendums (contract_id, base_budget_version_id, updated_budget_version_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_addendums_contract_id ON public.contract_addendums(contract_id);
CREATE INDEX IF NOT EXISTS idx_addendums_event_id ON public.contract_addendums(event_id);
CREATE INDEX IF NOT EXISTS idx_addendums_status ON public.contract_addendums(status);
CREATE INDEX IF NOT EXISTS idx_addendums_external_doc ON public.contract_addendums(external_document_id);

-- 5. RLS: Replicando política de event_contracts
ALTER TABLE public.contract_addendums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_contract_addendums" ON public.contract_addendums;
CREATE POLICY "public_select_contract_addendums"
  ON public.contract_addendums FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_contract_addendums" ON public.contract_addendums;
CREATE POLICY "auth_insert_contract_addendums"
  ON public.contract_addendums FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_contract_addendums" ON public.contract_addendums;
CREATE POLICY "anon_insert_contract_addendums"
  ON public.contract_addendums FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_contract_addendums" ON public.contract_addendums;
CREATE POLICY "auth_update_contract_addendums"
  ON public.contract_addendums FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_contract_addendums" ON public.contract_addendums;
CREATE POLICY "auth_delete_contract_addendums"
  ON public.contract_addendums FOR DELETE TO authenticated USING (true);

-- 6. Atualização do RPC do webhook Assinafy para suportar conclusão de Termos Aditivos
CREATE OR REPLACE FUNCTION public.process_assinafy_webhook_event(
  p_external_event_id TEXT,
  p_event_type TEXT,
  p_external_document_id TEXT,
  p_payload JSONB,
  p_request_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_signer_id TEXT;
  v_norm_type TEXT;
BEGIN
  BEGIN
    INSERT INTO public.contract_signature_events (
      external_event_id,
      contract_id,
      event_type,
      payload,
      status
    ) VALUES (
      p_external_event_id,
      NULL,
      p_event_type,
      p_payload,
      'processing'
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('duplicate', true, 'processed', false, 'reason', 'duplicate');
  END;

  IF p_external_document_id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'document_not_found');
  END IF;

  SELECT id, contract_id, dispatch_status, internal_status
  INTO v_req
  FROM public.contract_signature_requests
  WHERE external_document_id = p_external_document_id
  LIMIT 1;

  IF v_req.id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'document_not_found');
  END IF;

  UPDATE public.contract_signature_events
  SET contract_id = v_req.contract_id
  WHERE external_event_id = p_external_event_id;

  v_norm_type := lower(p_event_type);

  IF v_norm_type = 'signer_signed_document' THEN
    v_signer_id := COALESCE(
      p_payload->'subject'->>'id',
      p_payload->'object'->'signer'->>'id',
      p_payload->'payload'->>'signer_id'
    );
    IF v_signer_id IS NOT NULL THEN
      UPDATE public.contract_signature_signers
      SET status = 'signed', signed_at = now(), updated_at = now()
      WHERE signature_request_id = v_req.id AND external_signer_id = v_signer_id;
    END IF;

    IF v_req.dispatch_status = 'pending_signature' THEN
      UPDATE public.contract_signature_requests
      SET dispatch_status = 'partially_signed', updated_at = now()
      WHERE id = v_req.id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  IF v_req.dispatch_status IN ('completed', 'signed') THEN
    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', 'already_final');
  END IF;

  -- 2. Conclusão global (document_ready / document_completed)
  IF v_norm_type IN ('document_ready', 'document_completed', 'completed') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'completed', internal_status = 'signed', completed_at = now(), updated_at = now()
    WHERE id = v_req.id;

    IF v_req.contract_id IS NOT NULL THEN
      UPDATE public.event_contracts
      SET status = 'signed', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    -- Atualização atômica do Termo Aditivo vinculado (se for um aditivo)
    UPDATE public.contract_addendums
    SET status = 'signed', fully_signed_at = now(), updated_at = now()
    WHERE external_document_id = p_external_document_id;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- 3. Rejeição por signatário
  IF v_norm_type IN ('signer_rejected_document') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'failed', internal_status = 'pending_signature', updated_at = now()
    WHERE id = v_req.id;

    IF v_req.contract_id IS NOT NULL THEN
      UPDATE public.event_contracts
      SET status = 'signature_rejected', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- 4. Cancelamento de documento
  IF v_norm_type IN ('user_rejected_document', 'document.canceled', 'canceled') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'canceled', internal_status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = v_req.id;

    UPDATE public.contract_addendums
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE external_document_id = p_external_document_id;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  UPDATE public.contract_signature_events
  SET status = 'unsupported'
  WHERE external_event_id = p_external_event_id;

  RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'unsupported_event');
END;
$$;

COMMIT;

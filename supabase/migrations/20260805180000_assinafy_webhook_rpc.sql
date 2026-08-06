-- Migration Assinafy Webhook RPC & Idempotência Atômica

-- 1. Garante coluna status em contract_signature_events para ciclo de vida do webhook
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='contract_signature_events' AND column_name='status'
    ) THEN
        ALTER TABLE public.contract_signature_events 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'processing';
    END IF;
END $$;

-- 2. Função RPC atômica para idempotência, vinculo e transições de estado
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
  -- Sub-bloco isolado exclusivamente para o INSERT do evento e captura de unicidade (23505)
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
      RETURN jsonb_build_object(
        'duplicate', true,
        'processed', false,
        'reason', 'duplicate'
      );
  END;

  -- Se ID do documento externo for nulo, marca como documento não encontrado
  IF p_external_document_id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object(
      'duplicate', false,
      'processed', false,
      'reason', 'document_not_found'
    );
  END IF;

  -- Busca solicitação vinculada estritamente por external_document_id
  SELECT id, contract_id, dispatch_status, internal_status
  INTO v_req
  FROM public.contract_signature_requests
  WHERE external_document_id = p_external_document_id
  LIMIT 1;

  IF v_req.id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object(
      'duplicate', false,
      'processed', false,
      'reason', 'document_not_found'
    );
  END IF;

  -- Associa o contract_id no registro de auditoria do evento
  UPDATE public.contract_signature_events
  SET contract_id = v_req.contract_id
  WHERE external_event_id = p_external_event_id;

  v_norm_type := lower(p_event_type);

  -- 1. Assinatura individual de signatário
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

    -- Não conclui o contrato globalmente. Atualiza dispatch_status para parcialmente assinado se estivesse pendente
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

  -- Proteção contra regressão de estado se a solicitação já estiver em estado final
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

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- 3. Rejeição por signatário (signer_rejected_document)
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

  -- 4. Cancelamento de documento (user_rejected_document / document.canceled)
  IF v_norm_type IN ('user_rejected_document', 'document.canceled', 'canceled') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'canceled', internal_status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = v_req.id;

    IF v_req.contract_id IS NOT NULL THEN
      UPDATE public.event_contracts
      SET status = 'cancelled', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- Evento não mapeado / não suportado
  UPDATE public.contract_signature_events
  SET status = 'unsupported'
  WHERE external_event_id = p_external_event_id;

  RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'unsupported_event');
END;
$$;

-- Permissões de Segurança Rigorosas
ALTER FUNCTION public.process_assinafy_webhook_event(TEXT, TEXT, TEXT, JSONB, UUID) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.process_assinafy_webhook_event(TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_assinafy_webhook_event(TEXT, TEXT, TEXT, JSONB, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.process_assinafy_webhook_event(TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_assinafy_webhook_event(TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

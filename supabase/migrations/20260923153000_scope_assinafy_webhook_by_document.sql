BEGIN;

ALTER TABLE public.contract_addendums
  DROP CONSTRAINT IF EXISTS contract_addendums_status_check;

ALTER TABLE public.contract_addendums
  ADD CONSTRAINT contract_addendums_status_check
  CHECK (status IN ('draft', 'sent', 'signed', 'rejected', 'cancelled'));

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
  v_addendum RECORD;
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

  SELECT
    id,
    contract_id,
    event_id,
    dispatch_status,
    internal_status,
    document_kind,
    addendum_id
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

  IF v_req.addendum_id IS NOT NULL THEN
    SELECT id, addendum_number
    INTO v_addendum
    FROM public.contract_addendums
    WHERE id = v_req.addendum_id
    LIMIT 1;
  END IF;

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
      WHERE signature_request_id = v_req.id
        AND external_signer_id = v_signer_id;
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

  IF v_norm_type IN ('document_completed', 'completed') THEN
    UPDATE public.contract_signature_requests
    SET
      dispatch_status = 'completed',
      internal_status = 'signed',
      completed_at = now(),
      updated_at = now()
    WHERE id = v_req.id;

    IF v_req.document_kind = 'addendum' AND v_req.addendum_id IS NOT NULL THEN
      UPDATE public.contract_addendums
      SET
        status = 'signed',
        fully_signed_at = now(),
        updated_at = now()
      WHERE id = v_req.addendum_id;
    ELSE
      UPDATE public.event_contracts
      SET status = 'signed', fully_signed_at = COALESCE(fully_signed_at, now()), updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.contract_documents
      WHERE external_document_id = p_external_document_id
        AND deleted_at IS NULL
    ) THEN
      INSERT INTO public.contract_documents (
        event_id,
        contract_id,
        addendum_id,
        document_type,
        document_name,
        original_filename,
        storage_bucket,
        storage_path,
        source,
        external_document_id,
        is_signed,
        is_final,
        archive_status,
        signed_at
      ) VALUES (
        v_req.event_id,
        v_req.contract_id,
        CASE WHEN v_req.document_kind = 'addendum' THEN v_req.addendum_id ELSE NULL END,
        CASE WHEN v_req.document_kind = 'addendum' THEN 'signed_addendum' ELSE 'signed_contract' END,
        CASE
          WHEN v_req.document_kind = 'addendum'
            THEN 'Termo Aditivo nº ' || COALESCE(v_addendum.addendum_number, 1) || ' Assinado (Assinafy)'
          ELSE 'Contrato Assinado (Assinafy)'
        END,
        CASE
          WHEN v_req.document_kind = 'addendum'
            THEN 'termo_aditivo_assinado_assinafy.pdf'
          ELSE 'contrato_assinado_assinafy.pdf'
        END,
        'contract-documents',
        '',
        'assinafy',
        p_external_document_id,
        true,
        true,
        'pending',
        now()
      );
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  IF v_norm_type = 'signer_rejected_document' THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'failed', internal_status = 'pending_signature', updated_at = now()
    WHERE id = v_req.id;

    IF v_req.document_kind = 'addendum' AND v_req.addendum_id IS NOT NULL THEN
      UPDATE public.contract_addendums
      SET status = 'rejected', updated_at = now()
      WHERE id = v_req.addendum_id;
    ELSE
      UPDATE public.event_contracts
      SET status = 'signature_rejected', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  IF v_norm_type IN ('user_rejected_document', 'document.canceled', 'canceled') THEN
    UPDATE public.contract_signature_requests
    SET
      dispatch_status = 'canceled',
      internal_status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    WHERE id = v_req.id;

    IF v_req.document_kind = 'addendum' AND v_req.addendum_id IS NOT NULL THEN
      UPDATE public.contract_addendums
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE id = v_req.addendum_id;
    END IF;

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

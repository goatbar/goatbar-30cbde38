-- Notificações operacionais de contratos (sem modificar os fluxos de assinatura).
-- As notificações são idempotentes por evento e identificador da origem.
CREATE OR REPLACE FUNCTION public.insert_contract_operational_notification(
  p_key text,
  p_event_id uuid,
  p_kind text,
  p_actor text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_title text;
  v_event_name text;
  v_client_name text;
BEGIN
  IF p_kind NOT IN ('contract_data_received', 'contract_client_signed', 'contract_fully_signed')
     OR p_event_id IS NULL
     OR p_key IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_event_name := coalesce(nullif(v_event.event_name, ''), nullif(v_event.event_type, ''), 'Evento');
  v_client_name := coalesce(nullif(p_actor, ''), nullif(v_event.client_name, ''), 'Cliente');
  v_title := CASE p_kind
    WHEN 'contract_data_received' THEN 'Dados do contrato recebidos'
    WHEN 'contract_client_signed' THEN 'Cliente assinou o contrato'
    ELSE 'Contrato totalmente assinado'
  END;

  INSERT INTO public.ai_inbox_items (
    source, source_message_id, source_sender_name, message_type,
    raw_text, classification, classification_confidence,
    processing_status, processing_mode, approval_status,
    matched_event_id, structured_data, received_at, processed_at
  ) VALUES (
    'api', p_key, v_client_name, 'text',
    v_title || ': ' || v_event_name || ' — ' || v_client_name,
    'event_note', 1, 'processed', 'heuristic', 'not_required',
    p_event_id,
    jsonb_build_object(
      'type', p_kind,
      'event_id', p_event_id,
      'event_name', v_event_name,
      'client_name', v_client_name,
      'event_url', '/eventos/' || p_event_id::text,
      'notified_at', now()
    ),
    now(), now()
  ) ON CONFLICT DO NOTHING;

EXCEPTION WHEN others THEN
  -- Falhas no aviso não podem impedir o envio do formulário ou a assinatura.
  RAISE WARNING '[contract-notification] %: %', p_key, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_contract_operational_notification(text,uuid,text,text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_contract_data_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.insert_contract_operational_notification(
    'contract_data_received:' || NEW.id::text,
    NEW.event_id,
    'contract_data_received',
    NEW.client_name
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_contract_data_received() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_data_received_notification
  ON public.event_contract_client_data;
CREATE TRIGGER trg_contract_data_received_notification
AFTER UPDATE OF submitted_at ON public.event_contract_client_data
FOR EACH ROW
WHEN (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL)
EXECUTE FUNCTION public.notify_contract_data_received();

CREATE OR REPLACE FUNCTION public.notify_contract_client_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req RECORD;
  v_event_id uuid;
BEGIN
  SELECT event_id, document_kind, dispatch_status INTO v_req
  FROM public.contract_signature_requests
  WHERE id = NEW.signature_request_id;

  IF NOT FOUND
     OR coalesce(v_req.document_kind, 'contract') <> 'contract'
     OR v_req.dispatch_status IN ('canceled', 'obsolete') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_event_id
  FROM public.events WHERE id::text = v_req.event_id LIMIT 1;

  PERFORM public.insert_contract_operational_notification(
    'contract_client_signed:' || NEW.id::text,
    v_event_id,
    'contract_client_signed',
    NEW.full_name
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_contract_client_signed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_client_signed_notification
  ON public.contract_signature_signers;
CREATE TRIGGER trg_contract_client_signed_notification
AFTER UPDATE OF status ON public.contract_signature_signers
FOR EACH ROW
WHEN (NEW.role = 'client' AND NEW.status = 'signed' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_contract_client_signed();

CREATE OR REPLACE FUNCTION public.notify_contract_fully_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_event_id uuid;
BEGIN
  IF coalesce(NEW.document_kind, 'contract') <> 'contract' THEN RETURN NEW; END IF;
  SELECT id INTO v_event_id
  FROM public.events WHERE id::text = NEW.event_id LIMIT 1;

  PERFORM public.insert_contract_operational_notification(
    'contract_fully_signed:' || NEW.id::text,
    v_event_id,
    'contract_fully_signed'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_contract_fully_signed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_fully_signed_notification
  ON public.contract_signature_requests;
CREATE TRIGGER trg_contract_fully_signed_notification
AFTER UPDATE OF dispatch_status ON public.contract_signature_requests
FOR EACH ROW
WHEN (NEW.dispatch_status = 'completed' AND OLD.dispatch_status IS DISTINCT FROM NEW.dispatch_status)
EXECUTE FUNCTION public.notify_contract_fully_signed();

-- Reaproveita a infra pg_net + Vault + Web Push já ativa na GOAT.
CREATE OR REPLACE FUNCTION public.dispatch_contract_web_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_secret text;
BEGIN
  IF NEW.source <> 'api'
     OR NEW.structured_data->>'type' NOT IN (
       'contract_data_received', 'contract_client_signed', 'contract_fully_signed'
     ) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'goatbar_push_webhook_secret' LIMIT 1;

  IF coalesce(v_secret, '') = '' THEN
    RAISE WARNING '[contract-push] secret unavailable, notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/web-push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-goatbar-push-secret', v_secret
    ),
    body := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING '[contract-push] dispatch failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_contract_web_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_operational_web_push ON public.ai_inbox_items;
CREATE TRIGGER trg_contract_operational_web_push
AFTER INSERT ON public.ai_inbox_items
FOR EACH ROW
WHEN (
  NEW.source = 'api'
  AND (NEW.structured_data->>'type') IN (
    'contract_data_received', 'contract_client_signed', 'contract_fully_signed'
  )
)
EXECUTE FUNCTION public.dispatch_contract_web_push();

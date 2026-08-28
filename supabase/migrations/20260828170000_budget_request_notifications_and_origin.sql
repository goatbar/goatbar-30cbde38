-- Deterministic provenance and explicit opt-in for new-budget notifications.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual', 'public_budget_form'));

ALTER TABLE public.user_messaging_accounts
  ADD COLUMN IF NOT EXISTS receive_new_budget_notifications boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS events_pending_public_budget_idx
  ON public.events (created_at DESC)
  WHERE origin = 'public_budget_form' AND status = 'novo_orcamento';

-- Existing consumed links are authoritative provenance and can be backfilled safely.
UPDATE public.events e SET origin = 'public_budget_form'
FROM public.budget_request_links l WHERE l.event_id = e.id;
CREATE OR REPLACE FUNCTION public.consume_budget_request_link(
  p_token text,
  p_client_name text,
  p_event_name text,
  p_phone text,
  p_email text,
  p_date date,
  p_event_time text,
  p_event_location text,
  p_city text,
  p_event_type text,
  p_guests integer,
  p_lead_source text,
  p_referral_name text,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.budget_request_links%ROWTYPE;
  v_event_id uuid;
BEGIN
  SELECT * INTO v_link FROM public.budget_request_links
  WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'INVALID'); END IF;
  IF v_link.status = 'USED' THEN
    RETURN jsonb_build_object('state', 'USED', 'event_id', v_link.event_id, 'idempotent', true);
  END IF;
  IF v_link.status = 'CANCELLED' OR v_link.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('state', 'CANCELLED');
  END IF;
  IF v_link.status = 'EXPIRED' OR (v_link.expires_at IS NOT NULL AND v_link.expires_at <= now()) THEN
    UPDATE public.budget_request_links SET status = 'EXPIRED' WHERE id = v_link.id;
    RETURN jsonb_build_object('state', 'EXPIRED');
  END IF;
  IF v_link.status <> 'ACTIVE' THEN RETURN jsonb_build_object('state', 'INVALID'); END IF;

  INSERT INTO public.events (
    client_name, event_name, phone, email, date, event_time, event_location,
    city, event_type, guests, lead_source, referral_name, notes, status, origin
  ) VALUES (
    p_client_name, NULLIF(p_event_name, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
    p_date, NULLIF(p_event_time, ''), NULLIF(p_event_location, ''), NULLIF(p_city, ''),
    p_event_type, p_guests, COALESCE(NULLIF(p_lead_source, ''), 'Formulário público'),
    NULLIF(p_referral_name, ''), NULLIF(p_notes, ''), 'novo_orcamento', 'public_budget_form'
  ) RETURNING id INTO v_event_id;

  UPDATE public.budget_request_links SET
    event_id = v_event_id, status = 'USED', used_at = now(),
    notification_status = 'PENDING', notification_error = NULL
  WHERE id = v_link.id;

  RETURN jsonb_build_object('state', 'CREATED', 'event_id', v_event_id, 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_budget_request_link(text,text,text,text,text,date,text,text,text,text,integer,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_budget_request_link(text,text,text,text,text,date,text,text,text,text,integer,text,text,text) TO service_role;

-- Atomic claim used by initial delivery and controlled retries. SENT can never be claimed.
CREATE OR REPLACE FUNCTION public.claim_budget_request_notification(p_event_id uuid, p_retry boolean DEFAULT false)
RETURNS public.budget_request_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_link public.budget_request_links;
BEGIN
  UPDATE public.budget_request_links SET
    notification_status = 'PROCESSING', notification_error = NULL
  WHERE event_id = p_event_id
    AND (notification_status = 'PENDING' OR (p_retry AND notification_status = 'FAILED'))
  RETURNING * INTO v_link;
  RETURN v_link;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_budget_request_notification(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_budget_request_notification(uuid, boolean) TO service_role;

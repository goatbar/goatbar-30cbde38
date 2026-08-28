-- Public budget-request links. Public callers never receive table privileges:
-- the budget-request Edge Function is the only public entry point.
-- Close legacy policies that implicitly included anon. Staff CRUD remains intact.
DROP POLICY IF EXISTS "public full access events" ON public.events;
DROP POLICY IF EXISTS "public full access budget_versions" ON public.event_budget_versions;
DROP POLICY IF EXISTS "public full access budget_history" ON public.event_budget_history;
DROP POLICY IF EXISTS "public full access negotiation_history" ON public.event_negotiation_history;
CREATE POLICY budget_request_authenticated_events ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY budget_request_authenticated_versions ON public.event_budget_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY budget_request_authenticated_history ON public.event_budget_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY budget_request_authenticated_negotiation ON public.event_negotiation_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.budget_request_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (length(token) BETWEEN 32 AND 128),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz,
  cancelled_at timestamptz,
  event_id uuid UNIQUE REFERENCES public.events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  notification_status text NOT NULL DEFAULT 'PENDING' CHECK (notification_status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  notification_sent_at timestamptz,
  notification_error text,
  CONSTRAINT budget_request_used_consistency CHECK (
    (status = 'USED' AND event_id IS NOT NULL AND used_at IS NOT NULL)
    OR status <> 'USED'
  )
);

CREATE INDEX budget_request_links_active_expiry_idx
  ON public.budget_request_links (expires_at) WHERE status = 'ACTIVE';

ALTER TABLE public.budget_request_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_request_links FROM anon, authenticated;

-- Authenticated staff may inspect links they created, but creation and all public
-- validation/submission remain server-side so tokens cannot be enumerated via REST.
CREATE POLICY budget_request_links_staff_select
  ON public.budget_request_links FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Atomically consumes one link and creates the canonical events row. The row lock
-- makes concurrent/retried submissions return the original event_id.
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
    city, event_type, guests, lead_source, referral_name, notes, status
  ) VALUES (
    p_client_name, NULLIF(p_event_name, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
    p_date, NULLIF(p_event_time, ''), NULLIF(p_event_location, ''), NULLIF(p_city, ''),
    p_event_type, p_guests, COALESCE(NULLIF(p_lead_source, ''), 'Formulário público'),
    NULLIF(p_referral_name, ''), NULLIF(p_notes, ''), 'novo_orcamento'
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

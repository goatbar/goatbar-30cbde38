-- Explicit opt-in catalog flag. Existing drinks remain private until reviewed.
ALTER TABLE public.drinks
  ADD COLUMN show_in_public_menu boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.drinks.show_in_public_menu IS
  'Explicitly allows an active Eventos drink to appear in the public budget-request catalog.';

-- Preferences are intentionally separate from events.drinks and
-- event_budget_versions.selected_drinks, both of which are commercial composition.
CREATE TABLE public.event_requested_drinks (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  drink_id text NOT NULL REFERENCES public.drinks(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, drink_id)
);

ALTER TABLE public.event_requested_drinks ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_requested_drinks_authenticated_access
  ON public.event_requested_drinks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.event_requested_drinks FROM anon;

-- Replace the public-submit RPC rather than altering the previous migration.
DROP FUNCTION IF EXISTS public.consume_budget_request_link(text,text,text,text,text,date,text,text,text,text,integer,text,text,text);
CREATE FUNCTION public.consume_budget_request_link(
  p_token text, p_client_name text, p_event_name text, p_phone text, p_email text,
  p_date date, p_event_time text, p_event_location text, p_city text, p_event_type text,
  p_guests integer, p_lead_source text, p_referral_name text, p_notes text,
  p_groom_name text, p_bride_name text, p_duration_hours integer,
  p_requested_drink_ids text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.budget_request_links%ROWTYPE;
  v_event_id uuid;
  v_valid_count integer;
BEGIN
  SELECT * INTO v_link FROM public.budget_request_links WHERE token = p_token FOR UPDATE;
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

  SELECT count(*) INTO v_valid_count FROM public.drinks d
  WHERE d.id = ANY(COALESCE(p_requested_drink_ids, ARRAY[]::text[]))
    AND d.show_in_public_menu = true
    AND COALESCE((d.modality_config->'evento'->>'active')::boolean, false) = true;
  IF v_valid_count <> cardinality(COALESCE(p_requested_drink_ids, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'Um ou mais drinks selecionados não estão disponíveis na carta pública.';
  END IF;

  INSERT INTO public.events (
    client_name, event_name, phone, email, date, event_time, duration_hours,
    event_location, city, event_type, guests, lead_source, referral_name, notes,
    groom_name, bride_name, status
  ) VALUES (
    p_client_name, NULLIF(p_event_name, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
    p_date, NULLIF(p_event_time, ''), p_duration_hours, NULLIF(p_event_location, ''),
    NULLIF(p_city, ''), p_event_type, p_guests,
    COALESCE(NULLIF(p_lead_source, ''), 'Formulário público'), NULLIF(p_referral_name, ''),
    NULLIF(p_notes, ''), NULLIF(p_groom_name, ''), NULLIF(p_bride_name, ''), 'novo_orcamento'
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.event_requested_drinks(event_id, drink_id)
  SELECT v_event_id, requested.id
  FROM unnest(COALESCE(p_requested_drink_ids, ARRAY[]::text[])) AS requested(id);

  UPDATE public.budget_request_links SET event_id = v_event_id, status = 'USED', used_at = now(),
    notification_status = 'PENDING', notification_error = NULL WHERE id = v_link.id;
  RETURN jsonb_build_object('state', 'CREATED', 'event_id', v_event_id, 'idempotent', false);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_budget_request_link(text,text,text,text,text,date,text,text,text,text,integer,text,text,text,text,text,integer,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_budget_request_link(text,text,text,text,text,date,text,text,text,text,integer,text,text,text,text,text,integer,text[]) TO service_role;

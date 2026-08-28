-- One delivery ledger for both token and tokenless public requests.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_request_session_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS events_public_request_session_uidx
  ON public.events(public_request_session_id)
  WHERE public_request_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.budget_request_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_request_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_request_notifications FROM anon, authenticated;

-- Tokenless LP submissions before events.origin existed are authoritatively identified
-- by the idempotency/funnel row written only after their events INSERT succeeded.
UPDATE public.events e SET origin = 'public_budget_form'
WHERE EXISTS (
  SELECT 1 FROM public.lead_funnel_events f
  WHERE f.event_id = e.id AND f.event_name = 'public_request_submitted'
);
INSERT INTO public.budget_request_notifications(event_id, status, sent_at, error)
SELECT e.id,
  CASE l.notification_status WHEN 'SENT' THEN 'SENT' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END,
  l.notification_sent_at, l.notification_error
FROM public.events e
LEFT JOIN public.budget_request_links l ON l.event_id = e.id
WHERE e.origin = 'public_budget_form'
ON CONFLICT (event_id) DO NOTHING;

-- The previous migration returned budget_request_links. PostgreSQL cannot change a
-- function's return type with CREATE OR REPLACE, so remove that exact overload
-- when it has no dependants. If an existing database object depends on it, rename
-- it instead: renaming preserves its OID, grants, and all dependency links while
-- freeing the public name for the new contract.
DO $$
DECLARE
  v_function_oid oid := to_regprocedure(
    'public.claim_budget_request_notification(uuid,boolean)'
  );
  v_has_dependants boolean;
BEGIN
  IF v_function_oid IS NULL OR (
    SELECT p.prorettype = 'public.budget_request_notifications'::regtype
    FROM pg_catalog.pg_proc p
    WHERE p.oid = v_function_oid
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_depend d
    WHERE d.refclassid = 'pg_catalog.pg_proc'::regclass
      AND d.refobjid = v_function_oid
      AND d.deptype <> 'e'
  ) INTO v_has_dependants;

  IF v_has_dependants THEN
    IF to_regprocedure(
      'public.claim_budget_request_notification_legacy(uuid,boolean)'
    ) IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot preserve dependent claim_budget_request_notification: legacy name already exists';
    END IF;

    ALTER FUNCTION public.claim_budget_request_notification(uuid, boolean)
      RENAME TO claim_budget_request_notification_legacy;
  ELSE
    DROP FUNCTION public.claim_budget_request_notification(uuid, boolean);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.claim_budget_request_notification(p_event_id uuid, p_retry boolean DEFAULT false)
RETURNS public.budget_request_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_notification public.budget_request_notifications;
BEGIN
  INSERT INTO public.budget_request_notifications(event_id)
  SELECT p_event_id WHERE EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND origin = 'public_budget_form'
  ) ON CONFLICT (event_id) DO NOTHING;
  UPDATE public.budget_request_notifications SET status='PROCESSING', error=NULL, updated_at=now()
  WHERE event_id=p_event_id AND (status='PENDING' OR (p_retry AND status='FAILED'))
  RETURNING * INTO v_notification;
  RETURN v_notification;
END $$;
REVOKE ALL ON FUNCTION public.claim_budget_request_notification(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_budget_request_notification(uuid, boolean) TO service_role;

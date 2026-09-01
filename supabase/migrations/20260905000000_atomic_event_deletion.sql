-- Event deletion is intentionally centralized here. All rows which represent
-- event-owned aggregate data use CASCADE; shared CRM/AI records retain their
-- identity and only lose the event pointer (SET NULL).
--
-- budget_request_links used to be SET NULL, which is incompatible with
-- budget_request_used_consistency: a USED link is required to have an event_id.
-- PostgreSQL therefore raised 23514 while processing DELETE events. Repeating
-- this alteration makes the production fix idempotent even if an older version
-- of the public-request migration was applied out of order.
ALTER TABLE public.budget_request_links
  DROP CONSTRAINT IF EXISTS budget_request_links_event_id_fkey;

ALTER TABLE public.budget_request_links
  ADD CONSTRAINT budget_request_links_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.delete_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_had_public_request boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'É necessário estar autenticado para excluir um evento.';
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.budget_request_links WHERE event_id = p_event_id
  ) INTO v_had_public_request;

  -- One statement gives PostgreSQL atomic cascading semantics. Event-owned
  -- budgets/history/proposals/contracts/documents/addenda/planning/drink rows
  -- are CASCADE FKs. Shared leads, funnel events and AI messages are SET NULL.
  DELETE FROM public.events WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'event_id', p_event_id,
    'origin', v_event.origin,
    'public_request_deleted', v_had_public_request
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.delete_event(uuid) IS
  'Atomically deletes an event aggregate, cascading owned rows and preserving shared records via their FK actions.';

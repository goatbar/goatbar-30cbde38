-- A USED link must have an event_id, while the original ON DELETE SET NULL tried
-- to clear that value before checking the constraint.  Consequently deleting a
-- submitted public request/event failed with budget_request_used_consistency.
-- The link is request lifecycle data, so remove it together with its event.
ALTER TABLE public.budget_request_links
  DROP CONSTRAINT IF EXISTS budget_request_links_event_id_fkey;

ALTER TABLE public.budget_request_links
  ADD CONSTRAINT budget_request_links_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Legacy rows remain NULL and use the event only as an explicit compatibility
-- fallback. Do not manufacture history by backfilling mutable current values.
ALTER TABLE public.event_budget_versions
  ADD COLUMN IF NOT EXISTS guest_count integer,
  ADD COLUMN IF NOT EXISTS event_snapshot jsonb;

ALTER TABLE public.event_budget_versions
  ADD CONSTRAINT event_budget_versions_guest_count_nonnegative
  CHECK (guest_count IS NULL OR guest_count >= 0);

COMMENT ON COLUMN public.event_budget_versions.guest_count IS
  'Canonical guest count used to calculate this immutable budget version; NULL only for legacy records.';
COMMENT ON COLUMN public.event_budget_versions.event_snapshot IS
  'Immutable event/customer context used when this budget version was calculated. Legacy records may be NULL.';

CREATE OR REPLACE FUNCTION public.protect_budget_version_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['is_current', 'status', 'updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['is_current', 'status', 'updated_at']) THEN
    RAISE EXCEPTION 'Commercial data of a persisted budget version is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_budget_version_snapshot ON public.event_budget_versions;
CREATE TRIGGER protect_budget_version_snapshot
BEFORE UPDATE ON public.event_budget_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_budget_version_snapshot();

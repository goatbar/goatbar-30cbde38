-- Keep the canonical wedding name consistent regardless of its write path.
CREATE OR REPLACE FUNCTION public.normalize_wedding_event_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(btrim(NEW.event_type)) = 'casamento' AND NEW.event_name IS NOT NULL THEN
    NEW.event_name := regexp_replace(NEW.event_name, '\s+e\s+', ' & ', 'gi');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_wedding_event_name_before_write ON public.events;
CREATE TRIGGER normalize_wedding_event_name_before_write
BEFORE INSERT OR UPDATE OF event_name, event_type ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_wedding_event_name();

-- Bring existing canonical wedding names (including the current pipeline and
-- document sources) under the same invariant. Other event types are untouched.
UPDATE public.events
SET event_name = regexp_replace(event_name, '\s+e\s+', ' & ', 'gi')
WHERE lower(btrim(event_type)) = 'casamento'
  AND event_name ~* '\s+e\s+';


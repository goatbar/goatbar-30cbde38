BEGIN;

CREATE OR REPLACE FUNCTION public.log_event_contract_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.contract_history (
    event_contract_id,
    action,
    previous_data,
    new_data,
    created_at
  )
  VALUES (
    NEW.id,
    TG_OP,
    CASE
      WHEN TG_OP = 'INSERT' THEN NULL
      ELSE to_jsonb(OLD)
    END,
    to_jsonb(NEW),
    now()
  );

  RETURN NEW;
END;
$$;

COMMIT;

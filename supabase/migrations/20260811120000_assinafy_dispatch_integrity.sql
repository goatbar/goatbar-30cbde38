BEGIN;

-- contract_history's canonical relationship is event_contract_id -> event_contracts.id.
-- Replace every possible stale trigger function body; no compatibility contract_id column is added.
CREATE OR REPLACE FUNCTION public.log_event_contract_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.contract_history (event_contract_id, action, previous_data, new_data, created_at)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_signature_signers_request_role_key'
  ) THEN
    ALTER TABLE public.contract_signature_signers
      ADD CONSTRAINT contract_signature_signers_request_role_key
      UNIQUE (signature_request_id, role);
  END IF;
END $$;

COMMIT;

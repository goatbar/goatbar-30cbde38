ALTER TABLE public.contract_addendums
  ADD COLUMN IF NOT EXISTS comparison_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS balance_payment_condition text,
  ADD COLUMN IF NOT EXISTS balance_payment_method text,
  ADD COLUMN IF NOT EXISTS balance_due_dates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.contract_addendums ADD CONSTRAINT contract_addendums_balance_condition_check CHECK (balance_payment_condition IS NULL OR balance_payment_condition IN ('À vista', 'Parcelado'));
ALTER TABLE public.contract_addendums ADD CONSTRAINT contract_addendums_balance_method_check CHECK (balance_payment_method IS NULL OR balance_payment_method IN ('PIX', 'Transferência', 'Cartão', 'Boleto'));
CREATE OR REPLACE FUNCTION public.protect_dispatched_addendum_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('sent','signed') AND (to_jsonb(NEW)-ARRAY['status','external_document_id','external_assignment_id','sent_for_signature_at','fully_signed_at','signed_file_url','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','external_document_id','external_assignment_id','sent_for_signature_at','fully_signed_at','signed_file_url','updated_at']) THEN RAISE EXCEPTION 'A dispatched addendum snapshot is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_dispatched_addendum_snapshot ON public.contract_addendums;
CREATE TRIGGER protect_dispatched_addendum_snapshot BEFORE UPDATE ON public.contract_addendums FOR EACH ROW EXECUTE FUNCTION public.protect_dispatched_addendum_snapshot();

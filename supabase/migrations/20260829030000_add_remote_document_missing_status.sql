-- Migration: add remote_document_missing status to contract_signature_requests dispatch_status
-- Old IDs are preserved on the retired (obsolete) row for audit.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_dispatch_status_valid'
  ) THEN
    ALTER TABLE public.contract_signature_requests
      DROP CONSTRAINT chk_dispatch_status_valid;
  END IF;

  ALTER TABLE public.contract_signature_requests
    ADD CONSTRAINT chk_dispatch_status_valid CHECK (
      dispatch_status IN (
        'idle','processing','pending_signature','assignment_created',
        'signed','completed','failed','canceled','canceling',
        'voided','rejected_by_user','reconciliation_required',
        'remote_document_missing','obsolete'
      )
    );

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'contract_signature_requests'
      AND indexname  = 'idx_sig_req_remote_missing'
  ) THEN
    CREATE INDEX idx_sig_req_remote_missing
      ON public.contract_signature_requests (contract_id)
      WHERE dispatch_status = 'remote_document_missing';
  END IF;
END $$;

ALTER TABLE public.contract_signature_requests
  DROP CONSTRAINT IF EXISTS chk_dispatch_status_valid;

ALTER TABLE public.contract_signature_requests
  ADD CONSTRAINT chk_dispatch_status_valid CHECK (
    dispatch_status IN (
      'idle',
      'processing',
      'pending_signature',
      'partially_signed',
      'assignment_created',
      'signed',
      'completed',
      'failed',
      'canceled',
      'canceling',
      'voided',
      'rejected_by_user',
      'reconciliation_required',
      'remote_document_missing',
      'obsolete'
    )
  );

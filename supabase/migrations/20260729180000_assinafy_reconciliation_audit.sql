-- Migration para auditoria de reconciliaçǜes administrativas de assinatura
CREATE TABLE IF NOT EXISTS public.contract_signature_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.contract_signature_requests(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  associated_external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sig_recon_req_id ON public.contract_signature_reconciliations(request_id);

ALTER TABLE public.contract_signature_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manage_sig_recon" ON public.contract_signature_reconciliations;
CREATE POLICY "service_role_manage_sig_recon"
  ON public.contract_signature_reconciliations USING (false);

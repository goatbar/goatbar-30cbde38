-- ============================================================
-- Migração: Ciclo de Vida de Assinatura Eletrônica (ZapSign)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contract_signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  contract_version_id INTEGER DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'zapsign',
  external_request_id TEXT, -- ZapSign doc token
  external_document_id TEXT,
  signer_name TEXT,
  signer_document TEXT,
  signer_email TEXT,
  original_file_path TEXT,
  original_file_hash TEXT,
  signed_file_path TEXT,
  signed_file_hash TEXT,
  signature_url TEXT,
  internal_status TEXT NOT NULL DEFAULT 'draft',
  provider_status TEXT,
  provider_response JSONB,
  callback_payload JSONB,
  evidence_payload JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_sig_req_contract_id ON public.contract_signature_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_event_id ON public.contract_signature_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_external_id ON public.contract_signature_requests(external_request_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_internal_status ON public.contract_signature_requests(internal_status);
CREATE INDEX IF NOT EXISTS idx_sig_req_created_at ON public.contract_signature_requests(created_at);

-- Habilitar RLS
ALTER TABLE public.contract_signature_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "public_select_sig_req" ON public.contract_signature_requests;
CREATE POLICY "public_select_sig_req"
  ON public.contract_signature_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_sig_req" ON public.contract_signature_requests;
CREATE POLICY "auth_insert_sig_req"
  ON public.contract_signature_requests FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_sig_req" ON public.contract_signature_requests;
CREATE POLICY "anon_insert_sig_req"
  ON public.contract_signature_requests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_sig_req" ON public.contract_signature_requests;
CREATE POLICY "auth_update_sig_req"
  ON public.contract_signature_requests FOR UPDATE USING (true) WITH CHECK (true);

-- Garantir coluna external_id em event_contracts para fácil sincronização
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_contracts' AND column_name='external_id') THEN
        ALTER TABLE public.event_contracts ADD COLUMN external_id TEXT;
    END IF;
END $$;

-- Migration corretiva Assinafy - Atendendo aos critrios da auditoria

-- 1. Criaǜo de tabela segura para eventos do webhook com RLS restritiva
CREATE TABLE IF NOT EXISTS public.contract_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id TEXT UNIQUE NOT NULL, -- Determstico ou extrado
  contract_id UUID REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sig_events_external_id ON public.contract_signature_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_sig_events_contract_id ON public.contract_signature_events(contract_id);

ALTER TABLE public.contract_signature_events ENABLE ROW LEVEL SECURITY;

-- Restrito ao backend ou service_role, frontend nǜo l webhooks puros
DROP POLICY IF EXISTS "service_role_manage_sig_events" ON public.contract_signature_events;
CREATE POLICY "service_role_manage_sig_events"
  ON public.contract_signature_events USING (false); -- Somente service role (via bypass) opera

-- 2. Tabela auxiliar de signers para permitir mltiplos signatrios neutros
CREATE TABLE IF NOT EXISTS public.contract_signature_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES public.contract_signature_requests(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  external_signer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sig_signers_req_id ON public.contract_signature_signers(signature_request_id);

ALTER TABLE public.contract_signature_signers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select_sig_signers" ON public.contract_signature_signers;
CREATE POLICY "public_select_sig_signers"
  ON public.contract_signature_signers FOR SELECT USING (true);

-- 3. Renomear/Migrar provider de forma segura e idempotncia de despacho
DO $$
BEGIN
    -- Se signature_provider nǜo existir, cria a partir de provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contract_signature_requests' AND column_name='signature_provider') THEN
        ALTER TABLE public.contract_signature_requests ADD COLUMN signature_provider TEXT;
        UPDATE public.contract_signature_requests SET signature_provider = COALESCE(provider, 'zapsign');
    END IF;

    -- Cria as demais colunas neutras e o estado de despacho
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contract_signature_requests' AND column_name='dispatch_status') THEN
        ALTER TABLE public.contract_signature_requests 
        ADD COLUMN dispatch_status TEXT NOT NULL DEFAULT 'idle',
        ADD COLUMN external_assignment_id TEXT,
        ADD COLUMN last_synced_at TIMESTAMPTZ,
        ADD COLUMN last_error TEXT;
    END IF;

    -- Aplica constraint em signature_provider para garantir limpeza
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_signature_provider_valid'
    ) THEN
        ALTER TABLE public.contract_signature_requests 
        ADD CONSTRAINT chk_signature_provider_valid 
        CHECK (signature_provider IN ('zapsign', 'assinafy'));
    END IF;
END $$;

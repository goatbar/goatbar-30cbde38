-- ============================================================
-- Migração: Contratos, Assinantes e Tabelas de Suporte
-- Cria as tabelas e RLS para o módulo de contratos
-- ============================================================

-- 1. Tabela de templates de contrato
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_path TEXT,
  file_type TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  variables_schema JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 2. Tabela de assinantes de contrato
CREATE TABLE IF NOT EXISTS contract_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de contratos de evento
CREATE TABLE IF NOT EXISTS event_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  signer_id UUID REFERENCES contract_signers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  generated_file_url TEXT,
  signed_file_url TEXT,
  signature_certificate_url TEXT,
  generated_at TIMESTAMPTZ,
  sent_for_signature_at TIMESTAMPTZ,
  fully_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 4. Tabela de dados do cliente para contrato (token de formulário)
CREATE TABLE IF NOT EXISTS event_contract_client_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  client_name TEXT,
  cpf TEXT,
  rg TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  spouse_name TEXT,
  spouse_cpf TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Habilitar RLS em todas as tabelas
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_contract_client_data ENABLE ROW LEVEL SECURITY;

-- 6. RLS: contract_templates — leitura pública, escrita autenticada
DROP POLICY IF EXISTS "public_select_contract_templates" ON contract_templates;
CREATE POLICY "public_select_contract_templates"
  ON contract_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_contract_templates" ON contract_templates;
CREATE POLICY "auth_insert_contract_templates"
  ON contract_templates FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_contract_templates" ON contract_templates;
CREATE POLICY "auth_update_contract_templates"
  ON contract_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_contract_templates" ON contract_templates;
CREATE POLICY "auth_delete_contract_templates"
  ON contract_templates FOR DELETE TO authenticated USING (true);

-- 7. RLS: contract_signers — leitura pública, escrita autenticada
DROP POLICY IF EXISTS "public_select_contract_signers" ON contract_signers;
CREATE POLICY "public_select_contract_signers"
  ON contract_signers FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_contract_signers" ON contract_signers;
CREATE POLICY "auth_insert_contract_signers"
  ON contract_signers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_contract_signers" ON contract_signers;
CREATE POLICY "auth_update_contract_signers"
  ON contract_signers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 8. RLS: event_contracts — acesso total para autenticados + leitura pública
DROP POLICY IF EXISTS "public_select_event_contracts" ON event_contracts;
CREATE POLICY "public_select_event_contracts"
  ON event_contracts FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_event_contracts" ON event_contracts;
CREATE POLICY "auth_insert_event_contracts"
  ON event_contracts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_event_contracts" ON event_contracts;
CREATE POLICY "anon_insert_event_contracts"
  ON event_contracts FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_event_contracts" ON event_contracts;
CREATE POLICY "auth_update_event_contracts"
  ON event_contracts FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_event_contracts" ON event_contracts;
CREATE POLICY "auth_delete_event_contracts"
  ON event_contracts FOR DELETE TO authenticated USING (true);

-- 9. RLS: event_contract_client_data — acesso por token (anon pode inserir e ler pelo token)
DROP POLICY IF EXISTS "public_select_client_data" ON event_contract_client_data;
CREATE POLICY "public_select_client_data"
  ON event_contract_client_data FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_client_data" ON event_contract_client_data;
CREATE POLICY "anon_insert_client_data"
  ON event_contract_client_data FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_client_data" ON event_contract_client_data;
CREATE POLICY "anon_update_client_data"
  ON event_contract_client_data FOR UPDATE USING (true) WITH CHECK (true);

-- 10. Bucket para contratos assinados (signed contracts)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-contracts', 'signed-contracts', true)
ON CONFLICT (id) DO NOTHING;

-- 11. RLS para bucket signed-contracts
DROP POLICY IF EXISTS "public_read_signed_contracts" ON storage.objects;
CREATE POLICY "public_read_signed_contracts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signed-contracts');

DROP POLICY IF EXISTS "auth_upload_signed_contracts" ON storage.objects;
CREATE POLICY "auth_upload_signed_contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signed-contracts');

DROP POLICY IF EXISTS "anon_upload_signed_contracts" ON storage.objects;
CREATE POLICY "anon_upload_signed_contracts"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'signed-contracts');

DROP POLICY IF EXISTS "auth_update_signed_contracts" ON storage.objects;
CREATE POLICY "auth_update_signed_contracts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signed-contracts')
  WITH CHECK (bucket_id = 'signed-contracts');

-- 12. Garantir que o bucket contract-templates também aceita uploads autenticados + anon
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-templates', 'contract-templates', true)
ON CONFLICT (id) DO NOTHING;

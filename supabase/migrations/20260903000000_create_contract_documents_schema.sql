-- Migration: 20260903000000_create_contract_documents_schema.sql
-- Tabela canônica de múltiplos documentos contratuais, anexos e termos aditivos com bucket privado.

BEGIN;

-- 1. Tabela canônica public.contract_documents
CREATE TABLE IF NOT EXISTS public.contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  addendum_id UUID REFERENCES public.contract_addendums(id) ON DELETE CASCADE,
  
  -- Tipo de Documento
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'original_contract',        -- Contrato original gerado pelo sistema
      'signed_contract',          -- Contrato assinado via Assinafy
      'manual_signed_contract',   -- Contrato assinado manualmente / escaneado
      'attachment',               -- Anexo / documento complementar
      'addendum',                 -- Minuta do termo aditivo gerado
      'signed_addendum',          -- Termo aditivo assinado (Assinafy/Manual)
      'other'                     -- Outros documentos
    )
  ),
  document_name TEXT NOT NULL,
  original_filename TEXT,
  
  -- Armazenamento em Storage Privado ou Referência Externa Legada
  storage_bucket TEXT NOT NULL DEFAULT 'contract-documents',
  storage_path TEXT,
  external_url TEXT,
  mime_type TEXT,
  file_size BIGINT,
  
  -- Origem e Rastreamento
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'assinafy', 'manual')),
  external_document_id TEXT,
  external_assignment_id TEXT,
  
  -- Flags de Estado Jurídico e Arquivamento
  is_signed BOOLEAN NOT NULL DEFAULT false,
  is_final BOOLEAN NOT NULL DEFAULT false,
  archive_status TEXT NOT NULL DEFAULT 'archived' CHECK (archive_status IN ('pending', 'archived', 'failed', 'external_only')),
  manual_signature_date TIMESTAMPTZ,
  
  -- Auditoria e Soft Delete
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint 1: Todo documento deve estar vinculado ao contrato ou aditivo (sem documento órfão)
  CONSTRAINT chk_doc_parent_required CHECK (contract_id IS NOT NULL OR addendum_id IS NOT NULL),

  -- Constraint 2: Documento de contrato assinado deve ter contract_id e addendum_id nulo
  CONSTRAINT chk_signed_contract_parent CHECK (
    document_type <> 'signed_contract' OR (contract_id IS NOT NULL AND addendum_id IS NULL)
  ),

  -- Constraint 3: Documento de aditivo assinado deve ter contract_id e addendum_id preenchidos
  CONSTRAINT chk_signed_addendum_parent CHECK (
    document_type <> 'signed_addendum' OR (contract_id IS NOT NULL AND addendum_id IS NOT NULL)
  )
);

-- 2. Índices de Consulta e Idempotência
CREATE INDEX IF NOT EXISTS idx_contract_docs_event ON public.contract_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_contract ON public.contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_addendum ON public.contract_documents(addendum_id);
CREATE INDEX IF NOT EXISTS idx_contract_docs_type ON public.contract_documents(document_type);

-- Índice único parcial de idempotência para PDF final da Assinafy
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_docs_assinafy_final
  ON public.contract_documents (external_document_id)
  WHERE source = 'assinafy' AND is_final = true AND external_document_id IS NOT NULL AND deleted_at IS NULL;

-- 3. Bucket Privado no Storage Supabase
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  26214400, -- 25 MB max
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4. RLS na Tabela contract_documents
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_contract_documents" ON public.contract_documents;
CREATE POLICY "public_select_contract_documents"
  ON public.contract_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_insert_contract_documents" ON public.contract_documents;
CREATE POLICY "auth_insert_contract_documents"
  ON public.contract_documents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_contract_documents" ON public.contract_documents;
CREATE POLICY "anon_insert_contract_documents"
  ON public.contract_documents FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_contract_documents" ON public.contract_documents;
CREATE POLICY "auth_update_contract_documents"
  ON public.contract_documents FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_contract_documents" ON public.contract_documents;
CREATE POLICY "auth_delete_contract_documents"
  ON public.contract_documents FOR DELETE TO authenticated USING (true);

-- 5. RLS para Bucket contract-documents (Privado)
DROP POLICY IF EXISTS "auth_read_contract_documents_storage" ON storage.objects;
CREATE POLICY "auth_read_contract_documents_storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "anon_read_contract_documents_storage" ON storage.objects;
CREATE POLICY "anon_read_contract_documents_storage"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "auth_insert_contract_documents_storage" ON storage.objects;
CREATE POLICY "auth_insert_contract_documents_storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "anon_insert_contract_documents_storage" ON storage.objects;
CREATE POLICY "anon_insert_contract_documents_storage"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'contract-documents');

DROP POLICY IF EXISTS "auth_update_contract_documents_storage" ON storage.objects;
CREATE POLICY "auth_update_contract_documents_storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-documents')
  WITH CHECK (bucket_id = 'contract-documents');

-- 6. Backfill Preservativo para URLs Legadas Existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Backfill de contratos assinados legados
  FOR r IN SELECT id, event_id, signed_file_url, fully_signed_at, created_at FROM public.event_contracts WHERE signed_file_url IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.contract_documents WHERE contract_id = r.id AND document_type = 'signed_contract') THEN
      INSERT INTO public.contract_documents (
        event_id,
        contract_id,
        document_type,
        document_name,
        original_filename,
        storage_bucket,
        storage_path,
        external_url,
        source,
        is_signed,
        is_final,
        archive_status,
        signed_at,
        created_at
      ) VALUES (
        r.event_id,
        r.id,
        'signed_contract',
        'Contrato Assinado (Legado)',
        'contrato_legado.pdf',
        'contract-documents',
        '',
        r.signed_file_url,
        CASE WHEN r.signed_file_url LIKE '%assinafy%' THEN 'assinafy' ELSE 'manual' END,
        true,
        true,
        'external_only',
        COALESCE(r.fully_signed_at, r.created_at),
        COALESCE(r.created_at, now())
      );
    END IF;
  END LOOP;

  -- Backfill de aditivos assinados legados
  FOR r IN SELECT id, event_id, contract_id, addendum_number, signed_file_url, fully_signed_at, created_at FROM public.contract_addendums WHERE signed_file_url IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.contract_documents WHERE addendum_id = r.id AND document_type = 'signed_addendum') THEN
      INSERT INTO public.contract_documents (
        event_id,
        contract_id,
        addendum_id,
        document_type,
        document_name,
        original_filename,
        storage_bucket,
        storage_path,
        external_url,
        source,
        is_signed,
        is_final,
        archive_status,
        signed_at,
        created_at
      ) VALUES (
        r.event_id,
        r.contract_id,
        r.id,
        'signed_addendum',
        'Termo Aditivo nº ' || r.addendum_number || ' Assinado (Legado)',
        'aditivo_' || r.addendum_number || '_legado.pdf',
        'contract-documents',
        '',
        r.signed_file_url,
        CASE WHEN r.signed_file_url LIKE '%assinafy%' THEN 'assinafy' ELSE 'manual' END,
        true,
        true,
        'external_only',
        COALESCE(r.fully_signed_at, r.created_at),
        COALESCE(r.created_at, now())
      );
    END IF;
  END LOOP;
END $$;

-- 7. Atualização do RPC do webhook Assinafy para registrar o documento pendente de arquivamento
CREATE OR REPLACE FUNCTION public.process_assinafy_webhook_event(
  p_external_event_id TEXT,
  p_event_type TEXT,
  p_external_document_id TEXT,
  p_payload JSONB,
  p_request_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_signer_id TEXT;
  v_norm_type TEXT;
  v_addendum RECORD;
BEGIN
  BEGIN
    INSERT INTO public.contract_signature_events (
      external_event_id,
      contract_id,
      event_type,
      payload,
      status
    ) VALUES (
      p_external_event_id,
      NULL,
      p_event_type,
      p_payload,
      'processing'
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('duplicate', true, 'processed', false, 'reason', 'duplicate');
  END;

  IF p_external_document_id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'document_not_found');
  END IF;

  SELECT id, contract_id, event_id, dispatch_status, internal_status
  INTO v_req
  FROM public.contract_signature_requests
  WHERE external_document_id = p_external_document_id
  LIMIT 1;

  IF v_req.id IS NULL THEN
    UPDATE public.contract_signature_events
    SET status = 'unprocessed_document_not_found'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'document_not_found');
  END IF;

  UPDATE public.contract_signature_events
  SET contract_id = v_req.contract_id
  WHERE external_event_id = p_external_event_id;

  v_norm_type := lower(p_event_type);

  IF v_norm_type = 'signer_signed_document' THEN
    v_signer_id := COALESCE(
      p_payload->'subject'->>'id',
      p_payload->'object'->'signer'->>'id',
      p_payload->'payload'->>'signer_id'
    );
    IF v_signer_id IS NOT NULL THEN
      UPDATE public.contract_signature_signers
      SET status = 'signed', signed_at = now(), updated_at = now()
      WHERE signature_request_id = v_req.id AND external_signer_id = v_signer_id;
    END IF;

    IF v_req.dispatch_status = 'pending_signature' THEN
      UPDATE public.contract_signature_requests
      SET dispatch_status = 'partially_signed', updated_at = now()
      WHERE id = v_req.id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  IF v_req.dispatch_status IN ('completed', 'signed') THEN
    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', 'already_final');
  END IF;

  -- 2. Conclusão global integral (document_completed / completed)
  IF v_norm_type IN ('document_completed', 'completed') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'completed', internal_status = 'signed', completed_at = now(), updated_at = now()
    WHERE id = v_req.id;

    IF v_req.contract_id IS NOT NULL THEN
      UPDATE public.event_contracts
      SET status = 'signed', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    -- Atualização atômica do Termo Aditivo vinculado (se for um aditivo)
    SELECT id, addendum_number
    INTO v_addendum
    FROM public.contract_addendums
    WHERE external_document_id = p_external_document_id
    LIMIT 1;

    IF v_addendum.id IS NOT NULL THEN
      UPDATE public.contract_addendums
      SET status = 'signed', fully_signed_at = now(), updated_at = now()
      WHERE id = v_addendum.id;
    END IF;

    -- Registra o documento em contract_documents para rastreamento de arquivamento (idempotente)
    IF NOT EXISTS (
      SELECT 1 FROM public.contract_documents
      WHERE external_document_id = p_external_document_id AND deleted_at IS NULL
    ) THEN
      INSERT INTO public.contract_documents (
        event_id,
        contract_id,
        addendum_id,
        document_type,
        document_name,
        original_filename,
        storage_bucket,
        storage_path,
        source,
        external_document_id,
        is_signed,
        is_final,
        archive_status,
        signed_at
      ) VALUES (
        v_req.event_id,
        v_req.contract_id,
        v_addendum.id,
        CASE WHEN v_addendum.id IS NOT NULL THEN 'signed_addendum' ELSE 'signed_contract' END,
        CASE WHEN v_addendum.id IS NOT NULL THEN 'Termo Aditivo nº ' || v_addendum.addendum_number || ' Assinado (Assinafy)' ELSE 'Contrato Assinado (Assinafy)' END,
        'contrato_assinado_assinafy.pdf',
        'contract-documents',
        '',
        'assinafy',
        p_external_document_id,
        true,
        true,
        'pending',
        now()
      );
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- 3. Rejeição por signatário
  IF v_norm_type IN ('signer_rejected_document') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'failed', internal_status = 'pending_signature', updated_at = now()
    WHERE id = v_req.id;

    IF v_req.contract_id IS NOT NULL THEN
      UPDATE public.event_contracts
      SET status = 'signature_rejected', updated_at = now()
      WHERE id = v_req.contract_id;
    END IF;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  -- 4. Cancelamento de documento
  IF v_norm_type IN ('user_rejected_document', 'document.canceled', 'canceled') THEN
    UPDATE public.contract_signature_requests
    SET dispatch_status = 'canceled', internal_status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = v_req.id;

    UPDATE public.contract_addendums
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE external_document_id = p_external_document_id;

    UPDATE public.contract_signature_events
    SET status = 'processed'
    WHERE external_event_id = p_external_event_id;

    RETURN jsonb_build_object('duplicate', false, 'processed', true, 'reason', NULL);
  END IF;

  UPDATE public.contract_signature_events
  SET status = 'unsupported'
  WHERE external_event_id = p_external_event_id;

  RETURN jsonb_build_object('duplicate', false, 'processed', false, 'reason', 'unsupported_event');
END;
$$;

COMMIT;

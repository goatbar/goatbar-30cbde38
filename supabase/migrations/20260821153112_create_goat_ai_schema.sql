-- ------------------------------------------------------------
-- Migration: Goat AI Core Architecture
-- Tables: ai_inbox_items, ai_action_logs, ai_inbox_attachments
-- Storage: private bucket ai-inbox-media
-- Transactional RPC: approve_goat_ai_inbox_item
-- ------------------------------------------------------------

-- 1. Helper function for updated_at
CREATE OR REPLACE FUNCTION public.set_ai_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Main Inbox Items Table
CREATE TABLE IF NOT EXISTS public.ai_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('whatsapp', 'manual', 'api')),
  source_message_id text,
  source_conversation_id text,
  source_sender_id text,
  source_sender_name text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document', 'other')),
  raw_text text,
  transcribed_text text,
  classification text NOT NULL DEFAULT 'unknown' CHECK (classification IN (
    'sales_session',
    'operation_report',
    'event_purchase',
    'invoice',
    'receipt',
    'stock_movement',
    'expense',
    'event_note',
    'general_note',
    'unknown'
  )),
  classification_confidence numeric(5,4) NOT NULL DEFAULT 0,
  extraction_confidence numeric(5,4) NOT NULL DEFAULT 0,
  event_match_confidence numeric(5,4) NOT NULL DEFAULT 0,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN (
    'received',
    'processing',
    'processed',
    'needs_review',
    'failed'
  )),
  processing_mode text NOT NULL DEFAULT 'unavailable' CHECK (processing_mode IN (
    'gemini',
    'heuristic',
    'unavailable'
  )),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN (
    'pending',
    'approved',
    'rejected',
    'not_required'
  )),
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  matched_location_id text,
  matched_supplier_id text,
  applied_entity_type text,
  applied_entity_id uuid,
  applied_at timestamptz,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index for idempotent webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS ai_inbox_items_source_msg_uidx
  ON public.ai_inbox_items (source, source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_inbox_items_status_idx
  ON public.ai_inbox_items (processing_status, approval_status);

CREATE INDEX IF NOT EXISTS ai_inbox_items_classification_idx
  ON public.ai_inbox_items (classification);

CREATE INDEX IF NOT EXISTS ai_inbox_items_matched_event_idx
  ON public.ai_inbox_items (matched_event_id);

CREATE INDEX IF NOT EXISTS ai_inbox_items_created_at_idx
  ON public.ai_inbox_items (created_at DESC);

CREATE TRIGGER set_ai_inbox_items_updated_at
  BEFORE UPDATE ON public.ai_inbox_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_ai_updated_at();

-- 3. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_inbox_item_id uuid REFERENCES public.ai_inbox_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_name text,
  automatic boolean NOT NULL DEFAULT false,
  previous_data jsonb,
  new_data jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_action_logs_item_idx
  ON public.ai_action_logs (ai_inbox_item_id);

CREATE INDEX IF NOT EXISTS ai_action_logs_event_idx
  ON public.ai_action_logs (event_id);

CREATE INDEX IF NOT EXISTS ai_action_logs_created_at_idx
  ON public.ai_action_logs (created_at DESC);

-- 4. Attachments Table
CREATE TABLE IF NOT EXISTS public.ai_inbox_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_inbox_item_id uuid NOT NULL REFERENCES public.ai_inbox_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  attachment_type text NOT NULL CHECK (attachment_type IN ('image', 'audio', 'pdf', 'document', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_inbox_attachments_item_idx
  ON public.ai_inbox_attachments (ai_inbox_item_id);

-- 5. Storage Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-inbox-media',
  'ai-inbox-media',
  false,
  26214400, -- 25MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- 6. Enable RLS on all AI tables and storage
ALTER TABLE public.ai_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inbox_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for ai_inbox_items
DROP POLICY IF EXISTS "auth_select_ai_inbox_items" ON public.ai_inbox_items;
CREATE POLICY "auth_select_ai_inbox_items"
  ON public.ai_inbox_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_ai_inbox_items" ON public.ai_inbox_items;
CREATE POLICY "auth_insert_ai_inbox_items"
  ON public.ai_inbox_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_ai_inbox_items" ON public.ai_inbox_items;
CREATE POLICY "auth_update_ai_inbox_items"
  ON public.ai_inbox_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for ai_action_logs
DROP POLICY IF EXISTS "auth_select_ai_action_logs" ON public.ai_action_logs;
CREATE POLICY "auth_select_ai_action_logs"
  ON public.ai_action_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_ai_action_logs" ON public.ai_action_logs;
CREATE POLICY "auth_insert_ai_action_logs"
  ON public.ai_action_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for ai_inbox_attachments
DROP POLICY IF EXISTS "auth_select_ai_inbox_attachments" ON public.ai_inbox_attachments;
CREATE POLICY "auth_select_ai_inbox_attachments"
  ON public.ai_inbox_attachments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_ai_inbox_attachments" ON public.ai_inbox_attachments;
CREATE POLICY "auth_insert_ai_inbox_attachments"
  ON public.ai_inbox_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Storage policies for private ai-inbox-media
DROP POLICY IF EXISTS "storage_ai_inbox_media_select" ON storage.objects;
CREATE POLICY "storage_ai_inbox_media_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ai-inbox-media');

DROP POLICY IF EXISTS "storage_ai_inbox_media_insert" ON storage.objects;
CREATE POLICY "storage_ai_inbox_media_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ai-inbox-media');

DROP POLICY IF EXISTS "storage_ai_inbox_media_update" ON storage.objects;
CREATE POLICY "storage_ai_inbox_media_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ai-inbox-media');

DROP POLICY IF EXISTS "storage_ai_inbox_media_delete" ON storage.objects;
CREATE POLICY "storage_ai_inbox_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ai-inbox-media');


-- 7. Transactional Atomic Approval RPC
CREATE OR REPLACE FUNCTION public.approve_goat_ai_inbox_item(
  p_item_id uuid,
  p_override_data jsonb DEFAULT NULL,
  p_event_id uuid DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL,
  p_performer_name text DEFAULT 'Sistema'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_data jsonb;
  v_target_event_id uuid;
  v_created_id uuid;
  v_expense_id uuid;
  v_session_id uuid;
  v_item_elem jsonb;
  v_modality text;
  v_category text;
  v_payment_method text;
  v_supplier text;
  v_total numeric;
  v_date date;
  v_desc text;
BEGIN
  -- 1. Lock and fetch inbox item
  SELECT * INTO v_item
  FROM public.ai_inbox_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da caixa de entrada não encontrado: %', p_item_id;
  END IF;

  -- 2. Idempotency Check: already approved and applied
  IF v_item.approval_status = 'approved' AND v_item.applied_entity_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_applied', true,
      'item_id', v_item.id,
      'applied_entity_type', v_item.applied_entity_type,
      'applied_entity_id', v_item.applied_entity_id,
      'applied_at', v_item.applied_at
    );
  END IF;

  -- 3. Prepare data and target event
  v_data := COALESCE(p_override_data, v_item.structured_data, '{}'::jsonb);
  v_target_event_id := COALESCE(p_event_id, v_item.matched_event_id);

  -- 4. Branch by classification
  IF v_item.classification IN ('event_purchase', 'invoice', 'receipt', 'expense') THEN
    v_total := COALESCE((v_data->>'total')::numeric, (v_data->>'total_value')::numeric, (v_data->>'amount')::numeric, 0);
    v_supplier := COALESCE(v_data->>'supplier', v_data->>'supplier_name', 'Fornecedor Diversos');
    v_date := COALESCE(NULLIF(v_data->>'purchase_date', '')::date, NULLIF(v_data->>'issue_date', '')::date, NULLIF(v_data->>'date', '')::date, CURRENT_DATE);
    v_modality := CASE WHEN v_target_event_id IS NOT NULL THEN 'Evento' ELSE 'Geral' END;
    v_category := COALESCE(v_data->>'category', 'Insumos');
    IF v_category NOT IN ('Fornecedor', 'Equipe', 'Insumos', 'Operacional', 'Outros') THEN
      v_category := 'Insumos';
    END IF;
    v_payment_method := COALESCE(v_data->>'payment_method', 'PIX');
    IF v_payment_method NOT IN ('PIX', 'Dinheiro', 'Cartao', 'Cartão', 'Transferencia', 'Transferência', 'Outros') THEN
      v_payment_method := 'PIX';
    END IF;
    IF v_payment_method = 'Cartão' THEN v_payment_method := 'Cartao'; END IF;
    IF v_payment_method = 'Transferência' THEN v_payment_method := 'Transferencia'; END IF;

    v_desc := COALESCE(v_data->>'description', v_data->>'notes', 'Compra via Goat AI - ' || v_supplier);

    -- Insert expense
    INSERT INTO public.financial_expenses (
      event_id,
      date,
      modality,
      category,
      description,
      amount,
      responsible,
      payment_method,
      status,
      classification,
      supplier_name,
      ocr_raw_text
    ) VALUES (
      v_target_event_id,
      v_date,
      v_modality,
      v_category,
      v_desc,
      v_total,
      COALESCE(p_performer_name, v_item.source_sender_name, 'Goat AI'),
      v_payment_method,
      'Pago',
      'Direto',
      v_supplier,
      v_item.raw_text
    )
    RETURNING id INTO v_expense_id;

    v_created_id := v_expense_id;

    -- Insert expense items if present
    IF jsonb_typeof(v_data->'items') = 'array' THEN
      FOR v_item_elem IN SELECT * FROM jsonb_array_elements(v_data->'items')
      LOOP
        INSERT INTO public.financial_expense_items (
          expense_id,
          product_name,
          quantity,
          unit,
          unit_price,
          total_price,
          suggested_category,
          reviewed
        ) VALUES (
          v_expense_id,
          COALESCE(v_item_elem->>'name', v_item_elem->>'description', v_item_elem->>'product_name', 'Item sem nome'),
          COALESCE((v_item_elem->>'quantity')::numeric, 1),
          COALESCE(v_item_elem->>'unit', 'un'),
          COALESCE((v_item_elem->>'unit_price')::numeric, 0),
          COALESCE((v_item_elem->>'total_price')::numeric, ((v_item_elem->>'quantity')::numeric * (v_item_elem->>'unit_price')::numeric), 0),
          COALESCE(v_item_elem->>'suggested_category', v_category),
          true
        );
      END LOOP;
    END IF;

    -- Update inbox item
    UPDATE public.ai_inbox_items
    SET
      approval_status = 'approved',
      processing_status = 'processed',
      applied_entity_type = 'financial_expenses',
      applied_entity_id = v_created_id,
      applied_at = now(),
      approved_by = p_performed_by,
      approved_at = now(),
      matched_event_id = v_target_event_id,
      structured_data = v_data
    WHERE id = p_item_id;

  ELSIF v_item.classification IN ('sales_session', 'operation_report') THEN
    v_date := COALESCE(NULLIF(v_data->>'date', '')::date, CURRENT_DATE);
    v_modality := CASE
      WHEN lower(COALESCE(v_data->>'location', '')) LIKE '%steak%' THEN '7Steakhouse'
      ELSE 'Goat Botequim'
    END;

    INSERT INTO public.financial_sessions (
      date,
      modality,
      labor_value,
      labor_quantity,
      labor_names
    ) VALUES (
      v_date,
      v_modality,
      COALESCE((v_data->>'labor_value')::numeric, 0),
      COALESCE((v_data->>'labor_quantity')::integer, 0),
      COALESCE(v_data->>'labor_names', '')
    )
    RETURNING id INTO v_session_id;

    v_created_id := v_session_id;

    IF jsonb_typeof(v_data->'sales') = 'array' THEN
      FOR v_item_elem IN SELECT * FROM jsonb_array_elements(v_data->'sales')
      LOOP
        INSERT INTO public.financial_session_items (
          session_id,
          drink_name,
          quantity,
          unit_price,
          unit_cost
        ) VALUES (
          v_session_id,
          COALESCE(v_item_elem->>'product', v_item_elem->>'drink_name', 'Drink'),
          COALESCE((v_item_elem->>'quantity')::integer, 1),
          COALESCE((v_item_elem->>'unit_price')::numeric, 0),
          COALESCE((v_item_elem->>'unit_cost')::numeric, 0)
        );
      END LOOP;
    END IF;

    UPDATE public.ai_inbox_items
    SET
      approval_status = 'approved',
      processing_status = 'processed',
      applied_entity_type = 'financial_sessions',
      applied_entity_id = v_created_id,
      applied_at = now(),
      approved_by = p_performed_by,
      approved_at = now(),
      matched_event_id = v_target_event_id,
      structured_data = v_data
    WHERE id = p_item_id;

  ELSE
    -- Generic notes / unclassified
    UPDATE public.ai_inbox_items
    SET
      approval_status = 'approved',
      processing_status = 'processed',
      applied_entity_type = 'note',
      applied_entity_id = v_item.id,
      applied_at = now(),
      approved_by = p_performed_by,
      approved_at = now(),
      matched_event_id = v_target_event_id,
      structured_data = v_data
    WHERE id = p_item_id;

    v_created_id := v_item.id;
  END IF;

  -- 5. Write strict audit log
  INSERT INTO public.ai_action_logs (
    ai_inbox_item_id,
    action,
    event_id,
    performed_by,
    performer_name,
    automatic,
    previous_data,
    new_data
  ) VALUES (
    v_item.id,
    'approve_' || v_item.classification,
    v_target_event_id,
    p_performed_by,
    p_performer_name,
    false,
    v_item.structured_data,
    jsonb_build_object(
      'applied_entity_type', CASE
        WHEN v_item.classification IN ('event_purchase', 'invoice', 'receipt', 'expense') THEN 'financial_expenses'
        WHEN v_item.classification IN ('sales_session', 'operation_report') THEN 'financial_sessions'
        ELSE 'note'
      END,
      'applied_entity_id', v_created_id,
      'data', v_data
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_applied', false,
    'item_id', v_item.id,
    'applied_entity_type', CASE
      WHEN v_item.classification IN ('event_purchase', 'invoice', 'receipt', 'expense') THEN 'financial_expenses'
      WHEN v_item.classification IN ('sales_session', 'operation_report') THEN 'financial_sessions'
      ELSE 'note'
    END,
    'applied_entity_id', v_created_id,
    'applied_at', now()
  );
END;
$$;

-- Restrict function execution permissions
REVOKE EXECUTE ON FUNCTION public.approve_goat_ai_inbox_item(uuid, jsonb, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_goat_ai_inbox_item(uuid, jsonb, uuid, uuid, text) TO authenticated, service_role;


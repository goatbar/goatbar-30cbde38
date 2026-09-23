BEGIN;

-- 1. Snapshot jurídico imutável do contrato original e valor pago canônico do evento.
ALTER TABLE public.event_contracts
  ADD COLUMN IF NOT EXISTS legal_snapshot JSONB;

COMMENT ON COLUMN public.event_contracts.legal_snapshot IS
  'Snapshot das partes e condições utilizadas na emissão do contrato original. Deve ser capturado uma única vez antes do primeiro envio para assinatura.';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS paid_amount_received NUMERIC;

COMMENT ON COLUMN public.events.paid_amount_received IS
  'Valor monetário efetivamente recebido do cliente. Não deve ser recalculado automaticamente quando o valor total do orçamento muda.';

UPDATE public.events e
SET paid_amount_received = b.paid_value
FROM public.event_budget_versions b
WHERE b.event_id = e.id
  AND b.is_current = true
  AND e.paid_amount_received IS NULL
  AND b.paid_value IS NOT NULL;

UPDATE public.events
SET paid_amount_received = ROUND(
  COALESCE(current_budget_value, 0)::numeric
  * COALESCE(payment_percent_received, 0)::numeric
  / 100,
  2
)
WHERE paid_amount_received IS NULL;

-- 2. Rastreia qual modelo gerou cada aditivo.
ALTER TABLE public.contract_addendums
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL;

-- 3. Separa, na Assinafy, o contrato original de cada aditivo.
ALTER TABLE public.contract_signature_requests
  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'contract',
  ADD COLUMN IF NOT EXISTS addendum_id UUID REFERENCES public.contract_addendums(id) ON DELETE CASCADE;

UPDATE public.contract_signature_requests
SET document_kind = 'contract'
WHERE document_kind IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_signature_request_document_scope'
  ) THEN
    ALTER TABLE public.contract_signature_requests
      ADD CONSTRAINT chk_signature_request_document_scope
      CHECK (
        (document_kind = 'contract' AND addendum_id IS NULL)
        OR
        (document_kind = 'addendum' AND addendum_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sig_req_document_scope
  ON public.contract_signature_requests (
    contract_id,
    signature_provider,
    document_kind,
    addendum_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_sig_req_addendum_id
  ON public.contract_signature_requests(addendum_id)
  WHERE addendum_id IS NOT NULL;

-- 4. Modelo oficial do Termo Aditivo fornecido pela GOAT Bar.
-- O conteúdo fica no mesmo editor visual de modelos já usado pelos contratos.
INSERT INTO public.contract_templates (
  name,
  description,
  file_type,
  is_default,
  variables_schema,
  status,
  created_at,
  updated_at
)
SELECT
  'Modelo Aditivo Contratual GOAT Bar',
  $html$
<h1 style="text-align:center"><strong>TERMO ADITIVO AO CONTRATO</strong></h1>
<p><strong>CONTRATANTE:</strong><br>
Nome: {{cliente.nome}}<br>
CPF/CNPJ: {{cliente.documento}}</p>
<p><strong>CONTRATADA:</strong><br>
Nome: {{empresa.nome}}<br>
CPF/CNPJ: {{empresa.cnpj}}</p>
<p>As partes acima identificadas celebram o presente Termo Aditivo ao Contrato de Prestação de Serviços de Bar para Eventos firmado em {{contrato.data_assinatura_original}}, mediante as condições abaixo.</p>

<h2>CLÁUSULA 1 – DOS DRINKS SERVIDOS</h2>
<p>1.1. A Cláusula 10.1 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“10.1. Os drinks e bebidas que serão servidos no evento são:<br>
{{aditivo.drinks_atuais}}</p>

<h2>CLÁUSULA 2 – DO VALOR E DA FORMA DE PAGAMENTO</h2>
<p>2.1. A Cláusula 6.1 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“6.1. O valor total dos serviços é de {{aditivo.valor_total_novo}}<br>
({{aditivo.valor_total_novo_extenso}}).</p>
<p>2.2. Do valor total indicado acima, as partes reconhecem que:<br>
a) Valor já pago pelo CONTRATANTE: {{aditivo.valor_ja_pago}}.<br>
b) Saldo restante: {{aditivo.novo_saldo_restante}}.<br>
c) Forma de pagamento do saldo: {{aditivo.forma_pagamento_saldo}} via {{aditivo.meio_pagamento_saldo}}<br>
d) Data(s) de vencimento: {{aditivo.datas_vencimento}}.”</p>

<h2>CLÁUSULA 3 – DO VALOR POR PESSOA</h2>
<p>3.1. A Cláusula 12.2 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“12.2. O valor por pessoa/convidado excedente será de {{aditivo.valor_convidado_excedente}}<br>
({{aditivo.valor_convidado_excedente_extenso}}).”</p>

<h2>CLÁUSULA 4 – DA RATIFICAÇÃO</h2>
<p>4.1. Permanecem inalteradas e válidas todas as demais cláusulas e condições do Contrato Original que não tenham sido expressamente modificadas por este Termo Aditivo.</p>
<p>4.2. Este Termo Aditivo passa a integrar o Contrato Original para todos os fins.</p>
<p>E, por estarem de acordo, as partes assinam o presente instrumento em duas vias de igual teor e forma.</p>

<p>Sete Lagoas, {{aditivo.data_extenso}}.</p>

<p>_______________________________________<br>
CONTRATANTE - {{cliente.nome}}</p>

<p>_______________________________________<br>
CONTRATADA - {{empresa.nome}}</p>
$html$,
  'DOCX',
  false,
  jsonb_build_object(
    'content', $html$
<h1 style="text-align:center"><strong>TERMO ADITIVO AO CONTRATO</strong></h1>
<p><strong>CONTRATANTE:</strong><br>
Nome: {{cliente.nome}}<br>
CPF/CNPJ: {{cliente.documento}}</p>
<p><strong>CONTRATADA:</strong><br>
Nome: {{empresa.nome}}<br>
CPF/CNPJ: {{empresa.cnpj}}</p>
<p>As partes acima identificadas celebram o presente Termo Aditivo ao Contrato de Prestação de Serviços de Bar para Eventos firmado em {{contrato.data_assinatura_original}}, mediante as condições abaixo.</p>
<h2>CLÁUSULA 1 – DOS DRINKS SERVIDOS</h2>
<p>1.1. A Cláusula 10.1 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“10.1. Os drinks e bebidas que serão servidos no evento são:<br>{{aditivo.drinks_atuais}}</p>
<h2>CLÁUSULA 2 – DO VALOR E DA FORMA DE PAGAMENTO</h2>
<p>2.1. A Cláusula 6.1 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“6.1. O valor total dos serviços é de {{aditivo.valor_total_novo}}<br>({{aditivo.valor_total_novo_extenso}}).</p>
<p>2.2. Do valor total indicado acima, as partes reconhecem que:<br>
a) Valor já pago pelo CONTRATANTE: {{aditivo.valor_ja_pago}}.<br>
b) Saldo restante: {{aditivo.novo_saldo_restante}}.<br>
c) Forma de pagamento do saldo: {{aditivo.forma_pagamento_saldo}} via {{aditivo.meio_pagamento_saldo}}<br>
d) Data(s) de vencimento: {{aditivo.datas_vencimento}}.”</p>
<h2>CLÁUSULA 3 – DO VALOR POR PESSOA</h2>
<p>3.1. A Cláusula 12.2 do Contrato Original passa a vigorar com a seguinte redação:</p>
<p>“12.2. O valor por pessoa/convidado excedente será de {{aditivo.valor_convidado_excedente}}<br>({{aditivo.valor_convidado_excedente_extenso}}).”</p>
<h2>CLÁUSULA 4 – DA RATIFICAÇÃO</h2>
<p>4.1. Permanecem inalteradas e válidas todas as demais cláusulas e condições do Contrato Original que não tenham sido expressamente modificadas por este Termo Aditivo.</p>
<p>4.2. Este Termo Aditivo passa a integrar o Contrato Original para todos os fins.</p>
<p>E, por estarem de acordo, as partes assinam o presente instrumento em duas vias de igual teor e forma.</p>
<p>Sete Lagoas, {{aditivo.data_extenso}}.</p>
<p>_______________________________________<br>CONTRATANTE - {{cliente.nome}}</p>
<p>_______________________________________<br>CONTRATADA - {{empresa.nome}}</p>
$html$,
    'template_kind', 'addendum',
    'model_key', 'goatbar-official-addendum-v1',
    'is_default_for_kind', true
  ),
  'active',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contract_templates
  WHERE variables_schema->>'model_key' = 'goatbar-official-addendum-v1'
);

COMMIT;

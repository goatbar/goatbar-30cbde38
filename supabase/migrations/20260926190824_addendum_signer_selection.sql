BEGIN;

ALTER TABLE public.contract_addendums
  ADD COLUMN IF NOT EXISTS signer_id UUID REFERENCES public.contract_signers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_contract_addendums_signer_id
  ON public.contract_addendums(signer_id)
  WHERE signer_id IS NOT NULL;

-- Backfill seguro para aditivos antigos: preserva o mesmo sócio do contrato original.
UPDATE public.contract_addendums a
SET signer_id = c.signer_id
FROM public.event_contracts c
WHERE a.contract_id = c.id
  AND a.signer_id IS NULL
  AND c.signer_id IS NOT NULL;

COMMENT ON COLUMN public.contract_addendums.signer_id IS
  'Sócio da GOAT Bar escolhido especificamente para assinar este Termo Aditivo.';

-- O aditivo deve identificar a CONTRATADA pela mesma lógica do contrato principal:
-- dados do sócio selecionado em contract_signers, nunca dados empresariais fictícios.
WITH official AS (
  SELECT id
  FROM public.contract_templates
  WHERE variables_schema->>'model_key' = 'goatbar-official-addendum-v1'
)
UPDATE public.contract_templates ct
SET
  description = replace(
    replace(
      replace(
        replace(
          ct.description,
          'Nome: {{empresa.nome}}<br>',
          'Nome: {{empresa.responsavel}}<br>'
        ),
        'CPF/CNPJ: {{empresa.cnpj}}</p>',
        'CPF: {{empresa.cpf_responsavel}}<br>Endereço: {{empresa.endereco_responsavel}}</p>'
      ),
      'CONTRATADA - {{empresa.nome}}',
      'CONTRATADA - {{empresa.responsavel}}'
    ),
    'CPF/CNPJ: {{empresa.cnpj}}',
    'CPF: {{empresa.cpf_responsavel}}'
  ),
  variables_schema = jsonb_set(
    ct.variables_schema,
    '{content}',
    to_jsonb(
      replace(
        replace(
          replace(
            replace(
              ct.variables_schema->>'content',
              'Nome: {{empresa.nome}}<br>',
              'Nome: {{empresa.responsavel}}<br>'
            ),
            'CPF/CNPJ: {{empresa.cnpj}}</p>',
            'CPF: {{empresa.cpf_responsavel}}<br>Endereço: {{empresa.endereco_responsavel}}</p>'
          ),
          'CONTRATADA - {{empresa.nome}}',
          'CONTRATADA - {{empresa.responsavel}}'
        ),
        'CPF/CNPJ: {{empresa.cnpj}}',
        'CPF: {{empresa.cpf_responsavel}}'
      )
    ),
    true
  ),
  updated_at = now()
FROM official
WHERE ct.id = official.id;

COMMIT;

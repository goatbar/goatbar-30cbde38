BEGIN;

WITH official AS (
  SELECT id
  FROM public.contract_templates
  WHERE variables_schema->>'model_key' = 'goatbar-official-addendum-v1'
)
UPDATE public.contract_templates ct
SET
  description = replace(
    ct.description,
    '<p>_______________________________________<br>',
    '<p class="contract-signature-line">_______________________________________<br>'
  ),
  variables_schema = jsonb_set(
    ct.variables_schema,
    '{content}',
    to_jsonb(
      replace(
        ct.variables_schema->>'content',
        '<p>_______________________________________<br>',
        '<p class="contract-signature-line">_______________________________________<br>'
      )
    ),
    true
  ),
  updated_at = now()
FROM official
WHERE ct.id = official.id;

COMMIT;

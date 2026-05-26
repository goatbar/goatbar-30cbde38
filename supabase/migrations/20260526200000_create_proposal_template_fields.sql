-- ============================================================
-- Tabela: proposal_template_fields
-- Armazena o mapeamento visual de campos dinâmicos em cada
-- modelo de proposta comercial.
-- Coordenadas x, y, width, height são relativas (0.0 a 1.0)
-- à dimensão da página do PDF.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_template_fields (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid        NOT NULL REFERENCES public.proposal_templates(id) ON DELETE CASCADE,
  page_number   integer     NOT NULL DEFAULT 0,
  field_key     text        NOT NULL,
  field_label   text        NOT NULL,
  field_type    text        NOT NULL DEFAULT 'texto_simples',

  -- Posição e tamanho relativos à página (0.0–1.0)
  x             numeric     NOT NULL DEFAULT 0.1,
  y             numeric     NOT NULL DEFAULT 0.1,
  width         numeric     NOT NULL DEFAULT 0.3,
  height        numeric     NOT NULL DEFAULT 0.05,

  -- Tipografia
  font_family   text        NOT NULL DEFAULT 'Neue Montreal',
  font_size     integer     NOT NULL DEFAULT 16,
  font_color    text        NOT NULL DEFAULT '#f7f4ef',
  font_weight   text        NOT NULL DEFAULT 'normal',
  text_align    text        NOT NULL DEFAULT 'left',
  line_height   numeric     NOT NULL DEFAULT 1.4,
  letter_spacing numeric    NOT NULL DEFAULT 0,
  z_index       integer     NOT NULL DEFAULT 1,

  -- Configurações especiais (texto em arco, bullets, etc.)
  config        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Índice para buscar campos de um template rapidamente
CREATE INDEX IF NOT EXISTS idx_ptf_template_id
  ON public.proposal_template_fields(template_id, page_number);

-- RLS permissiva (mesmo padrão do restante do projeto)
ALTER TABLE public.proposal_template_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public full access proposal_template_fields"
  ON public.proposal_template_fields;

CREATE POLICY "public full access proposal_template_fields"
  ON public.proposal_template_fields
  FOR ALL USING (true) WITH CHECK (true);

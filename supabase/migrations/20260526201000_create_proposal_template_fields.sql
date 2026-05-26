CREATE TABLE IF NOT EXISTS public.proposal_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.proposal_templates(id) ON DELETE CASCADE,
  technical_name text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  page integer NOT NULL DEFAULT 0,
  position_x numeric NOT NULL,
  position_y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  font_family text NOT NULL DEFAULT 'Helvetica',
  font_size numeric NOT NULL DEFAULT 24,
  color_hex text NOT NULL DEFAULT '#FFFFFF',
  alignment text NOT NULL DEFAULT 'left',
  font_weight text NOT NULL DEFAULT 'normal',
  line_height numeric NOT NULL DEFAULT 1.2,
  auto_resize boolean NOT NULL DEFAULT true,
  overflow_control text NOT NULL DEFAULT 'wrap',
  arc_angle numeric,
  arc_radius numeric,
  image_fit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_template_fields_template ON public.proposal_template_fields(template_id);
ALTER TABLE public.proposal_template_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public full access proposal_template_fields" ON public.proposal_template_fields;
CREATE POLICY "public full access proposal_template_fields"
  ON public.proposal_template_fields FOR ALL USING (true) WITH CHECK (true);

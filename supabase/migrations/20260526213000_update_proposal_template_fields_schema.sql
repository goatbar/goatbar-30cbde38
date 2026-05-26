ALTER TABLE public.proposal_template_fields
  ADD COLUMN IF NOT EXISTS page_number integer,
  ADD COLUMN IF NOT EXISTS field_key text,
  ADD COLUMN IF NOT EXISTS field_label text,
  ADD COLUMN IF NOT EXISTS x numeric,
  ADD COLUMN IF NOT EXISTS y numeric,
  ADD COLUMN IF NOT EXISTS font_color text,
  ADD COLUMN IF NOT EXISTS text_align text,
  ADD COLUMN IF NOT EXISTS letter_spacing numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.proposal_template_fields
SET
  page_number = COALESCE(page_number, page),
  field_key = COALESCE(field_key, technical_name),
  field_label = COALESCE(field_label, label),
  x = COALESCE(x, position_x),
  y = COALESCE(y, position_y),
  font_color = COALESCE(font_color, color_hex),
  text_align = COALESCE(text_align, alignment)
WHERE page_number IS NULL OR field_key IS NULL OR field_label IS NULL OR x IS NULL OR y IS NULL OR font_color IS NULL OR text_align IS NULL;

-- Ensure compatibility with frontend event payment flag
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_paid_full boolean NOT NULL DEFAULT false;

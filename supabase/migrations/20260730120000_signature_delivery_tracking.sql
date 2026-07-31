-- Delivery information returned by Assinafy when an assignment is created.
ALTER TABLE public.contract_signature_signers
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;


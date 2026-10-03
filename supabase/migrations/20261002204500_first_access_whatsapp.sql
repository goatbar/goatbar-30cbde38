-- First access audit/rate-limit log for WhatsApp password recovery links.
CREATE TABLE IF NOT EXISTS public.first_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web', 'whatsapp')),
  delivery_status text NOT NULL DEFAULT 'generated'
    CHECK (delivery_status IN ('generated', 'sent', 'failed', 'rate_limited')),
  failure_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS first_access_requests_user_requested_idx
  ON public.first_access_requests(user_id, requested_at DESC);

ALTER TABLE public.first_access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.first_access_requests FROM anon, authenticated;

-- ------------------------------------------------------------
-- Migration: Google Calendar Integration & Event Sync
-- Tables: google_calendar_integrations, google_calendar_oauth_sessions
-- Events Columns: google_calendar_event_id, google_calendar_sync_status, etc.
-- ------------------------------------------------------------

-- 1. Google Calendar Integrations Table
CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  google_account_email text NOT NULL,
  google_account_name text,
  google_account_avatar text,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_name text NOT NULL DEFAULT 'Principal (Google Calendar)',
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz NOT NULL,
  scope text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'reauthorization_required', 'error')),
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. OAuth Sessions Table (CSRF / State protection)
CREATE TABLE IF NOT EXISTS public.google_calendar_oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 3. Add Google Calendar sync fields to events table if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'google_calendar_event_id') THEN
    ALTER TABLE public.events ADD COLUMN google_calendar_event_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'google_calendar_sync_status') THEN
    ALTER TABLE public.events ADD COLUMN google_calendar_sync_status text NOT NULL DEFAULT 'not_synced' CHECK (google_calendar_sync_status IN ('not_synced', 'pending', 'synced', 'error', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'google_calendar_synced_at') THEN
    ALTER TABLE public.events ADD COLUMN google_calendar_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'google_calendar_sync_error') THEN
    ALTER TABLE public.events ADD COLUMN google_calendar_sync_error text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'google_calendar_html_link') THEN
    ALTER TABLE public.events ADD COLUMN google_calendar_html_link text;
  END IF;
END $$;

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_events_google_calendar_event_id ON public.events (google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_events_google_calendar_sync_status ON public.events (google_calendar_sync_status);
CREATE INDEX IF NOT EXISTS idx_google_calendar_integrations_status ON public.google_calendar_integrations (status);
CREATE INDEX IF NOT EXISTS idx_google_calendar_oauth_sessions_state ON public.google_calendar_oauth_sessions (state);

-- 5. Updated_at Trigger for integrations
CREATE OR REPLACE FUNCTION public.set_google_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_google_calendar_updated_at ON public.google_calendar_integrations;
CREATE TRIGGER trigger_google_calendar_updated_at
  BEFORE UPDATE ON public.google_calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_google_calendar_updated_at();

-- 6. Row Level Security (RLS)
ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for google_calendar_integrations
DROP POLICY IF EXISTS "auth_select_google_calendar_integrations" ON public.google_calendar_integrations;
CREATE POLICY "auth_select_google_calendar_integrations"
  ON public.google_calendar_integrations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_google_calendar_integrations" ON public.google_calendar_integrations;
CREATE POLICY "auth_insert_google_calendar_integrations"
  ON public.google_calendar_integrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_google_calendar_integrations" ON public.google_calendar_integrations;
CREATE POLICY "auth_update_google_calendar_integrations"
  ON public.google_calendar_integrations FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_delete_google_calendar_integrations" ON public.google_calendar_integrations;
CREATE POLICY "auth_delete_google_calendar_integrations"
  ON public.google_calendar_integrations FOR DELETE
  TO authenticated
  USING (true);

-- Policies for google_calendar_oauth_sessions
DROP POLICY IF EXISTS "auth_select_google_calendar_oauth_sessions" ON public.google_calendar_oauth_sessions;
CREATE POLICY "auth_select_google_calendar_oauth_sessions"
  ON public.google_calendar_oauth_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_google_calendar_oauth_sessions" ON public.google_calendar_oauth_sessions;
CREATE POLICY "auth_insert_google_calendar_oauth_sessions"
  ON public.google_calendar_oauth_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_google_calendar_oauth_sessions" ON public.google_calendar_oauth_sessions;
CREATE POLICY "auth_delete_google_calendar_oauth_sessions"
  ON public.google_calendar_oauth_sessions FOR DELETE
  TO authenticated
  USING (true);

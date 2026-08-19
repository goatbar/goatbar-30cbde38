-- Migration: 20260819140000_create_canva_integration_schema.sql
-- Description: Schema for Canva Connect API OAuth 2.0 PKCE integration, sessions, and atomic token rotation

-- 1. Ephemeral OAuth sessions for PKCE & State verification
CREATE TABLE IF NOT EXISTS public.canva_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canva_oauth_sessions_state ON public.canva_oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_canva_oauth_sessions_user_id ON public.canva_oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_canva_oauth_sessions_expires_at ON public.canva_oauth_sessions(expires_at);

-- Restrictive RLS for canva_oauth_sessions (Server-side / service_role only)
ALTER TABLE public.canva_oauth_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Canva Integrations persistent storage
CREATE TABLE IF NOT EXISTS public.canva_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  canva_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canva_integrations_user_id ON public.canva_integrations(user_id);

-- Restrictive RLS for canva_integrations (Server-side / service_role only, no direct frontend SELECT/INSERT/UPDATE)
ALTER TABLE public.canva_integrations ENABLE ROW LEVEL SECURITY;

-- 3. Atomic Token Rotation RPC to prevent double-refresh race condition with single-use refresh tokens
CREATE OR REPLACE FUNCTION public.canva_rotate_tokens(
  p_user_id UUID,
  p_expected_refresh_token TEXT,
  p_new_access_token TEXT,
  p_new_refresh_token TEXT,
  p_new_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_rows INT;
BEGIN
  UPDATE public.canva_integrations
  SET access_token = p_new_access_token,
      refresh_token = p_new_refresh_token,
      access_token_expires_at = p_new_expires_at,
      updated_at = now()
  WHERE user_id = p_user_id
    AND refresh_token = p_expected_refresh_token;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows > 0;
END;
$$;

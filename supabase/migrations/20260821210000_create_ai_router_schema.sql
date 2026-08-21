-- ------------------------------------------------------------
-- Migration: Goat AI Multi-Provider Router Schema
-- Tables: ai_providers, ai_models, ai_circuit_breakers, ai_usage_events
-- Note: Secrets/API keys are NEVER stored in this database.
-- ------------------------------------------------------------

-- 1. AI Providers catalog & runtime status
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id text PRIMARY KEY, -- 'groq', 'cloudflare', 'mistral', 'sambanova', 'openrouter', 'cerebras', 'nvidia', 'gemini'
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  free_type text NOT NULL DEFAULT 'FREE' CHECK (free_type IN ('FREE', 'TRIAL_FREE', 'PAID_NOT_ALLOWED')),
  supports_text boolean NOT NULL DEFAULT true,
  supports_tools boolean NOT NULL DEFAULT true,
  supports_structured_output boolean NOT NULL DEFAULT true,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_audio boolean NOT NULL DEFAULT false,
  supports_streaming boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'cooldown', 'disabled', 'config_incomplete')),
  cooldown_until timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Models metadata & free-tier qualification
CREATE TABLE IF NOT EXISTS public.ai_models (
  id text PRIMARY KEY, -- e.g. 'groq/openai/gpt-oss-120b', 'cloudflare/@cf/meta/llama-3.1-8b-instruct'
  provider_id text NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  free_tier boolean NOT NULL DEFAULT true,
  context_window integer DEFAULT 8192,
  is_default boolean NOT NULL DEFAULT false,
  supports_tools boolean NOT NULL DEFAULT true,
  supports_vision boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. AI Circuit Breakers state (L2 persistent state across stateless Edge Functions)
CREATE TABLE IF NOT EXISTS public.ai_circuit_breakers (
  provider_id text PRIMARY KEY REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  consecutive_failures integer NOT NULL DEFAULT 0,
  opened_at timestamptz,
  cooldown_until timestamptz,
  last_failure_reason text,
  last_status_code integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. AI Usage Events & Telemetry
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('success', 'fallback', 'rate_limit', 'error', 'exhausted', 'provider_switch')),
  duration_ms integer NOT NULL DEFAULT 0,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  error_type text,
  error_message text,
  tools_executed text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_providers_priority ON public.ai_providers (priority ASC, enabled);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON public.ai_models (provider_id, free_tier);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_correlation ON public.ai_usage_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at ON public.ai_usage_events (created_at DESC);

-- 6. Initial Seed Data (All marked strictly FREE or TRIAL_FREE)
INSERT INTO public.ai_providers (id, name, priority, enabled, free_type, supports_text, supports_tools, supports_structured_output, supports_vision, supports_audio, supports_streaming)
VALUES
  ('groq', 'Groq', 10, true, 'FREE', true, true, true, false, false, true),
  ('cloudflare', 'Cloudflare Workers AI', 20, true, 'FREE', true, false, true, false, false, true),
  ('mistral', 'Mistral AI', 30, true, 'FREE', true, true, true, false, false, true),
  ('sambanova', 'SambaNova Cloud', 40, true, 'FREE', true, true, true, false, false, true),
  ('openrouter', 'OpenRouter Free', 50, true, 'FREE', true, true, true, false, false, true),
  ('cerebras', 'Cerebras Trial', 60, true, 'TRIAL_FREE', true, true, true, false, false, true),
  ('nvidia', 'NVIDIA NIM', 70, true, 'FREE', true, true, true, false, false, true),
  ('gemini', 'Google Gemini Free', 80, true, 'FREE', true, true, true, true, true, true)
ON CONFLICT (id) DO UPDATE SET
  priority = EXCLUDED.priority,
  free_type = EXCLUDED.free_type;

-- 7. RLS
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ai_providers" ON public.ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_ai_providers" ON public.ai_providers FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_ai_models" ON public.ai_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_ai_models" ON public.ai_models FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_ai_circuit_breakers" ON public.ai_circuit_breakers FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_ai_circuit_breakers" ON public.ai_circuit_breakers FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_ai_usage_events" ON public.ai_usage_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_ai_usage_events" ON public.ai_usage_events FOR ALL TO service_role USING (true);

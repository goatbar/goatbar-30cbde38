-- ------------------------------------------------------------
-- Migration: Goat AI Persistent Turns & Conversation Concurrency Locks
-- Tables: ai_turns, ai_conversation_locks
-- ------------------------------------------------------------

-- 1. AI Turns (Official persistent lifecycle entity)
CREATE TABLE IF NOT EXISTS public.ai_turns (
  id text PRIMARY KEY, -- turnId (e.g. 'turn_1788805600000_abc123')
  request_id text,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  assistant_message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'partial', 'failed', 'cancelled')),
  current_stage text NOT NULL DEFAULT 'init',
  provider_id text,
  model_id text,
  tools_executed text[] DEFAULT '{}',
  error_type text,
  error_message text,
  reply text,
  timings jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Conversation Locks (Atomic Mutual Exclusion per conversation)
CREATE TABLE IF NOT EXISTS public.ai_conversation_locks (
  conversation_id uuid PRIMARY KEY REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  active_turn_id text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '50 seconds')
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_turns_conv ON public.ai_turns (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_turns_status ON public.ai_turns (status);
CREATE INDEX IF NOT EXISTS idx_ai_turns_request_id ON public.ai_turns (request_id);

-- 4. RLS
ALTER TABLE public.ai_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ai_turns" ON public.ai_turns FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_manage_ai_turns" ON public.ai_turns FOR ALL TO service_role USING (true);
CREATE POLICY "service_manage_conversation_locks" ON public.ai_conversation_locks FOR ALL TO service_role USING (true);

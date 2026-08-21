-- ------------------------------------------------------------
-- Migration: Goat AI Conversational Assistant & Tool Registry Schema
-- Tables: ai_conversations, ai_messages, ai_pending_actions,
--         ai_tool_calls, user_messaging_accounts
-- ------------------------------------------------------------

-- 1. AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('web', 'whatsapp', 'api')),
  external_conversation_id text,
  title text NOT NULL DEFAULT 'Nova conversa',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'action_prompt', 'action_result')),
  attachment_url text,
  attachment_metadata jsonb DEFAULT '{}'::jsonb,
  external_message_id text,
  sender_name text,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. AI Pending Actions (Multi-turn missing fields & confirmation)
CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_fields text[] NOT NULL DEFAULT '{}',
  summary text,
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'ready_for_confirmation', 'executed', 'cancelled', 'expired')),
  execution_id text,
  result jsonb,
  error text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. AI Tool Calls (Audit & tracking)
CREATE TABLE IF NOT EXISTS public.ai_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'running', 'success', 'error', 'rejected')),
  error text,
  duration_ms integer DEFAULT 0,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- 5. User Messaging Accounts (WhatsApp Phone -> Goat Bar User mapping)
CREATE TABLE IF NOT EXISTS public.user_messaging_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'whatsapp' CHECK (provider IN ('whatsapp', 'telegram')),
  external_user_id text,
  phone_number text NOT NULL,
  display_name text,
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_messaging_accounts_provider_phone_key UNIQUE (provider, phone_number)
);

-- 6. Indices
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_channel ON public.ai_conversations (channel);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON public.ai_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_conv_status ON public.ai_pending_actions (conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_conversation_id ON public.ai_tool_calls (conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messaging_accounts_phone ON public.user_messaging_accounts (phone_number);

-- 7. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trigger_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_conversations_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_pending_actions_updated_at ON public.ai_pending_actions;
CREATE TRIGGER trigger_ai_pending_actions_updated_at
  BEFORE UPDATE ON public.ai_pending_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_conversations_updated_at();

-- 8. Row Level Security (RLS)
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messaging_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for ai_conversations
DROP POLICY IF EXISTS "auth_select_ai_conversations" ON public.ai_conversations;
CREATE POLICY "auth_select_ai_conversations" ON public.ai_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ai_conversations" ON public.ai_conversations;
CREATE POLICY "auth_insert_ai_conversations" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_ai_conversations" ON public.ai_conversations;
CREATE POLICY "auth_update_ai_conversations" ON public.ai_conversations FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete_ai_conversations" ON public.ai_conversations;
CREATE POLICY "auth_delete_ai_conversations" ON public.ai_conversations FOR DELETE TO authenticated USING (true);

-- Policies for ai_messages
DROP POLICY IF EXISTS "auth_select_ai_messages" ON public.ai_messages;
CREATE POLICY "auth_select_ai_messages" ON public.ai_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ai_messages" ON public.ai_messages;
CREATE POLICY "auth_insert_ai_messages" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for ai_pending_actions
DROP POLICY IF EXISTS "auth_select_ai_pending_actions" ON public.ai_pending_actions;
CREATE POLICY "auth_select_ai_pending_actions" ON public.ai_pending_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ai_pending_actions" ON public.ai_pending_actions;
CREATE POLICY "auth_insert_ai_pending_actions" ON public.ai_pending_actions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_ai_pending_actions" ON public.ai_pending_actions;
CREATE POLICY "auth_update_ai_pending_actions" ON public.ai_pending_actions FOR UPDATE TO authenticated USING (true);

-- Policies for ai_tool_calls
DROP POLICY IF EXISTS "auth_select_ai_tool_calls" ON public.ai_tool_calls;
CREATE POLICY "auth_select_ai_tool_calls" ON public.ai_tool_calls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ai_tool_calls" ON public.ai_tool_calls;
CREATE POLICY "auth_insert_ai_tool_calls" ON public.ai_tool_calls FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for user_messaging_accounts
DROP POLICY IF EXISTS "auth_select_user_messaging_accounts" ON public.user_messaging_accounts;
CREATE POLICY "auth_select_user_messaging_accounts" ON public.user_messaging_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_manage_user_messaging_accounts" ON public.user_messaging_accounts;
CREATE POLICY "auth_manage_user_messaging_accounts" ON public.user_messaging_accounts FOR ALL TO authenticated USING (true);

-- ------------------------------------------------------------
-- Migration: Optimize user_messaging_accounts Lookups
-- Adds performance and consistency indices for WhatsApp user resolution
-- ------------------------------------------------------------

-- 1. Index on provider and external_user_id for fast wa_id matching
CREATE INDEX IF NOT EXISTS idx_user_messaging_accounts_provider_external_id
  ON public.user_messaging_accounts (provider, external_user_id)
  WHERE external_user_id IS NOT NULL;

-- 2. Composite index on provider, verified, phone_number
CREATE INDEX IF NOT EXISTS idx_user_messaging_accounts_provider_verified_phone
  ON public.user_messaging_accounts (provider, verified, phone_number);

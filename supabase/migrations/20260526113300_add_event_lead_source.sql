-- Add missing lead source and referral name columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS referral_name text;

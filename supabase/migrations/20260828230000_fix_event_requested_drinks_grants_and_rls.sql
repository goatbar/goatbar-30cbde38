-- ------------------------------------------------------------
-- Migration: 20260828230000_fix_event_requested_drinks_grants_and_rls.sql
-- Purpose: Fix table grants and RLS policies for event_requested_drinks
--          granting minimal necessary privileges to authenticated users
--          and service_role while keeping anon revoked from direct access.
-- ------------------------------------------------------------

-- 1. Explicitly grant required privileges to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_requested_drinks TO authenticated, service_role;
REVOKE ALL ON public.event_requested_drinks FROM anon;

-- 2. Ensure drinks catalog table has SELECT granted to authenticated and service_role
GRANT SELECT ON public.drinks TO authenticated, service_role;

-- 3. Ensure Row Level Security is active
ALTER TABLE public.event_requested_drinks ENABLE ROW LEVEL SECURITY;

-- 4. Clean up legacy or broad policies
DROP POLICY IF EXISTS event_requested_drinks_authenticated_access ON public.event_requested_drinks;
DROP POLICY IF EXISTS event_requested_drinks_authenticated_select ON public.event_requested_drinks;
DROP POLICY IF EXISTS event_requested_drinks_authenticated_modify ON public.event_requested_drinks;

-- 5. Selective RLS Policy for authenticated users reading event requested drinks
CREATE POLICY event_requested_drinks_authenticated_select
  ON public.event_requested_drinks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_requested_drinks.event_id
    )
  );

-- 6. Selective RLS Policy for authenticated users modifying event requested drinks
CREATE POLICY event_requested_drinks_authenticated_modify
  ON public.event_requested_drinks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_requested_drinks.event_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = event_requested_drinks.event_id
    )
  );

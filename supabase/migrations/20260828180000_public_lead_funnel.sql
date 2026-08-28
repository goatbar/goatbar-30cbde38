CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  whatsapp_normalized text NOT NULL UNIQUE,
  email text,
  stage text NOT NULL DEFAULT 'CONTACT_CAPTURED' CHECK (stage IN ('VISITED','STARTED','CONTACT_CAPTURED','FORM_IN_PROGRESS','SUBMITTED','PROPOSAL_CREATED','CONVERTED')),
  source text,
  event_type text,
  event_date date,
  guest_count integer,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  visitor_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.lead_journeys(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, event_key)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads, public.lead_journeys, public.lead_funnel_events FROM anon;
GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT SELECT ON public.lead_journeys, public.lead_funnel_events TO authenticated;

DROP POLICY IF EXISTS leads_authenticated_select ON public.leads;
CREATE POLICY leads_authenticated_select ON public.leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS leads_authenticated_update ON public.leads;
CREATE POLICY leads_authenticated_update ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lead_journeys_authenticated_select ON public.lead_journeys;
CREATE POLICY lead_journeys_authenticated_select ON public.lead_journeys FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lead_funnel_events_authenticated_select ON public.lead_funnel_events;
CREATE POLICY lead_funnel_events_authenticated_select ON public.lead_funnel_events FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW public.leads_with_effective_stage AS
SELECT l.*,
  CASE
    WHEN l.stage IN ('SUBMITTED','PROPOSAL_CREATED','CONVERTED') THEN l.stage
    WHEN l.event_id IS NULL AND l.last_activity_at < now() - interval '24 hours' THEN 'ABANDONED'
    ELSE l.stage
  END AS effective_stage
FROM public.leads l;

CREATE INDEX IF NOT EXISTS leads_last_activity_idx ON public.leads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS lead_journeys_lead_idx ON public.lead_journeys(lead_id);
CREATE INDEX IF NOT EXISTS lead_funnel_events_lead_created_idx ON public.lead_funnel_events(lead_id, created_at);

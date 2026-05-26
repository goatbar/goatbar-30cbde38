-- Create proposal_templates table
CREATE TABLE IF NOT EXISTS public.proposal_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    event_type text NOT NULL, -- 'casamento', 'aniversario', 'comemoracao'
    file_url text,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create generated_proposals table
CREATE TABLE IF NOT EXISTS public.generated_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    budget_id uuid REFERENCES public.event_budget_versions(id) ON DELETE SET NULL,
    template_id uuid REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
    proposal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    final_pdf_url text,
    status text NOT NULL DEFAULT 'draft', -- 'draft', 'reviewed', 'downloaded', 'sent'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_proposals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "public full access proposal_templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "public full access generated_proposals" ON public.generated_proposals;

-- Create policies for public access (consistent with other tables in the project)
CREATE POLICY "public full access proposal_templates" ON public.proposal_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public full access generated_proposals" ON public.generated_proposals FOR ALL USING (true) WITH CHECK (true);

-- Create storage buckets for proposals
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-templates', 'proposal-templates', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-proposals', 'generated-proposals', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage buckets
DROP POLICY IF EXISTS "Acesso Publico Proposal Templates" ON storage.objects;
DROP POLICY IF EXISTS "Upload Autenticado Proposal Templates" ON storage.objects;
DROP POLICY IF EXISTS "Atualizacao Autenticada Proposal Templates" ON storage.objects;
DROP POLICY IF EXISTS "Exclusao Autenticada Proposal Templates" ON storage.objects;

DROP POLICY IF EXISTS "Acesso Publico Generated Proposals" ON storage.objects;
DROP POLICY IF EXISTS "Upload Autenticado Generated Proposals" ON storage.objects;
DROP POLICY IF EXISTS "Atualizacao Autenticada Generated Proposals" ON storage.objects;
DROP POLICY IF EXISTS "Exclusao Autenticada Generated Proposals" ON storage.objects;

-- Policies for proposal-templates
CREATE POLICY "Acesso Publico Proposal Templates" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'proposal-templates');

CREATE POLICY "Upload Autenticado Proposal Templates" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'proposal-templates');

CREATE POLICY "Atualizacao Autenticada Proposal Templates" 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (bucket_id = 'proposal-templates');

CREATE POLICY "Exclusao Autenticada Proposal Templates" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'proposal-templates');

-- Policies for generated-proposals
CREATE POLICY "Acesso Publico Generated Proposals" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'generated-proposals');

CREATE POLICY "Upload Autenticado Generated Proposals" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'generated-proposals');

CREATE POLICY "Atualizacao Autenticada Generated Proposals" 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (bucket_id = 'generated-proposals');

CREATE POLICY "Exclusao Autenticada Generated Proposals" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'generated-proposals');

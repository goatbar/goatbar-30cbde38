-- Adiciona colunas para reposição do restaurante em sessões financeiras
ALTER TABLE public.financial_sessions ADD COLUMN IF NOT EXISTS reposicao_restaurante numeric DEFAULT 0;
ALTER TABLE public.financial_sessions ADD COLUMN IF NOT EXISTS custos_restaurante_detalhes jsonb DEFAULT '[]'::jsonb;

-- Libera políticas de acesso público para inventory e inventory_movements para permitir migração sem autenticação
DROP POLICY IF EXISTS "authenticated full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "public full access inventory" ON public.inventory;
CREATE POLICY "public full access inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated full access inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "public full access inventory_movements" ON public.inventory_movements;
CREATE POLICY "public full access inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

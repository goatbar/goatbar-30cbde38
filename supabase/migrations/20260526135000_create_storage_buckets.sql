-- 1. Criar o bucket 'contract-templates' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-templates', 'contract-templates', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar o bucket 'drink_images' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('drink_images', 'drink_images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de RLS para o bucket 'contract-templates'
DROP POLICY IF EXISTS "Acesso Publico Contratos" ON storage.objects;
CREATE POLICY "Acesso Publico Contratos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'contract-templates');

DROP POLICY IF EXISTS "Upload Autenticado Contratos" ON storage.objects;
CREATE POLICY "Upload Autenticado Contratos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'contract-templates');

DROP POLICY IF EXISTS "Atualizacao Autenticada Contratos" ON storage.objects;
CREATE POLICY "Atualizacao Autenticada Contratos" 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (bucket_id = 'contract-templates');

DROP POLICY IF EXISTS "Exclusao Autenticada Contratos" ON storage.objects;
CREATE POLICY "Exclusao Autenticada Contratos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'contract-templates');

-- 4. Políticas de RLS para o bucket 'drink_images'
DROP POLICY IF EXISTS "Acesso Publico Drink Images" ON storage.objects;
CREATE POLICY "Acesso Publico Drink Images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'drink_images');

DROP POLICY IF EXISTS "Upload Autenticado Drink Images" ON storage.objects;
CREATE POLICY "Upload Autenticado Drink Images" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'drink_images');

DROP POLICY IF EXISTS "Atualizacao Autenticada Drink Images" ON storage.objects;
CREATE POLICY "Atualizacao Autenticada Drink Images" 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK (bucket_id = 'drink_images');

DROP POLICY IF EXISTS "Exclusao Autenticada Drink Images" ON storage.objects;
CREATE POLICY "Exclusao Autenticada Drink Images" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'drink_images');

-- ==============================================================================
-- CVISUAL POS — 03_storage.sql
-- Buckets Supabase Storage isolés avec préfixe 'cvisual-'
-- Buckets : cvisual-logos, cvisual-product-images, cvisual-catalogue-covers
-- ==============================================================================

-- 1. Création des buckets de stockage publics préfixés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('cvisual-logos', 'cvisual-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
    ('cvisual-product-images', 'cvisual-product-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
    ('cvisual-catalogue-covers', 'cvisual-catalogue-covers', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Politiques d'accès en LECTURE PUBLIQUE
DROP POLICY IF EXISTS "Public can view cvisual-logos" ON storage.objects;
CREATE POLICY "Public can view cvisual-logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'cvisual-logos');

DROP POLICY IF EXISTS "Public can view cvisual-product-images" ON storage.objects;
CREATE POLICY "Public can view cvisual-product-images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'cvisual-product-images');

DROP POLICY IF EXISTS "Public can view cvisual-catalogue-covers" ON storage.objects;
CREATE POLICY "Public can view cvisual-catalogue-covers"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'cvisual-catalogue-covers');

-- 3. Politiques d'INSERTION (Upload pour utilisateurs connectés)
DROP POLICY IF EXISTS "Authenticated users can upload cvisual-logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload cvisual-logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cvisual-logos');

DROP POLICY IF EXISTS "Authenticated users can upload cvisual-product-images" ON storage.objects;
CREATE POLICY "Authenticated users can upload cvisual-product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cvisual-product-images');

DROP POLICY IF EXISTS "Authenticated users can upload cvisual-catalogue-covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload cvisual-catalogue-covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cvisual-catalogue-covers');

-- 4. Politiques de MODIFICATION et SUPPRESSION
DROP POLICY IF EXISTS "Authenticated users can update cvisual files" ON storage.objects;
CREATE POLICY "Authenticated users can update cvisual files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('cvisual-logos', 'cvisual-product-images', 'cvisual-catalogue-covers'));

DROP POLICY IF EXISTS "Authenticated users can delete cvisual files" ON storage.objects;
CREATE POLICY "Authenticated users can delete cvisual files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('cvisual-logos', 'cvisual-product-images', 'cvisual-catalogue-covers'));

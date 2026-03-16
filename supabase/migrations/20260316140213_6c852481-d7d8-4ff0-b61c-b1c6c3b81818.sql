-- Criar bucket público para fotos de membros (idempotente)
insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Permitir leitura pública das fotos de membros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Member photos are publicly viewable'
  ) THEN
    CREATE POLICY "Member photos are publicly viewable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'member-photos');
  END IF;
END
$$;

-- Permitir upload para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload member photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload member photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'member-photos');
  END IF;
END
$$;

-- Permitir atualização para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update member photos'
  ) THEN
    CREATE POLICY "Authenticated users can update member photos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'member-photos')
    WITH CHECK (bucket_id = 'member-photos');
  END IF;
END
$$;

-- Permitir exclusão para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete member photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete member photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'member-photos');
  END IF;
END
$$;
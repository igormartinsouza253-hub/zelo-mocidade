-- Expand group notes with shared editing, pin/archive, tags, and safer notifications.

ALTER TABLE public.notas
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz,
ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shared_editing_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.set_note_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_admin(auth.uid(), OLD.group_id) AND auth.uid() <> OLD.user_id THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.group_id IS DISTINCT FROM OLD.group_id
      OR NEW.visibility IS DISTINCT FROM OLD.visibility
      OR NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
      OR NEW.shared_editing_enabled IS DISTINCT FROM OLD.shared_editing_enabled
    THEN
      RAISE EXCEPTION 'Only note owners or group admins can change note permissions';
    END IF;
  END IF;

  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_note_updated_at ON public.notas;
CREATE TRIGGER trg_set_note_updated_at
BEFORE UPDATE ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.set_note_updated_at();

CREATE INDEX IF NOT EXISTS idx_notas_group_archive_pin_created_at
ON public.notas (group_id, archived_at, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notas_tags_gin
ON public.notas USING gin (tags);

CREATE TABLE IF NOT EXISTS public.note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.management_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_comments_note_created_at
ON public.note_comments (note_id, created_at);

ALTER TABLE public.note_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view public note comments" ON public.note_comments;
DROP POLICY IF EXISTS "Group members can create public note comments" ON public.note_comments;
DROP POLICY IF EXISTS "Comment owners and admins can delete comments" ON public.note_comments;

CREATE POLICY "Group members can view public note comments"
ON public.note_comments
FOR SELECT
TO authenticated
USING (
  public.is_group_member(auth.uid(), group_id)
  AND EXISTS (
    SELECT 1
    FROM public.notas n
    WHERE n.id = note_id
      AND n.group_id = group_id
      AND n.visibility = 'group'
  )
);

CREATE POLICY "Group members can create public note comments"
ON public.note_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_group_member(auth.uid(), group_id)
  AND EXISTS (
    SELECT 1
    FROM public.notas n
    WHERE n.id = note_id
      AND n.group_id = group_id
      AND n.visibility = 'group'
  )
);

CREATE POLICY "Comment owners and admins can delete comments"
ON public.note_comments
FOR DELETE
TO authenticated
USING (
  public.is_group_member(auth.uid(), group_id)
  AND (
    user_id = auth.uid()
    OR public.is_group_admin(auth.uid(), group_id)
  )
);

CREATE TABLE IF NOT EXISTS public.note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.management_groups(id) ON DELETE CASCADE,
  edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  conteudo text NOT NULL,
  visibility text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_created_at
ON public.note_versions (note_id, created_at DESC);

ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view accessible note versions" ON public.note_versions;

CREATE POLICY "Group members can view accessible note versions"
ON public.note_versions
FOR SELECT
TO authenticated
USING (
  public.is_group_member(auth.uid(), group_id)
  AND EXISTS (
    SELECT 1
    FROM public.notas n
    WHERE n.id = note_id
      AND n.group_id = group_id
      AND (
        n.user_id = auth.uid()
        OR n.visibility = 'group'
      )
  )
);

CREATE OR REPLACE FUNCTION public.capture_note_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.conteudo IS DISTINCT FROM NEW.conteudo
    OR OLD.visibility IS DISTINCT FROM NEW.visibility
    OR OLD.tags IS DISTINCT FROM NEW.tags
  THEN
    INSERT INTO public.note_versions (
      note_id,
      group_id,
      edited_by,
      conteudo,
      visibility,
      tags
    )
    VALUES (
      OLD.id,
      OLD.group_id,
      auth.uid(),
      OLD.conteudo,
      OLD.visibility,
      OLD.tags
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_note_version ON public.notas;
CREATE TRIGGER trg_capture_note_version
BEFORE UPDATE ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.capture_note_version();

CREATE OR REPLACE FUNCTION public.notify_note_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name text;
  recipient record;
BEGIN
  IF NEW.group_id IS NULL OR NEW.visibility <> 'group' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.username, 'Usuario')
  INTO author_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  FOR recipient IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      NEW.group_id,
      'note_created',
      'Nova nota publica',
      author_name || ' publicou uma nova nota no grupo.',
      'nota',
      NEW.id,
      jsonb_build_object('author_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Group members can view scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can create scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Note owners can update scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Note owners can delete scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can update shared notes" ON public.notas;
DROP POLICY IF EXISTS "Group admins and owners can delete notes" ON public.notas;

CREATE POLICY "Group members can view scoped notes"
ON public.notas
FOR SELECT
TO authenticated
USING (
  group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND (
    user_id = auth.uid()
    OR visibility = 'group'
  )
);

CREATE POLICY "Group members can create scoped notes"
ON public.notas
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND visibility IN ('private', 'group')
  AND public.note_links_match_group(group_id, membro_id, reuniao_id)
);

CREATE POLICY "Group members can update shared notes"
ON public.notas
FOR UPDATE
TO authenticated
USING (
  group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND (
    user_id = auth.uid()
    OR public.is_group_admin(auth.uid(), group_id)
    OR (
      visibility = 'group'
      AND shared_editing_enabled IS TRUE
      AND archived_at IS NULL
    )
  )
)
WITH CHECK (
  group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND visibility IN ('private', 'group')
  AND (
    user_id = auth.uid()
    OR public.is_group_admin(auth.uid(), group_id)
    OR (
      visibility = 'group'
      AND shared_editing_enabled IS TRUE
      AND archived_at IS NULL
    )
  )
  AND public.note_links_match_group(group_id, membro_id, reuniao_id)
);

CREATE POLICY "Group admins and owners can delete notes"
ON public.notas
FOR DELETE
TO authenticated
USING (
  group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND (
    user_id = auth.uid()
    OR public.is_group_admin(auth.uid(), group_id)
  )
);

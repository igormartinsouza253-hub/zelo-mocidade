-- Notes must be isolated by management group and support private/group visibility.

ALTER TABLE public.notas
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.notas
DROP CONSTRAINT IF EXISTS notas_visibility_check;

ALTER TABLE public.notas
ADD CONSTRAINT notas_visibility_check
CHECK (visibility IN ('private', 'group'));

-- Backfill missing group_id when the note is linked to a grouped entity.
UPDATE public.notas n
SET group_id = m.group_id
FROM public.membros m
WHERE n.group_id IS NULL
  AND n.membro_id = m.id
  AND m.group_id IS NOT NULL;

UPDATE public.notas n
SET group_id = r.group_id
FROM public.reunioes r
WHERE n.group_id IS NULL
  AND n.reuniao_id = r.id
  AND r.group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notas_group_visibility_created_at
ON public.notas (group_id, visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notas_user_group_created_at
ON public.notas (user_id, group_id, created_at DESC);

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
      AND gm.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      NEW.group_id,
      'note_created',
      'Nova nota criada',
      author_name || ' criou uma nova nota publica no grupo.',
      'nota',
      NEW.id,
      jsonb_build_object('author_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.note_links_match_group(
  _group_id uuid,
  _membro_id uuid,
  _reuniao_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _group_id IS NOT NULL
    AND (
      _membro_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.membros m
        WHERE m.id = _membro_id
          AND m.group_id = _group_id
      )
    )
    AND (
      _reuniao_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.reunioes r
        WHERE r.id = _reuniao_id
          AND r.group_id = _group_id
      )
    );
$$;

DROP POLICY IF EXISTS "Users can view their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notas;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can view notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can insert notes" ON public.notas;
DROP POLICY IF EXISTS "Users can update their own notes (group scoped)" ON public.notas;
DROP POLICY IF EXISTS "Group admins can delete notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can view scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Group members can create scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Note owners can update scoped notes" ON public.notas;
DROP POLICY IF EXISTS "Note owners can delete scoped notes" ON public.notas;

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

CREATE POLICY "Note owners can update scoped notes"
ON public.notas
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
  AND visibility IN ('private', 'group')
  AND public.note_links_match_group(group_id, membro_id, reuniao_id)
);

CREATE POLICY "Note owners can delete scoped notes"
ON public.notas
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND group_id IS NOT NULL
  AND public.is_group_member(auth.uid(), group_id)
);

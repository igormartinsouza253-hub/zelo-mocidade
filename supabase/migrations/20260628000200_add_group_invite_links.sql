-- Temporary group invite links.
-- Admins generate a link that is valid for up to 10 hours. Authenticated users can
-- accept the link and become group members without typing the group password.

CREATE TABLE IF NOT EXISTS public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.management_groups(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON public.group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_expires_at ON public.group_invites(expires_at);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group admins can view invites" ON public.group_invites;
CREATE POLICY "Group admins can view invites"
ON public.group_invites
FOR SELECT
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group admins can revoke invites" ON public.group_invites;
CREATE POLICY "Group admins can revoke invites"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_admin(auth.uid(), group_id));

CREATE OR REPLACE FUNCTION public.create_group_invite(
  _group_id uuid,
  _token text,
  _expires_in_hours integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  invite_id uuid;
  expires_in_hours integer := LEAST(GREATEST(COALESCE(_expires_in_hours, 10), 1), 10);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _group_id IS NULL OR NOT public.is_group_admin(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'not_group_admin';
  END IF;

  IF _token IS NULL OR length(_token) < 24 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  INSERT INTO public.group_invites (
    group_id,
    token_hash,
    created_by,
    expires_at
  )
  VALUES (
    _group_id,
    encode(digest(_token, 'sha256'), 'hex'),
    auth.uid(),
    now() + make_interval(hours => expires_in_hours)
  )
  RETURNING id INTO invite_id;

  RETURN invite_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_group_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  invite_row public.group_invites%ROWTYPE;
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _token IS NULL OR length(_token) < 24 THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  SELECT *
  INTO invite_row
  FROM public.group_invites gi
  WHERE gi.token_hash = encode(digest(_token, 'sha256'), 'hex')
  LIMIT 1;

  IF invite_row.id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF invite_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_disabled';
  END IF;

  IF invite_row.expires_at <= now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (invite_row.group_id, requester, 'member')
  ON CONFLICT (group_id, user_id)
  DO NOTHING;

  INSERT INTO public.user_active_group (user_id, group_id)
  VALUES (requester, invite_row.group_id)
  ON CONFLICT (user_id)
  DO UPDATE SET group_id = excluded.group_id, updated_at = now();

  UPDATE public.group_invites
  SET used_count = used_count + 1,
      last_used_at = now()
  WHERE id = invite_row.id;

  RETURN invite_row.group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_invite(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;

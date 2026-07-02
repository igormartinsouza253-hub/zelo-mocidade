-- Group info screen support.
-- Invite links must last at most 10 minutes, and group members can see presence
-- for the members of their own group.

DROP FUNCTION IF EXISTS public.create_group_invite(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.create_group_invite(
  _group_id uuid,
  _token text,
  _expires_in_minutes integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  invite_id uuid;
  expires_in_minutes integer := LEAST(GREATEST(COALESCE(_expires_in_minutes, 10), 1), 10);
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
    now() + make_interval(mins => expires_in_minutes)
  )
  RETURNING id INTO invite_id;

  RETURN invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_invite(uuid, text, integer) TO authenticated;

DROP POLICY IF EXISTS "Group admins can view group presence" ON public.group_user_presence;
DROP POLICY IF EXISTS "Group members can view group presence" ON public.group_user_presence;

CREATE POLICY "Group members can view group presence"
ON public.group_user_presence
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

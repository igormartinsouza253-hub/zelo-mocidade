-- Fix login/signup onboarding and group join request flow for newly-created users.
-- A new account must be able to list groups and request entry without depending on
-- the legacy global user_roles bootstrap finishing first.

DROP POLICY IF EXISTS "Approved users can list groups" ON public.management_groups;

CREATE POLICY "Authenticated users can list groups"
ON public.management_groups
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create join request for themselves" ON public.group_join_requests;

CREATE POLICY "Users can create join request for themselves"
ON public.group_join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can resubmit their own rejected join requests" ON public.group_join_requests;

CREATE POLICY "Users can resubmit their own rejected join requests"
ON public.group_join_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'rejected')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE OR REPLACE FUNCTION public.request_group_join(_group_id uuid, _password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  requester uuid := auth.uid();
  password_ok boolean := false;
  existing_status public.join_request_status;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _group_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF _password IS NULL OR btrim(_password) = '' THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  IF public.is_group_member(requester, _group_id) THEN
    RETURN 'already_member';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.management_groups g
    WHERE g.id = _group_id
      AND g.password_hash = extensions.crypt(_password, g.password_hash)
  )
  INTO password_ok;

  IF password_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  SELECT gjr.status
  INTO existing_status
  FROM public.group_join_requests gjr
  WHERE gjr.group_id = _group_id
    AND gjr.user_id = requester;

  IF existing_status = 'pending' THEN
    RETURN 'already_pending';
  END IF;

  IF existing_status = 'approved' THEN
    RETURN 'already_member';
  END IF;

  INSERT INTO public.group_join_requests (group_id, user_id, status, created_at, decided_at, decided_by)
  VALUES (_group_id, requester, 'pending', now(), NULL, NULL)
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET
    status = 'pending',
    created_at = now(),
    decided_at = NULL,
    decided_by = NULL;

  RETURN 'created';
END;
$$;

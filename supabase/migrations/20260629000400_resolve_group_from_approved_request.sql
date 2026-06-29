-- A user who is approved while already logged in must be able to enter the app
-- without signing out. Treat the latest approved join request as a valid source
-- for activating the user's group, and repair missing membership if necessary.

CREATE OR REPLACE FUNCTION public.ensure_active_group_for_current_user()
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  role public.group_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
  resolved_group_id uuid;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT uag.group_id
  INTO resolved_group_id
  FROM public.user_active_group uag
  WHERE uag.user_id = requester
    AND public.is_group_member(requester, uag.group_id);

  IF resolved_group_id IS NULL THEN
    SELECT gm.group_id
    INTO resolved_group_id
    FROM public.group_members gm
    WHERE gm.user_id = requester
    ORDER BY gm.created_at ASC
    LIMIT 1;
  END IF;

  IF resolved_group_id IS NULL THEN
    SELECT gjr.group_id
    INTO resolved_group_id
    FROM public.group_join_requests gjr
    WHERE gjr.user_id = requester
      AND gjr.status = 'approved'
    ORDER BY gjr.decided_at DESC NULLS LAST, gjr.created_at DESC
    LIMIT 1;
  END IF;

  IF resolved_group_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (resolved_group_id, requester, 'member'::public.group_role)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  INSERT INTO public.user_active_group (user_id, group_id)
  VALUES (requester, resolved_group_id)
  ON CONFLICT (user_id)
  DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = now();

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    gm.role
  FROM public.management_groups g
  JOIN public.group_members gm
    ON gm.group_id = g.id
   AND gm.user_id = requester
  WHERE g.id = resolved_group_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_active_group_for_current_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_group_join_request(_request_id uuid, _action text)
RETURNS public.join_request_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
  target_group_id uuid;
  target_user_id uuid;
  normalized_action text := lower(trim(coalesce(_action, '')));
  next_status public.join_request_status;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF normalized_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT gjr.group_id, gjr.user_id
  INTO target_group_id, target_user_id
  FROM public.group_join_requests gjr
  WHERE gjr.id = _request_id
  FOR UPDATE;

  IF target_group_id IS NULL OR target_user_id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF NOT public.is_group_admin(requester, target_group_id) THEN
    RAISE EXCEPTION 'not_group_admin';
  END IF;

  IF normalized_action = 'approve' THEN
    next_status := 'approved'::public.join_request_status;

    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (target_group_id, target_user_id, 'member'::public.group_role)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    INSERT INTO public.user_active_group (user_id, group_id)
    VALUES (target_user_id, target_group_id)
    ON CONFLICT (user_id)
    DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = now();
  ELSE
    next_status := 'rejected'::public.join_request_status;
  END IF;

  UPDATE public.group_join_requests
  SET
    status = next_status,
    decided_at = now(),
    decided_by = requester
  WHERE id = _request_id;

  RETURN next_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_group_join_request(uuid, text) TO authenticated;

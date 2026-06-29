-- Make group membership the single source of truth.
-- user_active_group is now only a preference for users who belong to more than one group.

INSERT INTO public.group_members (group_id, user_id, role)
SELECT gjr.group_id, gjr.user_id, 'member'::public.group_role
FROM public.group_join_requests gjr
WHERE gjr.status = 'approved'
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO public.user_active_group (user_id, group_id)
SELECT DISTINCT ON (gm.user_id)
  gm.user_id,
  gm.group_id
FROM public.group_members gm
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_active_group uag
  WHERE uag.user_id = gm.user_id
)
ORDER BY gm.user_id, gm.created_at ASC
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_active_group uag
WHERE NOT EXISTS (
  SELECT 1
  FROM public.group_members gm
  WHERE gm.user_id = uag.user_id
    AND gm.group_id = uag.group_id
);

CREATE OR REPLACE FUNCTION public.get_my_group_context()
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  role public.group_role,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
  preferred_group_id uuid;
  fallback_group_id uuid;
  resolved_group_id uuid;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT gm.group_id
  INTO fallback_group_id
  FROM public.group_members gm
  WHERE gm.user_id = requester
  ORDER BY gm.created_at ASC
  LIMIT 1;

  IF fallback_group_id IS NULL THEN
    RETURN;
  END IF;

  SELECT uag.group_id
  INTO preferred_group_id
  FROM public.user_active_group uag
  JOIN public.group_members gm
    ON gm.group_id = uag.group_id
   AND gm.user_id = uag.user_id
  WHERE uag.user_id = requester
  LIMIT 1;

  resolved_group_id := COALESCE(preferred_group_id, fallback_group_id);

  INSERT INTO public.user_active_group (user_id, group_id)
  VALUES (requester, resolved_group_id)
  ON CONFLICT (user_id)
  DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = now();

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    gm.role,
    g.id = resolved_group_id AS is_active
  FROM public.group_members gm
  JOIN public.management_groups g
    ON g.id = gm.group_id
  WHERE gm.user_id = requester
  ORDER BY
    CASE WHEN g.id = resolved_group_id THEN 0 ELSE 1 END,
    gm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_group_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_active_group_for_current_user(_group_id uuid)
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
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = requester
      AND gm.group_id = _group_id
  ) THEN
    RAISE EXCEPTION 'not_group_member';
  END IF;

  INSERT INTO public.user_active_group (user_id, group_id)
  VALUES (requester, _group_id)
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
  WHERE g.id = _group_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_group_for_current_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_active_group_for_current_user()
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  role public.group_role
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ctx.group_id,
    ctx.name,
    ctx.description,
    ctx.role
  FROM public.get_my_group_context() ctx
  WHERE ctx.is_active
  LIMIT 1;
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

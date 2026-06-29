-- Resolve and activate the current user's group in one transaction.
-- This avoids client-side redirect loops right after an admin approves a request.

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
    RETURN;
  END IF;

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

  IF _group_id IS NULL OR public.is_group_member(requester, _group_id) IS NOT TRUE THEN
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

GRANT EXECUTE ON FUNCTION public.ensure_active_group_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_group_for_current_user(uuid) TO authenticated;

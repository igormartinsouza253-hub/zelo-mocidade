-- Allow group members to see basic profiles of users in their active group (for DM user list)
-- This keeps existing admin-only global access, but adds a constrained path.

DROP POLICY IF EXISTS "Group members can view profiles in active group" ON public.profiles;
CREATE POLICY "Group members can view profiles in active group"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = profiles.id
      AND gm.group_id = public.current_group_id(auth.uid())
      AND public.is_group_member(auth.uid(), gm.group_id)
  )
);

-- RPC to compute unread chat count for header badge
CREATE OR REPLACE FUNCTION public.unread_chat_count(_user_id uuid, _group_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.cnt), 0)::int
  FROM (
    SELECT COUNT(*)::int AS cnt
    FROM public.chat_conversations c
    JOIN public.chat_members cm
      ON cm.conversation_id = c.id AND cm.user_id = _user_id
    LEFT JOIN public.chat_reads r
      ON r.conversation_id = c.id AND r.user_id = _user_id
    JOIN public.chat_messages m
      ON m.conversation_id = c.id
    WHERE c.group_id = _group_id
      AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
      AND m.user_id <> _user_id
  ) x;
$$;

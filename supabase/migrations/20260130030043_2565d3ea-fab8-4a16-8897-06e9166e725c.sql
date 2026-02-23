-- 1) Ensure trigger exists to create default group chat on new groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_handle_new_management_group'
  ) THEN
    CREATE TRIGGER trg_handle_new_management_group
    AFTER INSERT ON public.management_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_management_group();
  END IF;
END $$;

-- 2) Allow regular group members to self-join GROUP conversations (only themselves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_members'
      AND policyname = 'Group members can join group chats themselves'
  ) THEN
    CREATE POLICY "Group members can join group chats themselves"
    ON public.chat_members
    FOR INSERT
    WITH CHECK (
      -- only allow inserting your own membership
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1
        FROM public.chat_conversations c
        WHERE c.id = chat_members.conversation_id
          AND c.kind = 'group'
          AND c.group_id IS NOT NULL
          AND public.is_group_member(auth.uid(), c.group_id)
      )
    );
  END IF;
END $$;

-- 3) Backfill: ensure each group has a 'Geral' group chat
WITH missing AS (
  SELECT g.id AS group_id, g.created_by
  FROM public.management_groups g
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.group_id = g.id
      AND c.kind = 'group'
      AND COALESCE(c.title, '') = 'Geral'
  )
), inserted AS (
  INSERT INTO public.chat_conversations (kind, group_id, created_by, title)
  SELECT 'group', m.group_id, m.created_by, 'Geral'
  FROM missing m
  RETURNING id, group_id
)
INSERT INTO public.chat_members (conversation_id, user_id)
SELECT i.id, gm.user_id
FROM inserted i
JOIN public.group_members gm
  ON gm.group_id = i.group_id
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 4) Backfill: ensure all current group members are in the existing 'Geral' chat
WITH geral AS (
  SELECT c.id AS conversation_id, c.group_id
  FROM public.chat_conversations c
  WHERE c.kind = 'group'
    AND c.group_id IS NOT NULL
    AND COALESCE(c.title, '') = 'Geral'
)
INSERT INTO public.chat_members (conversation_id, user_id)
SELECT g.conversation_id, gm.user_id
FROM geral g
JOIN public.group_members gm
  ON gm.group_id = g.group_id
ON CONFLICT (conversation_id, user_id) DO NOTHING;
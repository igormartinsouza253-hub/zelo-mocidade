-- Fix DM creation: allow creator to read conversations they created (needed for INSERT ... SELECT roundtrip)
-- Replace the existing SELECT policy on chat_conversations with a creator-safe variant.
DO $$
BEGIN
  -- Drop existing policy if present
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_conversations'
      AND policyname = 'Users can view conversations they belong to'
  ) THEN
    DROP POLICY "Users can view conversations they belong to" ON public.chat_conversations;
  END IF;

  -- Recreate with creator access + membership access
  CREATE POLICY "Users can view conversations they belong to"
  ON public.chat_conversations
  FOR SELECT
  USING (
    (
      -- Group conversations are visible to group members
      (kind = 'group'::chat_kind)
      AND (group_id IS NOT NULL)
      AND public.is_group_member(auth.uid(), group_id)
    )
    OR
    (
      -- DMs (and any other) visible to members
      EXISTS (
        SELECT 1
        FROM public.chat_members cm
        WHERE cm.conversation_id = chat_conversations.id
          AND cm.user_id = auth.uid()
      )
    )
    OR
    (
      -- IMPORTANT: creator must be able to read the row immediately after creation
      auth.uid() = created_by
    )
  );
END $$;
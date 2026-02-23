-- Enable edit/delete on chat_messages and add metadata columns
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- RLS: allow members to update their own messages (edit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Users can edit their own messages'
  ) THEN
    CREATE POLICY "Users can edit their own messages"
    ON public.chat_messages
    FOR UPDATE
    USING (auth.uid() = user_id AND is_chat_member(conversation_id, auth.uid()))
    WITH CHECK (auth.uid() = user_id AND is_chat_member(conversation_id, auth.uid()));
  END IF;
END$$;

-- RLS: allow members to delete their own messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Users can delete their own chat messages'
  ) THEN
    CREATE POLICY "Users can delete their own chat messages"
    ON public.chat_messages
    FOR DELETE
    USING (auth.uid() = user_id AND is_chat_member(conversation_id, auth.uid()));
  END IF;
END$$;
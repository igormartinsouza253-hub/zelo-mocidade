-- Poll votes table (per message)
CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_poll_votes_message_id_idx ON public.chat_poll_votes (message_id);
CREATE INDEX IF NOT EXISTS chat_poll_votes_user_id_idx ON public.chat_poll_votes (user_id);

ALTER TABLE public.chat_poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS: only members of the conversation that contains the message can read votes
CREATE POLICY "Members can view poll votes"
ON public.chat_poll_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_poll_votes.message_id
      AND public.is_chat_member(m.conversation_id, auth.uid())
  )
);

-- Users can upsert their own vote if they are member of the conversation
CREATE POLICY "Users can insert own poll vote"
ON public.chat_poll_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_poll_votes.message_id
      AND public.is_chat_member(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can update own poll vote"
ON public.chat_poll_votes
FOR UPDATE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_poll_votes.message_id
      AND public.is_chat_member(m.conversation_id, auth.uid())
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_poll_votes.message_id
      AND public.is_chat_member(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can delete own poll vote"
ON public.chat_poll_votes
FOR DELETE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    WHERE m.id = chat_poll_votes.message_id
      AND public.is_chat_member(m.conversation_id, auth.uid())
  )
);

-- updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_chat_poll_votes_updated_at ON public.chat_poll_votes;
CREATE TRIGGER update_chat_poll_votes_updated_at
BEFORE UPDATE ON public.chat_poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_poll_votes;
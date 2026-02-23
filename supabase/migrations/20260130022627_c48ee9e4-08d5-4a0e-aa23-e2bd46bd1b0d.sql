-- 1) Ensure chat conversations can be scoped to a group for DMs (already supported by nullable group_id)
-- We'll enforce via RLS policies below.

-- 2) Add message typing + media metadata (keeps backward compatibility)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text NULL,
  ADD COLUMN IF NOT EXISTS mime_type text NULL,
  ADD COLUMN IF NOT EXISTS file_name text NULL,
  ADD COLUMN IF NOT EXISTS duration_ms integer NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_at
  ON public.chat_messages (conversation_id, created_at);

-- 3) Track per-user read state (for unread badge)
CREATE TABLE IF NOT EXISTS public.chat_reads (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own read state (and only for conversations they belong to)
DROP POLICY IF EXISTS "Users can view their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can view their own chat read state"
ON public.chat_reads
FOR SELECT
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.conversation_id = chat_reads.conversation_id
      AND cm.user_id = auth.uid()
  )
);

-- Users can upsert their own read state (only for conversations they belong to)
DROP POLICY IF EXISTS "Users can upsert their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can upsert their own chat read state"
ON public.chat_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.conversation_id = chat_reads.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can update their own chat read state"
ON public.chat_reads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.conversation_id = chat_reads.conversation_id
      AND cm.user_id = auth.uid()
  )
);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_chat_reads_updated_at ON public.chat_reads;
CREATE TRIGGER trg_chat_reads_updated_at
BEFORE UPDATE ON public.chat_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Fix/replace RLS policies for chat_conversations/chat_members that currently have incorrect join predicates

-- chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversations they belong to" ON public.chat_conversations;
CREATE POLICY "Users can view conversations they belong to"
ON public.chat_conversations
FOR SELECT
USING (
  -- Group chat: any member of the group
  (kind = 'group'::public.chat_kind AND group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
  OR
  -- DM: must be a member of the conversation
  EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.conversation_id = chat_conversations.id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create group conversations" ON public.chat_conversations;
CREATE POLICY "Users can create conversations"
ON public.chat_conversations
FOR INSERT
WITH CHECK (
  -- Group chat: allow group members to create (keeps previous intent)
  (
    kind = 'group'::public.chat_kind
    AND group_id IS NOT NULL
    AND public.is_group_member(auth.uid(), group_id)
    AND auth.uid() = created_by
  )
  OR
  -- DM scoped to group: creator must be group member
  (
    kind = 'dm'::public.chat_kind
    AND group_id IS NOT NULL
    AND public.is_group_member(auth.uid(), group_id)
    AND auth.uid() = created_by
  )
);

-- chat_members
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversation members when they are in the conver" ON public.chat_members;
CREATE POLICY "Users can view conversation members when they are in the conversation"
ON public.chat_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_members self
    WHERE self.conversation_id = chat_members.conversation_id
      AND self.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can add members to group chats; creators can add to dm" ON public.chat_members;
CREATE POLICY "Members can be added respecting group"
ON public.chat_members
FOR INSERT
WITH CHECK (
  -- Group chat: only group admins can add
  EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = chat_members.conversation_id
      AND c.kind = 'group'::public.chat_kind
      AND c.group_id IS NOT NULL
      AND public.is_group_admin(auth.uid(), c.group_id)
      AND public.is_group_member(chat_members.user_id, c.group_id)
  )
  OR
  -- DM: creator can add, but both users must be members of the same group_id
  EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = chat_members.conversation_id
      AND c.kind = 'dm'::public.chat_kind
      AND c.group_id IS NOT NULL
      AND c.created_by = auth.uid()
      AND public.is_group_member(auth.uid(), c.group_id)
      AND public.is_group_member(chat_members.user_id, c.group_id)
  )
);

-- 5) Storage bucket for chat media
-- Create bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects (bucket chat-media)
-- Allow group members to read objects in their group folder
DROP POLICY IF EXISTS "Group members can read chat media" ON storage.objects;
CREATE POLICY "Group members can read chat media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Allow group members to upload to their own user folder within group
DROP POLICY IF EXISTS "Group members can upload chat media" ON storage.objects;
CREATE POLICY "Group members can upload chat media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] IS NOT NULL
  AND ((storage.foldername(name))[2]) = auth.uid()::text
  AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Allow owners to update/delete their own objects; admins can delete within group
DROP POLICY IF EXISTS "Owners can update chat media" ON storage.objects;
CREATE POLICY "Owners can update chat media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners/admins can delete chat media" ON storage.objects;
CREATE POLICY "Owners/admins can delete chat media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat-media'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND public.is_group_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

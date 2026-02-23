-- Fix: infinite recursion in RLS policy for public.chat_members
-- Root cause: chat_members SELECT policy queried chat_members itself.
-- Solution: use a SECURITY DEFINER helper with row_security = off, then reference it in policies.

BEGIN;

-- Helper: check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_chat_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.conversation_id = _conversation_id
      AND cm.user_id = _user_id
  );
$$;

-- Replace recursive policy on chat_members
DROP POLICY IF EXISTS "Users can view conversation members when they are in the conver" ON public.chat_members;
CREATE POLICY "Users can view conversation members when member"
ON public.chat_members
FOR SELECT
USING (public.is_chat_member(chat_members.conversation_id, auth.uid()));

-- (Optional hardening) Recreate chat_messages policies to use the same helper
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
USING (public.is_chat_member(chat_messages.conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversations"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_member(chat_messages.conversation_id, auth.uid())
);

-- Ensure chat_reads also uses helper (prevents depending on chat_members policy shape)
DROP POLICY IF EXISTS "Users can view their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can view their own chat read state"
ON public.chat_reads
FOR SELECT
USING (
  auth.uid() = user_id
  AND public.is_chat_member(chat_reads.conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can upsert their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can upsert their own chat read state"
ON public.chat_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_member(chat_reads.conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own chat read state" ON public.chat_reads;
CREATE POLICY "Users can update their own chat read state"
ON public.chat_reads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_member(chat_reads.conversation_id, auth.uid())
);

COMMIT;
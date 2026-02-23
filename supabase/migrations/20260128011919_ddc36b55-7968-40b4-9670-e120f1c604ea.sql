-- Fix RLS to allow authenticated users to create management groups
-- (keeps ownership constraint: created_by must be the logged-in user)

DROP POLICY IF EXISTS "Approved users can create groups" ON public.management_groups;

CREATE POLICY "Authenticated users can create groups"
ON public.management_groups
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

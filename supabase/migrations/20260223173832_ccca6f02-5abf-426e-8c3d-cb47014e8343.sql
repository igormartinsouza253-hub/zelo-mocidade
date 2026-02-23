-- Allow group members to delete presencas (required for editing meetings)
DROP POLICY IF EXISTS "Group members can delete presencas" ON public.presencas;
CREATE POLICY "Group members can delete presencas"
ON public.presencas
FOR DELETE
USING ((group_id IS NOT NULL) AND is_group_member(auth.uid(), group_id));
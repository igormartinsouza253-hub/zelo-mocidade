-- Add inactivation fields to membros
ALTER TABLE public.membros
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS inativado_em timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS inativado_motivo text NULL,
ADD COLUMN IF NOT EXISTS inativado_observacao text NULL;

-- Snapshot fields on presencas to keep historical data
ALTER TABLE public.presencas
ADD COLUMN IF NOT EXISTS membro_nome text NULL,
ADD COLUMN IF NOT EXISTS membro_faixa_etaria text NULL,
ADD COLUMN IF NOT EXISTS membro_cargos text[] NULL;

-- History log for member edits/inactivation
CREATE TABLE IF NOT EXISTS public.member_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  group_id uuid NULL,
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'update' | 'inactivate' | 'reactivate'
  reason text NULL,
  note text NULL,
  before jsonb NULL,
  after jsonb NULL,
  effective_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.member_edit_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: group members can view history for their group
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_edit_history'
      AND policyname = 'Group members can view member edit history'
  ) THEN
    CREATE POLICY "Group members can view member edit history"
    ON public.member_edit_history
    FOR SELECT
    USING (
      (group_id IS NOT NULL)
      AND is_group_member(auth.uid(), group_id)
    );
  END IF;

  -- INSERT: group members can create history entries for their group, only for themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_edit_history'
      AND policyname = 'Group members can insert member edit history'
  ) THEN
    CREATE POLICY "Group members can insert member edit history"
    ON public.member_edit_history
    FOR INSERT
    WITH CHECK (
      (group_id IS NOT NULL)
      AND is_group_member(auth.uid(), group_id)
      AND (auth.uid() = user_id)
    );
  END IF;
END$$;
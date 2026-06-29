-- Cargo names must be unique only inside the same management group.
-- The legacy unique constraint on nome caused conflicts between different groups.

ALTER TABLE public.cargos
DROP CONSTRAINT IF EXISTS cargos_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS cargos_group_id_nome_key
ON public.cargos (group_id, lower(nome))
WHERE group_id IS NOT NULL;

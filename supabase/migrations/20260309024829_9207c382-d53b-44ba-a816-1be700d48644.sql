-- Add creator tracking columns
ALTER TABLE public.reunioes
ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

ALTER TABLE public.membros
ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

-- Helpful indexes for profile join in detail screens
CREATE INDEX IF NOT EXISTS idx_reunioes_created_by_user_id ON public.reunioes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_membros_created_by_user_id ON public.membros(created_by_user_id);

-- Auto-fill creator on insert when not provided
CREATE OR REPLACE FUNCTION public.set_created_by_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reunioes_set_created_by_user_id ON public.reunioes;
CREATE TRIGGER trg_reunioes_set_created_by_user_id
BEFORE INSERT ON public.reunioes
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by_user_id();

DROP TRIGGER IF EXISTS trg_membros_set_created_by_user_id ON public.membros;
CREATE TRIGGER trg_membros_set_created_by_user_id
BEFORE INSERT ON public.membros
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by_user_id();
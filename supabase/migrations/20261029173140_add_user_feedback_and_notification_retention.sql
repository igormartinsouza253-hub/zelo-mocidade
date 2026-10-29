CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NULL REFERENCES public.management_groups(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('idea', 'bug', 'other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 12 AND 4000),
  reproduction_steps text NULL CHECK (reproduction_steps IS NULL OR char_length(reproduction_steps) <= 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id, created_at DESC);
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_user_feedback_updated_at ON public.user_feedback;
CREATE TRIGGER update_user_feedback_updated_at BEFORE UPDATE ON public.user_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP POLICY IF EXISTS "Users and super admins can view feedback" ON public.user_feedback;
CREATE POLICY "Users and super admins can view feedback" ON public.user_feedback FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (auth.jwt() -> 'app_metadata' ->> 'super_admin') = 'true');
DROP POLICY IF EXISTS "Super admins can update feedback" ON public.user_feedback;
CREATE POLICY "Super admins can update feedback" ON public.user_feedback FOR UPDATE TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'super_admin') = 'true')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'super_admin') = 'true');
REVOKE ALL ON public.user_feedback FROM anon;
GRANT SELECT, UPDATE ON public.user_feedback TO authenticated;

-- Limpeza inicial e recorrente das notificações com mais de 90 dias.
DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
DO $$
DECLARE existing_job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'zelo-prune-old-notifications' LIMIT 1;
    IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
    PERFORM cron.schedule('zelo-prune-old-notifications', '17 4 * * 0',
      $job$DELETE FROM public.notifications WHERE created_at < now() - interval '90 days'$job$);
  END IF;
END;
$$;

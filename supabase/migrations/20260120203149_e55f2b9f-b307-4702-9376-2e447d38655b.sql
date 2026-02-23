-- Add prayer-leader flag to attendance records
ALTER TABLE public.presencas
ADD COLUMN IF NOT EXISTS orou boolean NOT NULL DEFAULT false;

-- Helpful index for filtering/reporting (optional)
CREATE INDEX IF NOT EXISTS idx_presencas_reuniao_orou ON public.presencas (reuniao_id, orou);
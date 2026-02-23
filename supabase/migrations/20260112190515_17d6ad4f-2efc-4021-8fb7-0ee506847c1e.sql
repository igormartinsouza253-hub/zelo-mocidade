-- Create visitas table to track member visits
CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- When the visit is/was scheduled; nullable for future visits not yet scheduled
  data_visita timestamptz,
  -- Member that is/was visited
  membro_visitado_id uuid NOT NULL,
  -- Short reason for the visit
  motivo text NOT NULL,
  -- Members who participated in the visit (list of member IDs)
  membros_presentes uuid[] NOT NULL DEFAULT '{}'::uuid[],
  -- Additional notes
  observacoes text,
  -- Whether this represents a past visit (completed) or a future/planned one
  is_past boolean NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Approved users can manage visits
CREATE POLICY "Usuarios aprovados podem gerenciar visitas"
ON public.visitas
FOR ALL
USING (is_approved_user(auth.uid()))
WITH CHECK (is_approved_user(auth.uid()));

-- Optional: index for faster lookups by visited member
CREATE INDEX IF NOT EXISTS idx_visitas_membro_visitado
  ON public.visitas (membro_visitado_id);

-- Add optional linking fields for scheduled visits in Agenda
ALTER TABLE public.eventos
ADD COLUMN IF NOT EXISTS membro_visitado_id uuid NULL,
ADD COLUMN IF NOT EXISTS visita_id uuid NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_eventos_membro_visitado_id ON public.eventos(membro_visitado_id);
CREATE INDEX IF NOT EXISTS idx_eventos_visita_id ON public.eventos(visita_id);
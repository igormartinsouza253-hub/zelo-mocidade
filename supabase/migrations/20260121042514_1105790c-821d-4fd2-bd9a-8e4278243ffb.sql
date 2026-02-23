-- Criar tabela de eventos (ajuntamentos, saídas, visitas)
CREATE TABLE public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ajuntamento', 'saida', 'visita')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  local TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT false,
  recorrencia JSONB, -- {tipo: 'semanal'|'mensal', intervalo: number, dias_semana: [0-6], excecoes: ['YYYY-MM-DD']}
  lembretes JSONB, -- [{tipo: 'minutos'|'horas'|'dias', valor: number}]
  participantes UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT data_fim_apos_inicio CHECK (data_fim > data_inicio)
);

-- Índices para melhor performance
CREATE INDEX idx_eventos_user_id ON public.eventos(user_id);
CREATE INDEX idx_eventos_tipo ON public.eventos(tipo);
CREATE INDEX idx_eventos_data_inicio ON public.eventos(data_inicio);
CREATE INDEX idx_eventos_data_fim ON public.eventos(data_fim);

-- Habilitar RLS
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários aprovados podem CRUD seus próprios eventos
CREATE POLICY "Usuários aprovados podem visualizar eventos"
ON public.eventos
FOR SELECT
USING (is_approved_user(auth.uid()));

CREATE POLICY "Usuários aprovados podem criar eventos"
ON public.eventos
FOR INSERT
WITH CHECK (is_approved_user(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios eventos"
ON public.eventos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios eventos"
ON public.eventos
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_eventos_updated_at
BEFORE UPDATE ON public.eventos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  birthdays_enabled boolean NOT NULL DEFAULT true,
  notes_enabled boolean NOT NULL DEFAULT true,
  chat_enabled boolean NOT NULL DEFAULT true,
  group_requests_enabled boolean NOT NULL DEFAULT true,
  events_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  dedupe_key text NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON public.notifications (user_id, read_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_dedupe
ON public.notifications (user_id, dedupe_key)
WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_notification_type_enabled(_user_id uuid, _type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref public.notification_preferences;
BEGIN
  SELECT * INTO pref
  FROM public.notification_preferences np
  WHERE np.user_id = _user_id;

  IF pref.user_id IS NULL THEN
    RETURN true;
  END IF;

  IF pref.enabled IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN CASE _type
    WHEN 'birthday' THEN pref.birthdays_enabled
    WHEN 'note_created' THEN pref.notes_enabled
    WHEN 'chat_message' THEN pref.chat_enabled
    WHEN 'group_join_request' THEN pref.group_requests_enabled
    WHEN 'event_created' THEN pref.events_enabled
    ELSE true
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_notification(
  _recipient_user_id uuid,
  _group_id uuid,
  _type text,
  _title text,
  _message text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _dedupe_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _recipient_user_id IS NULL THEN
    RETURN;
  END IF;

  IF public.is_notification_type_enabled(_recipient_user_id, _type) IS NOT TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    group_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  ) VALUES (
    _recipient_user_id,
    _group_id,
    _type,
    _title,
    _message,
    _entity_type,
    _entity_id,
    COALESCE(_metadata, '{}'::jsonb),
    _dedupe_key
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_note_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name text;
  recipient record;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.username, 'Usuário')
  INTO author_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  FOR recipient IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      NEW.group_id,
      'note_created',
      'Nova nota criada',
      author_name || ' criou uma nova nota no grupo.',
      'nota',
      NEW.id,
      jsonb_build_object('author_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_note_created ON public.notas;
CREATE TRIGGER trg_notify_note_created
AFTER INSERT ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.notify_note_created();

CREATE OR REPLACE FUNCTION public.notify_event_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name text;
  recipient record;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.username, 'Usuário')
  INTO author_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  FOR recipient IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      NEW.group_id,
      'event_created',
      'Novo evento criado',
      author_name || ' criou o evento "' || COALESCE(NEW.titulo, 'Sem título') || '".',
      'evento',
      NEW.id,
      jsonb_build_object('author_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_created ON public.eventos;
CREATE TRIGGER trg_notify_event_created
AFTER INSERT ON public.eventos
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_created();

CREATE OR REPLACE FUNCTION public.notify_chat_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name text;
  conv_group_id uuid;
  conv_kind public.chat_kind;
  preview_text text;
  recipient record;
BEGIN
  SELECT c.group_id, c.kind
  INTO conv_group_id, conv_kind
  FROM public.chat_conversations c
  WHERE c.id = NEW.conversation_id;

  IF conv_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.username, 'Usuário')
  INTO author_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  preview_text := CASE COALESCE(NEW.message_type, 'text')
    WHEN 'text' THEN left(regexp_replace(COALESCE(NEW.content, ''), E'\n+', ' ', 'g'), 90)
    WHEN 'image' THEN 'enviou uma imagem.'
    WHEN 'audio' THEN 'enviou um áudio.'
    WHEN 'poll' THEN 'enviou uma enquete.'
    ELSE 'enviou uma mensagem.'
  END;

  FOR recipient IN
    SELECT cm.user_id
    FROM public.chat_members cm
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      conv_group_id,
      'chat_message',
      CASE WHEN conv_kind = 'dm' THEN 'Nova mensagem privada' ELSE 'Nova mensagem no chat' END,
      CASE
        WHEN COALESCE(NEW.message_type, 'text') = 'text' THEN author_name || ': ' || preview_text
        ELSE author_name || ' ' || preview_text
      END,
      'chat_message',
      NEW.id,
      jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message_created ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_message_created
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_message_created();

CREATE OR REPLACE FUNCTION public.notify_group_join_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_name text;
  recipient record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.username, 'Usuário')
  INTO requester_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  FOR recipient IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.role = 'admin'
      AND gm.user_id <> NEW.user_id
  LOOP
    PERFORM public.create_user_notification(
      recipient.user_id,
      NEW.group_id,
      'group_join_request',
      'Nova solicitação de acesso',
      requester_name || ' solicitou entrada no grupo.',
      'group_join_request',
      NEW.id,
      jsonb_build_object('request_user_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_join_request_created ON public.group_join_requests;
CREATE TRIGGER trg_notify_group_join_request_created
AFTER INSERT ON public.group_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_group_join_request_created();

CREATE OR REPLACE FUNCTION public.generate_today_birthday_notifications(_group_id uuid, _recipient_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_key text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'MM-DD');
  today_label text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'DD/MM/YYYY');
  names text;
  total_count integer := 0;
  summary text;
BEGIN
  IF _group_id IS NULL OR _recipient_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.is_group_member(_recipient_user_id, _group_id) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*), string_agg(m.nome, ', ' ORDER BY m.nome)
  INTO total_count, names
  FROM public.membros m
  WHERE m.group_id = _group_id
    AND m.ativo IS TRUE
    AND m.data_aniversario = today_key;

  IF total_count = 0 THEN
    RETURN 0;
  END IF;

  summary := CASE
    WHEN total_count = 1 THEN 'Hoje é aniversário de ' || names || '.'
    ELSE 'Aniversariantes de hoje: ' || names || '.'
  END;

  PERFORM public.create_user_notification(
    _recipient_user_id,
    _group_id,
    'birthday',
    'Aniversariantes de hoje',
    summary,
    'birthday',
    NULL,
    jsonb_build_object('date', today_label, 'count', total_count),
    'birthday:' || _group_id::text || ':' || today_key || ':' || _recipient_user_id::text
  );

  RETURN total_count;
END;
$$;
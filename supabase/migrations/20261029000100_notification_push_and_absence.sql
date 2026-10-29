ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS absences_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id ON public.notification_devices(user_id);
ALTER TABLE public.notification_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notification devices" ON public.notification_devices;
CREATE POLICY "Users can manage own notification devices" ON public.notification_devices
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notification_push_queue (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.notification_push_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_push_queue FROM anon, authenticated;

DO $$
DECLARE existing_job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'zelo-dispatch-notification-push' LIMIT 1;
    IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
    EXECUTE $schedule$
      SELECT cron.schedule(
        'zelo-dispatch-notification-push',
        '* * * * *',
        $job$
          SELECT net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zelo_push_dispatch_url' LIMIT 1),
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-zelo-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zelo_push_dispatch_secret' LIMIT 1)
            ),
            body := '{}'::jsonb
          );
        $job$
      );
    $schedule$;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.enqueue_notification_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_push_queue (notification_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enqueue_notification_push ON public.notifications;
CREATE TRIGGER trg_enqueue_notification_push AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push();

CREATE OR REPLACE FUNCTION public.is_notification_type_enabled(_user_id uuid, _type text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pref public.notification_preferences;
BEGIN
  SELECT * INTO pref FROM public.notification_preferences np WHERE np.user_id = _user_id;
  IF pref.user_id IS NULL THEN RETURN true; END IF;
  IF pref.enabled IS NOT TRUE THEN RETURN false; END IF;
  RETURN CASE _type
    WHEN 'birthday' THEN pref.birthdays_enabled
    WHEN 'note_created' THEN pref.notes_enabled
    WHEN 'chat_message' THEN pref.chat_enabled
    WHEN 'group_join_request' THEN pref.group_requests_enabled
    WHEN 'event_created' THEN pref.events_enabled
    WHEN 'absence_milestone' THEN pref.absences_enabled
    WHEN 'absence_summary' THEN pref.absences_enabled
    ELSE true
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_today_birthday_notifications(_group_id uuid, _recipient_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  today_key text := to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'MM-DD');
  birthday record;
  total_count integer := 0;
BEGIN
  IF _group_id IS NULL OR _recipient_user_id IS NULL OR NOT public.is_group_member(_recipient_user_id, _group_id) THEN RETURN 0; END IF;
  FOR birthday IN
    SELECT m.id, m.nome, m.foto_url
    FROM public.membros m
    WHERE m.group_id = _group_id AND m.ativo IS TRUE
      AND (m.data_aniversario = today_key OR to_char(m.data_nascimento, 'MM-DD') = today_key)
    ORDER BY m.nome
  LOOP
    PERFORM public.create_user_notification(
      _recipient_user_id, _group_id, 'birthday', 'Hoje é aniversário de ' || birthday.nome || '! 🎂',
      'Vamos celebrar esse dia especial! Abra o perfil de ' || birthday.nome || ' e deixe uma mensagem carinhosa para tornar a comemoração ainda mais feliz.',
      'birthday', birthday.id,
      jsonb_build_object('date', to_char(today_date, 'DD/MM/YYYY'), 'member_id', birthday.id, 'member_name', birthday.nome, 'photo_url', birthday.foto_url),
      'birthday:' || _group_id::text || ':' || today_key || ':' || birthday.id::text || ':' || _recipient_user_id::text
    );
    total_count := total_count + 1;
  END LOOP;
  RETURN total_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_absence_notifications(_group_id uuid, _recipient_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  attendance record;
  absence_count integer := 0;
  total_alerts integer := 0;
  alert_names text[] := ARRAY[]::text[];
  alert_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _group_id IS NULL OR _recipient_user_id IS NULL OR NOT public.is_group_member(_recipient_user_id, _group_id) THEN RETURN 0; END IF;
  FOR attendance IN
    SELECT m.id, m.nome,
      count(*) FILTER (WHERE p.id IS NULL)::integer AS consecutive_absences
    FROM public.membros m
    JOIN public.reunioes r ON r.group_id = m.group_id
    LEFT JOIN public.presencas p ON p.reuniao_id = r.id AND p.membro_id = m.id
    WHERE m.group_id = _group_id AND m.ativo IS TRUE
      AND r.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND NOT EXISTS (
        SELECT 1 FROM public.presencas recent_presence
        JOIN public.reunioes recent_meeting ON recent_meeting.id = recent_presence.reuniao_id
        WHERE recent_presence.membro_id = m.id AND recent_meeting.group_id = _group_id
          AND recent_meeting.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND recent_meeting.data > r.data
      )
    GROUP BY m.id, m.nome
    HAVING count(*) FILTER (WHERE p.id IS NULL) > 0
       AND count(*) FILTER (WHERE p.id IS NOT NULL) = 0
  LOOP
    IF attendance.consecutive_absences % 3 = 0 THEN
      alert_names := array_append(alert_names, attendance.nome);
      alert_ids := array_append(alert_ids, attendance.id);
      total_alerts := total_alerts + 1;
    END IF;
  END LOOP;

  IF cardinality(alert_names) <= 2 THEN
    FOR attendance IN SELECT m.id, m.nome, m.consecutive_absences FROM (
      SELECT m.id, m.nome, count(*) FILTER (WHERE p.id IS NULL)::integer AS consecutive_absences,
        count(*) FILTER (WHERE p.id IS NOT NULL) AS attended_count
      FROM public.membros m JOIN public.reunioes r ON r.group_id=m.group_id
      LEFT JOIN public.presencas p ON p.reuniao_id=r.id AND p.membro_id=m.id
      WHERE m.group_id=_group_id AND m.ativo IS TRUE AND r.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND NOT EXISTS (SELECT 1 FROM public.presencas rp JOIN public.reunioes rr ON rr.id=rp.reuniao_id WHERE rp.membro_id=m.id AND rr.group_id=_group_id AND rr.data <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AND rr.data>r.data)
      GROUP BY m.id,m.nome
    ) m WHERE m.attended_count=0 AND m.consecutive_absences>=3 AND m.consecutive_absences%3=0
    LOOP
      PERFORM public.create_user_notification(
        _recipient_user_id, _group_id, 'absence_milestone', attendance.nome || ' faltou às últimas 3 reuniões de jovens',
        'Já são ' || attendance.consecutive_absences::text || ' reuniões seguidas sem a presença de ' || attendance.nome || '. Vale verificar se está tudo bem e enviar uma mensagem de apoio.',
        'absence_milestone', attendance.id,
        jsonb_build_object('member_id', attendance.id, 'member_name', attendance.nome, 'consecutive_absences', attendance.consecutive_absences),
        'absence:' || _group_id::text || ':' || attendance.id::text || ':' || attendance.consecutive_absences::text
      );
    END LOOP;
    IF cardinality(alert_ids) > 0 THEN
      DELETE FROM public.notifications
      WHERE user_id = _recipient_user_id AND group_id = _group_id
        AND type = 'absence_summary'
        AND dedupe_key LIKE 'absence-summary:' || _group_id::text || ':%';
    END IF;
  END IF;

  -- O resumo agrega alertas novos na execução atual.
  IF cardinality(alert_names) > 2 THEN
    SELECT coalesce(array_agg(DISTINCT m.nome ORDER BY m.nome), ARRAY[]::text[])
      INTO alert_names
      FROM public.membros m WHERE m.id = ANY(alert_ids);
    PERFORM public.create_user_notification(
      _recipient_user_id, _group_id, 'absence_summary', 'Acompanhe quem está sentindo falta das reuniões',
      'Mais de dois jovens chegaram a novos marcos de três faltas consecutivas. Confira a lista, veja o histórico e combine um contato acolhedor com cada um.',
      'absence_summary', NULL,
      jsonb_build_object('member_names', to_jsonb(alert_names), 'member_ids', to_jsonb(ARRAY(SELECT m.id FROM public.membros m WHERE m.id = ANY(alert_ids) ORDER BY m.nome)), 'count', cardinality(alert_names)),
      'absence-summary:' || _group_id::text || ':' || md5(array_to_string(alert_ids::text[], ','))
    );
  ELSIF cardinality(alert_ids) > 0 THEN
    DELETE FROM public.notifications
    WHERE user_id = _recipient_user_id AND group_id = _group_id
      AND type = 'absence_summary'
      AND dedupe_key LIKE 'absence-summary:' || _group_id::text || ':%';
  END IF;
  RETURN total_alerts;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_absence_milestones_after_meeting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient record;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  FOR recipient IN SELECT gm.user_id FROM public.group_members gm WHERE gm.group_id = NEW.group_id LOOP
    PERFORM public.generate_absence_notifications(NEW.group_id, recipient.user_id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_daily_birthday_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient record; generated integer := 0;
BEGIN
  FOR recipient IN
    SELECT gm.group_id, gm.user_id FROM public.group_members gm
  LOOP
    generated := generated + public.generate_today_birthday_notifications(recipient.group_id, recipient.user_id);
  END LOOP;
  RETURN generated;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_absence_milestones_after_meeting ON public.reunioes;
CREATE TRIGGER trg_notify_absence_milestones_after_meeting
AFTER INSERT OR UPDATE OF data ON public.reunioes
FOR EACH ROW EXECUTE FUNCTION public.notify_absence_milestones_after_meeting();

GRANT EXECUTE ON FUNCTION public.generate_absence_notifications(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_today_birthday_notifications(uuid, uuid) TO authenticated;

DO $$
DECLARE existing_job bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'zelo-generate-daily-birthdays' LIMIT 1;
    IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
    PERFORM cron.schedule('zelo-generate-daily-birthdays', '0 12 * * *', 'select public.generate_daily_birthday_notifications();');
  END IF;
END;
$$;

-- Notification creation must never block core workflows such as requesting access
-- to a management group. The previous ON CONFLICT target could fail against the
-- partial unique index when dedupe_key is null.

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

  IF _dedupe_key IS NULL THEN
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
      NULL
    );
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
  ON CONFLICT (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL
  DO NOTHING;
END;
$$;

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

  SELECT COALESCE(p.username, 'Usuario')
  INTO requester_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  requester_name := COALESCE(requester_name, 'Usuario');

  FOR recipient IN
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.role = 'admin'
      AND gm.user_id <> NEW.user_id
  LOOP
    BEGIN
      PERFORM public.create_user_notification(
        recipient.user_id,
        NEW.group_id,
        'group_join_request',
        'Nova solicitacao de acesso',
        requester_name || ' solicitou entrada no grupo.',
        'group_join_request',
        NEW.id,
        jsonb_build_object('request_user_id', NEW.user_id)
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to notify group join request % to recipient %: %', NEW.id, recipient.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_join_request_created ON public.group_join_requests;
CREATE TRIGGER trg_notify_group_join_request_created
AFTER INSERT ON public.group_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_group_join_request_created();

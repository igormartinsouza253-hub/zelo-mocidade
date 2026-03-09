CREATE OR REPLACE FUNCTION public.create_user_notification(
  _recipient_user_id uuid,
  _group_id uuid,
  _type text,
  _title text,
  _message text,
  _entity_type text DEFAULT NULL::text,
  _entity_id uuid DEFAULT NULL::uuid,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _dedupe_key text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ELSE
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
  END IF;
END;
$function$;
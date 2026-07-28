-- Snapshot completo, consistente e somente leitura para uso offline.
-- SECURITY INVOKER é intencional: todas as consultas continuam respeitando as RLS
-- e a visibilidade de notas do usuário autenticado.
create or replace function public.get_offline_group_snapshot(_group_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _result jsonb;
begin
  if _user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_group_member(_user_id, _group_id) then
    raise exception 'group access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'schema_version', 1,
    'synchronized_at', now(),
    'group_id', _group_id,
    'tables', jsonb_build_object(
      'management_groups', coalesce((
        select jsonb_agg(to_jsonb(row_data))
        from (
          select * from public.management_groups where id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'group_members', coalesce((
        select jsonb_agg(to_jsonb(row_data))
        from (
          select * from public.group_members where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'profiles', coalesce((
        select jsonb_agg(to_jsonb(row_data))
        from (
          select p.*
          from public.profiles p
          where p.id in (
            select gm.user_id from public.group_members gm where gm.group_id = _group_id
            union
            select n.user_id from public.notas n where n.group_id = _group_id
            union
            select n.updated_by from public.notas n where n.group_id = _group_id and n.updated_by is not null
            union
            select r.created_by_user_id from public.reunioes r where r.group_id = _group_id and r.created_by_user_id is not null
            union
            select m.created_by_user_id from public.membros m where m.group_id = _group_id and m.created_by_user_id is not null
          )
        ) row_data
      ), '[]'::jsonb),
      'membros', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.membros where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'member_edit_history', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.member_edit_history where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'cargos', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.cargos where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'reunioes', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.reunioes where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'presencas', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.presencas where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'visitas', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.visitas where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'eventos', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.eventos where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'notas', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.notas where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'note_comments', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.note_comments where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'note_versions', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.note_versions where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'group_user_presence', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.group_user_presence where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'group_join_requests', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.group_join_requests where group_id = _group_id
        ) row_data
      ), '[]'::jsonb),
      'notifications', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.notifications
          where user_id = _user_id and (group_id = _group_id or group_id is null)
        ) row_data
      ), '[]'::jsonb),
      'notification_preferences', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.notification_preferences where user_id = _user_id
        ) row_data
      ), '[]'::jsonb),
      'user_preferences', coalesce((
        select jsonb_agg(to_jsonb(row_data)) from (
          select * from public.user_preferences where user_id = _user_id
        ) row_data
      ), '[]'::jsonb)
    )
  )
  into _result;

  return _result;
end;
$$;

revoke all on function public.get_offline_group_snapshot(uuid) from public;
grant execute on function public.get_offline_group_snapshot(uuid) to authenticated;

comment on function public.get_offline_group_snapshot(uuid) is
  'Retorna dados autorizados de um grupo para um snapshot local offline somente leitura.';

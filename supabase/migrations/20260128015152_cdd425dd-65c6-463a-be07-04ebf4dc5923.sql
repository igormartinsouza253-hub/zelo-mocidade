-- Corrige fluxo de criação de grupo: garante criador como admin, seta grupo ativo e cria chat padrão no MESMO RPC
-- (evita depender de trigger que pode não existir)

CREATE OR REPLACE FUNCTION public.create_management_group(
  _name text,
  _description text,
  _password text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
declare
  gid uuid;
  hashed text;
  chat_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if _name is null or btrim(_name) = '' then
    raise exception 'invalid_name';
  end if;

  if _password is null or length(_password) < 4 then
    raise exception 'invalid_password';
  end if;

  hashed := extensions.crypt(_password, extensions.gen_salt('bf'));

  insert into public.management_groups (name, description, password_hash, created_by)
  values (btrim(_name), nullif(btrim(_description), ''), hashed, auth.uid())
  returning id into gid;

  -- garante criador como admin do grupo
  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'admin')
  on conflict (group_id, user_id)
  do update set role = 'admin';

  -- seta grupo ativo imediatamente (para não exigir refresh)
  insert into public.user_active_group (user_id, group_id)
  values (auth.uid(), gid)
  on conflict (user_id)
  do update set group_id = excluded.group_id, updated_at = now();

  -- cria chat padrão do grupo (Geral)
  insert into public.chat_conversations (kind, group_id, created_by, title)
  values ('group', gid, auth.uid(), 'Geral')
  returning id into chat_id;

  -- adiciona criador ao chat
  insert into public.chat_members (conversation_id, user_id)
  values (chat_id, auth.uid())
  on conflict (conversation_id, user_id) do nothing;

  return gid;
end;
$$;
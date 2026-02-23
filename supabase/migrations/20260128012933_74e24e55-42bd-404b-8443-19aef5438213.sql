-- 1) RPC segura para criar grupo (não depende de created_by vindo do client)
create or replace function public.create_management_group(
  _name text,
  _description text,
  _password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  gid uuid;
  hashed text;
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
  values (_name, nullif(btrim(_description), ''), hashed, auth.uid())
  returning id into gid;

  return gid;
end;
$$;

-- 2) Trigger que estava faltando: cria membership admin + chat padrão
-- Remove antes caso já exista com outro nome
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_handle_new_management_group'
  ) THEN
    DROP TRIGGER trg_handle_new_management_group ON public.management_groups;
  END IF;
END $$;

create trigger trg_handle_new_management_group
after insert on public.management_groups
for each row
execute function public.handle_new_management_group();

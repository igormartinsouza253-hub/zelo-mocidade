-- RPC para admin atualizar nome e descrição do grupo
create or replace function public.update_management_group_info(
  _group_id uuid,
  _name text,
  _description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_group_admin(auth.uid(), _group_id) then
    raise exception 'not_admin';
  end if;

  if _name is null or btrim(_name) = '' then
    raise exception 'invalid_name';
  end if;

  update public.management_groups
  set 
    name = btrim(_name),
    description = nullif(btrim(_description), ''),
    updated_at = now()
  where id = _group_id;
end;
$$;

-- RPC para admin atualizar senha do grupo
create or replace function public.update_management_group_password(
  _group_id uuid,
  _new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hashed text;
begin
  if not is_group_admin(auth.uid(), _group_id) then
    raise exception 'not_admin';
  end if;

  if _new_password is null or length(_new_password) < 4 then
    raise exception 'invalid_password';
  end if;

  hashed := extensions.crypt(_new_password, extensions.gen_salt('bf'));

  update public.management_groups
  set 
    password_hash = hashed,
    updated_at = now()
  where id = _group_id;
end;
$$;

-- RPC para transferir ownership do grupo (current admin -> new admin)
create or replace function public.transfer_group_ownership(
  _group_id uuid,
  _new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verificar se quem chama é o criador atual do grupo
  if not exists (
    select 1 from public.management_groups
    where id = _group_id and created_by = auth.uid()
  ) then
    raise exception 'not_creator';
  end if;

  -- Verificar se o novo dono é membro do grupo
  if not is_group_member(_new_owner_id, _group_id) then
    raise exception 'new_owner_not_member';
  end if;

  -- Transferir ownership
  update public.management_groups
  set 
    created_by = _new_owner_id,
    updated_at = now()
  where id = _group_id;

  -- Garantir que o novo dono seja admin
  insert into public.group_members (group_id, user_id, role)
  values (_group_id, _new_owner_id, 'admin')
  on conflict (group_id, user_id) 
  do update set role = 'admin';
end;
$$;
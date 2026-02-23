-- Auto-bootstrap creator as admin + create default group chat

create or replace function public.handle_new_management_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (group_id, user_id) do nothing;

  -- default group chat (general)
  insert into public.chat_conversations (kind, group_id, created_by, title)
  values ('group', new.id, new.created_by, 'Geral');

  -- add creator to the default chat
  insert into public.chat_members (conversation_id, user_id)
  select c.id, new.created_by
  from public.chat_conversations c
  where c.group_id = new.id and c.kind = 'group'
  order by c.created_at asc
  limit 1
  on conflict (conversation_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_management_group on public.management_groups;
create trigger trg_handle_new_management_group
after insert on public.management_groups
for each row execute function public.handle_new_management_group();

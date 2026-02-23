-- Grupo gestor + chat + isolamento por grupo (v2, corrigido)

-- 0) Extensions (pgcrypto lives in schema extensions in this environment)
create extension if not exists pgcrypto with schema extensions;

-- 1) Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'group_role') then
    create type public.group_role as enum ('admin', 'member');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'join_request_status') then
    create type public.join_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'chat_kind') then
    create type public.chat_kind as enum ('group', 'dm');
  end if;
end $$;

-- 2) Groups
create table public.management_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  password_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table public.management_groups enable row level security;

-- Public view WITHOUT password hash
create or replace view public.management_groups_public
with (security_invoker=on)
as
  select id, name, description, created_by, created_at, updated_at
  from public.management_groups;

-- CRITICAL: deny direct SELECT on base table to avoid exposing password_hash
create policy "No direct select on groups"
on public.management_groups
for select
using (false);

-- 3) Group memberships
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.management_groups(id) on delete cascade,
  user_id uuid not null,
  role public.group_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_group_members_group_id on public.group_members(group_id);
create index idx_group_members_user_id on public.group_members(user_id);

alter table public.group_members enable row level security;

-- 4) Join requests (senha + aprovação)
create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.management_groups(id) on delete cascade,
  user_id uuid not null,
  status public.join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (group_id, user_id)
);

create index idx_group_join_requests_group_id on public.group_join_requests(group_id);
create index idx_group_join_requests_user_id on public.group_join_requests(user_id);

alter table public.group_join_requests enable row level security;

-- 5) Active group per user
create table public.user_active_group (
  user_id uuid primary key,
  group_id uuid not null references public.management_groups(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index idx_user_active_group_group_id on public.user_active_group(group_id);

alter table public.user_active_group enable row level security;

-- 6) Chat
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_kind not null,
  group_id uuid references public.management_groups(id) on delete cascade,
  created_by uuid not null,
  title text,
  created_at timestamptz not null default now()
);

create index idx_chat_conversations_group_id on public.chat_conversations(group_id);

alter table public.chat_conversations enable row level security;

create table public.chat_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index idx_chat_members_user_id on public.chat_members(user_id);
create index idx_chat_members_conversation_id on public.chat_members(conversation_id);

alter table public.chat_members enable row level security;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_conversation_id_created_at on public.chat_messages(conversation_id, created_at);

alter table public.chat_messages enable row level security;

-- 7) Helper functions (security definer)
create or replace function public.is_group_member(_user_id uuid, _group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.user_id = _user_id
      and gm.group_id = _group_id
  )
$$;

create or replace function public.is_group_admin(_user_id uuid, _group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.user_id = _user_id
      and gm.group_id = _group_id
      and gm.role = 'admin'
  )
$$;

create or replace function public.current_group_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select uag.group_id
  from public.user_active_group uag
  where uag.user_id = _user_id
$$;

create or replace function public.check_group_password(_group_id uuid, _password text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.management_groups g
    where g.id = _group_id
      and g.password_hash = extensions.crypt(_password, g.password_hash)
  )
$$;

create or replace function public.hash_group_password(_password text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select extensions.crypt(_password, extensions.gen_salt('bf'))
$$;

-- 8) Updated_at triggers
create trigger trg_management_groups_updated_at
before update on public.management_groups
for each row execute function public.update_updated_at_column();

create trigger trg_user_active_group_updated_at
before update on public.user_active_group
for each row execute function public.update_updated_at_column();

-- 9) RLS policies
-- management_groups: allow inserts/updates/deletes, but SELECT is denied (use view instead)
create policy "Approved users can create groups"
on public.management_groups
for insert
with check (is_approved_user(auth.uid()) and auth.uid() = created_by);

create policy "Group admins can update group"
on public.management_groups
for update
using (public.is_group_admin(auth.uid(), id))
with check (public.is_group_admin(auth.uid(), id));

create policy "Group admins can delete group"
on public.management_groups
for delete
using (public.is_group_admin(auth.uid(), id));

-- group_members
create policy "Users can view members of their group"
on public.group_members
for select
using (public.is_group_member(auth.uid(), group_id));

create policy "Group admins can manage memberships"
on public.group_members
for all
using (public.is_group_admin(auth.uid(), group_id))
with check (public.is_group_admin(auth.uid(), group_id));

-- group_join_requests
create policy "Users can create join request for themselves"
on public.group_join_requests
for insert
with check (auth.uid() = user_id and is_approved_user(auth.uid()));

create policy "Users can view their own join requests"
on public.group_join_requests
for select
using (auth.uid() = user_id);

create policy "Group admins can view join requests"
on public.group_join_requests
for select
using (public.is_group_admin(auth.uid(), group_id));

create policy "Group admins can decide join requests"
on public.group_join_requests
for update
using (public.is_group_admin(auth.uid(), group_id))
with check (public.is_group_admin(auth.uid(), group_id));

-- user_active_group
create policy "Users can view their active group"
on public.user_active_group
for select
using (auth.uid() = user_id);

create policy "Users can set their active group if member"
on public.user_active_group
for insert
with check (auth.uid() = user_id and public.is_group_member(auth.uid(), group_id));

create policy "Users can change their active group if member"
on public.user_active_group
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and public.is_group_member(auth.uid(), group_id));

-- chat_conversations
create policy "Users can view conversations they belong to"
on public.chat_conversations
for select
using (
  (kind = 'group' and group_id is not null and public.is_group_member(auth.uid(), group_id))
  or exists (
    select 1
    from public.chat_members cm
    where cm.conversation_id = id
      and cm.user_id = auth.uid()
  )
);

create policy "Users can create group conversations"
on public.chat_conversations
for insert
with check (
  (kind = 'group' and group_id is not null and public.is_group_member(auth.uid(), group_id) and auth.uid() = created_by)
  or (kind = 'dm' and group_id is null and auth.uid() = created_by)
);

-- chat_members
create policy "Users can view conversation members when they are in the conversation"
on public.chat_members
for select
using (
  exists (
    select 1
    from public.chat_members self
    where self.conversation_id = conversation_id
      and self.user_id = auth.uid()
  )
);

create policy "Admins can add members to group chats; creators can add to dm"
on public.chat_members
for insert
with check (
  exists (
    select 1
    from public.chat_conversations c
    where c.id = conversation_id
      and c.kind = 'group'
      and c.group_id is not null
      and public.is_group_admin(auth.uid(), c.group_id)
  )
  or exists (
    select 1
    from public.chat_conversations c
    where c.id = conversation_id
      and c.kind = 'dm'
      and c.created_by = auth.uid()
  )
);

-- chat_messages
create policy "Users can view messages in their conversations"
on public.chat_messages
for select
using (
  exists (
    select 1
    from public.chat_members cm
    where cm.conversation_id = chat_messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Users can send messages in their conversations"
on public.chat_messages
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.chat_members cm
    where cm.conversation_id = chat_messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

-- 10) Group-aware data isolation: add group_id + update policies
alter table public.membros add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.reunioes add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.presencas add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.visitas add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.eventos add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.notas add column if not exists group_id uuid references public.management_groups(id) on delete cascade;
alter table public.cargos add column if not exists group_id uuid references public.management_groups(id) on delete cascade;

create index if not exists idx_membros_group_id on public.membros(group_id);
create index if not exists idx_reunioes_group_id on public.reunioes(group_id);
create index if not exists idx_presencas_group_id on public.presencas(group_id);
create index if not exists idx_visitas_group_id on public.visitas(group_id);
create index if not exists idx_eventos_group_id on public.eventos(group_id);
create index if not exists idx_notas_group_id on public.notas(group_id);
create index if not exists idx_cargos_group_id on public.cargos(group_id);

-- membros
DROP POLICY IF EXISTS "Apenas admins podem visualizar membros" ON public.membros;
DROP POLICY IF EXISTS "Usuários aprovados podem atualizar membros" ON public.membros;
DROP POLICY IF EXISTS "Usuários aprovados podem deletar membros" ON public.membros;
DROP POLICY IF EXISTS "Usuários aprovados podem inserir membros" ON public.membros;

create policy "Group members can view members" on public.membros
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can insert members" on public.membros
for insert with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can update members" on public.membros
for update using (group_id is not null and public.is_group_member(auth.uid(), group_id))
with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group admins can delete members" on public.membros
for delete using (group_id is not null and public.is_group_admin(auth.uid(), group_id));

-- reunioes
DROP POLICY IF EXISTS "Usuários aprovados podem visualizar reuniões" ON public.reunioes;
DROP POLICY IF EXISTS "Usuários aprovados podem inserir reuniões" ON public.reunioes;
DROP POLICY IF EXISTS "Usuários aprovados podem atualizar reuniões" ON public.reunioes;
DROP POLICY IF EXISTS "Usuários aprovados podem deletar reuniões" ON public.reunioes;

create policy "Group members can view meetings" on public.reunioes
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can insert meetings" on public.reunioes
for insert with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can update meetings" on public.reunioes
for update using (group_id is not null and public.is_group_member(auth.uid(), group_id))
with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group admins can delete meetings" on public.reunioes
for delete using (group_id is not null and public.is_group_admin(auth.uid(), group_id));

-- presencas
DROP POLICY IF EXISTS "Usuários aprovados podem visualizar presenças" ON public.presencas;
DROP POLICY IF EXISTS "Usuários aprovados podem inserir presenças" ON public.presencas;
DROP POLICY IF EXISTS "Usuários aprovados podem atualizar presenças" ON public.presencas;
DROP POLICY IF EXISTS "Usuários aprovados podem deletar presenças" ON public.presencas;

create policy "Group members can view presencas" on public.presencas
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can insert presencas" on public.presencas
for insert with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can update presencas" on public.presencas
for update using (group_id is not null and public.is_group_member(auth.uid(), group_id))
with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group admins can delete presencas" on public.presencas
for delete using (group_id is not null and public.is_group_admin(auth.uid(), group_id));

-- visitas
DROP POLICY IF EXISTS "Usuarios aprovados podem gerenciar visitas" ON public.visitas;

create policy "Group members can manage visitas" on public.visitas
for all
using (group_id is not null and public.is_group_member(auth.uid(), group_id))
with check (group_id is not null and public.is_group_member(auth.uid(), group_id));

-- eventos
DROP POLICY IF EXISTS "Usuários aprovados podem visualizar eventos" ON public.eventos;
DROP POLICY IF EXISTS "Usuários aprovados podem criar eventos" ON public.eventos;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios eventos" ON public.eventos;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios eventos" ON public.eventos;

create policy "Group members can view eventos" on public.eventos
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can insert eventos" on public.eventos
for insert with check (group_id is not null and public.is_group_member(auth.uid(), group_id) and auth.uid() = user_id);

create policy "Group members can update eventos" on public.eventos
for update using (group_id is not null and public.is_group_member(auth.uid(), group_id) and auth.uid() = user_id)
with check (group_id is not null and public.is_group_member(auth.uid(), group_id) and auth.uid() = user_id);

create policy "Group admins can delete eventos" on public.eventos
for delete using (group_id is not null and public.is_group_admin(auth.uid(), group_id));

-- cargos
DROP POLICY IF EXISTS "Usuários aprovados podem visualizar cargos" ON public.cargos;
DROP POLICY IF EXISTS "Admins podem inserir cargos" ON public.cargos;
DROP POLICY IF EXISTS "Admins podem atualizar cargos" ON public.cargos;
DROP POLICY IF EXISTS "Admins podem deletar cargos" ON public.cargos;

create policy "Group members can view cargos" on public.cargos
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group admins can manage cargos" on public.cargos
for all
using (group_id is not null and public.is_group_admin(auth.uid(), group_id))
with check (group_id is not null and public.is_group_admin(auth.uid(), group_id));

-- notas: keep owner update, but group-scoped
create policy "Group members can view notes" on public.notas
for select using (group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group members can insert notes" on public.notas
for insert with check (group_id is not null and public.is_group_member(auth.uid(), group_id) and auth.uid() = user_id);

create policy "Users can update their own notes (group scoped)" on public.notas
for update using (auth.uid() = user_id and group_id is not null and public.is_group_member(auth.uid(), group_id))
with check (auth.uid() = user_id and group_id is not null and public.is_group_member(auth.uid(), group_id));

create policy "Group admins can delete notes" on public.notas
for delete using (group_id is not null and public.is_group_admin(auth.uid(), group_id));

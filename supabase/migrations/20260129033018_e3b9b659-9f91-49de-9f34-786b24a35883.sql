-- 1) Add group photo URL to management_groups
alter table public.management_groups
add column if not exists photo_url text;

-- 2) Presence table (heartbeat) per user x group
create table if not exists public.group_user_presence (
  group_id uuid not null,
  user_id uuid not null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_user_presence enable row level security;

-- Allow group admins to view presence of their group; users can view their own row
create policy "Group admins can view group presence"
on public.group_user_presence
for select
using (is_group_admin(auth.uid(), group_id) or auth.uid() = user_id);

-- Users can upsert/update their own presence if they are members of the group
create policy "Users can insert own presence if member"
on public.group_user_presence
for insert
with check (auth.uid() = user_id and is_group_member(auth.uid(), group_id));

create policy "Users can update own presence if member"
on public.group_user_presence
for update
using (auth.uid() = user_id and is_group_member(auth.uid(), group_id))
with check (auth.uid() = user_id and is_group_member(auth.uid(), group_id));

-- updated_at trigger
create trigger update_group_user_presence_updated_at
before update on public.group_user_presence
for each row
execute function public.update_updated_at_column();

-- 3) Storage bucket for group photos (private)
insert into storage.buckets (id, name, public)
values ('group-photos', 'group-photos', false)
on conflict (id) do nothing;

-- Storage policies
-- Read: any group member can read photos under their group folder
create policy "Group members can read group photos"
on storage.objects
for select
using (
  bucket_id = 'group-photos'
  and is_group_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Write: only group admins can upload/update/delete photos under their group folder
create policy "Group admins can upload group photos"
on storage.objects
for insert
with check (
  bucket_id = 'group-photos'
  and is_group_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

create policy "Group admins can update group photos"
on storage.objects
for update
using (
  bucket_id = 'group-photos'
  and is_group_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'group-photos'
  and is_group_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

create policy "Group admins can delete group photos"
on storage.objects
for delete
using (
  bucket_id = 'group-photos'
  and is_group_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Allow listing groups safely by removing column privilege for password_hash

-- Drop deny-all select policy (if exists)
drop policy if exists "No direct select on groups" on public.management_groups;

-- Ensure password_hash cannot be selected by client roles
revoke select(password_hash) on table public.management_groups from anon;
revoke select(password_hash) on table public.management_groups from authenticated;

-- Allow approved users to list groups (still cannot read password_hash due to revoke)
create policy "Approved users can list groups"
on public.management_groups
for select
using (is_approved_user(auth.uid()));

alter table public.notas
  add column if not exists external_links text[] not null default '{}'::text[];

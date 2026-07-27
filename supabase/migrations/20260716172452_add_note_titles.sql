alter table public.notas
  add column if not exists titulo text;

update public.notas
set titulo = left(
  nullif(trim(regexp_replace(conteudo, '<[^>]+>', ' ', 'g')), ''),
  120
)
where titulo is null or trim(titulo) = '';

update public.notas
set titulo = 'Sem título'
where titulo is null or trim(titulo) = '';

alter table public.notas
  alter column titulo set default 'Sem título',
  alter column titulo set not null;


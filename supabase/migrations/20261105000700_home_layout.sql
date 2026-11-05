-- The home page's own layout for each person (James, 4 Nov 2026): which game sections they folded away, and which games
-- they pinned to the Pinned section at the top. It follows them to any Chromebook, so a pupil who folds away Foundational
-- skills finds it folded until they open it again.
--
-- 1. home_layouts: one row a person, { "collapsed": [section ids], "pinned": [game ids] }. Nothing in it is about how
--    they did, so nothing else reads it. Goes with the person (on delete cascade).
-- 2. my_home_layout() reads your own row ({} if none yet); save_my_home_layout(layout) replaces it. The layout is
--    checked: two lists of short ids, at most 40 each.
--
-- Nobody can read or change the table directly; only these two functions, and only for the signed-in person.

create table public.home_layouts (
  player uuid primary key references public.profiles (id) on delete cascade,
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.home_layouts enable row level security;
revoke all on public.home_layouts from public, anon, authenticated;

create function public.my_home_layout()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select h.layout from public.home_layouts h where h.player = auth.uid()), '{}'::jsonb)
$$;

create function public.save_my_home_layout(layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean jsonb;
  part text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first' using errcode = '42501';
  end if;
  if layout is null or jsonb_typeof(layout) <> 'object' then
    raise exception 'That layout is not right' using errcode = '22023';
  end if;
  clean := '{}'::jsonb;
  foreach part in array array['collapsed', 'pinned'] loop
    if layout ? part then
      if jsonb_typeof(layout -> part) <> 'array'
         or jsonb_array_length(layout -> part) > 40
         or exists (
           select 1 from jsonb_array_elements(layout -> part) e
           where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 40
         ) then
        raise exception 'That layout is not right' using errcode = '22023';
      end if;
      clean := clean || jsonb_build_object(part, layout -> part);
    end if;
  end loop;
  insert into public.home_layouts (player, layout, updated_at)
  values (auth.uid(), clean, now())
  on conflict (player) do update set layout = excluded.layout, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.my_home_layout(), public.save_my_home_layout(jsonb) from public, anon;
grant execute on function public.my_home_layout(), public.save_my_home_layout(jsonb) to authenticated;

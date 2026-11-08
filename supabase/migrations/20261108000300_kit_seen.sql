-- Game kit: which kinds of go a child has seen (S11 of the second maths review).
-- One small table for every game, so a game can show a demo once per child per kind, on any Chromebook.
-- Nothing existing changes. Pupils can't read or call anything; the server functions do it all.

create table public.kit_seen (
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z][a-z0-9-]{1,30}$'),
  kinds text[] not null default '{}' check (cardinality(kinds) <= 32),
  updated_at timestamptz not null default now(),
  primary key (player, game)
);

alter table public.kit_seen enable row level security;
revoke all on public.kit_seen from anon, authenticated;

-- The kinds this pupil has seen in this game ('{}' when none).
create function public.kit_seen_get(player uuid, game text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return coalesce((select s.kinds from public.kit_seen s where s.player = kit_seen_get.player and s.game = kit_seen_get.game), '{}');
end;
$$;

-- Adds kinds to the saved list (union, sorted, no repeats, at most 32) and returns the new list.
create function public.kit_seen_mark(player uuid, game text, kinds text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  merged text[];
begin
  perform public.gem_keep_check_player(player);
  if game is null or game !~ '^[a-z][a-z0-9-]{1,30}$' then
    raise exception 'That game name is not allowed.' using errcode = '22023';
  end if;
  if kinds is null or cardinality(kinds) > 8 then
    raise exception 'Too many kinds at once.' using errcode = '22023';
  end if;
  foreach k in array kinds loop
    if k is null or k !~ '^[a-z0-9-]{1,24}$' then
      raise exception 'That kind name is not allowed.' using errcode = '22023';
    end if;
  end loop;
  select coalesce(array_agg(x order by x), '{}') into merged from (
    select distinct x from unnest(
      coalesce((select s.kinds from public.kit_seen s where s.player = kit_seen_mark.player and s.game = kit_seen_mark.game), '{}') || kinds
    ) as x
  ) u;
  if cardinality(merged) > 32 then
    raise exception 'Too many kinds saved.' using errcode = '22023';
  end if;
  insert into public.kit_seen (player, game, kinds) values (kit_seen_mark.player, kit_seen_mark.game, merged)
  on conflict on constraint kit_seen_pkey do update set kinds = excluded.kinds, updated_at = now();
  return merged;
end;
$$;

revoke execute on function public.kit_seen_get(uuid, text), public.kit_seen_mark(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.kit_seen_get(uuid, text), public.kit_seen_mark(uuid, text, text[]) to service_role;

-- "Next part" chips for the Foundational skills games (James, 4 Nov 2026): on the home page card, a chip that says
-- whether today's part (a leaf, a lily pad, a shell, a stepping stone) is still ready to change, or the pupil should come back
-- tomorrow. Each of these games changes one thing on the first finish of each New Zealand day.
--
-- Shared, so a new game gets it by adding rows and its own function only:
--   1. hub_games.day_fn: a new hook, fn(who uuid) returns date, the NZ day the pupil last moved on (null: never).
--      Checked by its own small trigger, so hub_games_check is left exactly as it is.
--   2. my_next_parts(): { "<game>": true | false, ... } for the signed-in pupil, true when today's part is done.
--      One request for every game with the hook.
--   3. The hooks for Kiwi's Beanstalk, Hop's Glow-worm Pond, Pipi's Hidden Shells and Penguin Pairs.
--
-- A new game: create function public.<game>_last_day(who uuid) returns date ..., then
--   update public.hub_games set day_fn = 'public.<game>_last_day(uuid)' where id = '<game>';
-- and give its GameDefinition `nextPart` (src/games/types.ts).
--
-- Nothing shared is re-created. Depends on 20261020000100_game_hooks.sql and the four games' migrations.

-- ---------------------------------------------------------------------------
-- 1. The hook
-- ---------------------------------------------------------------------------

alter table public.hub_games add column day_fn regprocedure;

create function public.hub_games_day_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.day_fn is not null and not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = new.day_fn
      and pg_catalog.oidvectortypes(p.proargtypes) = 'uuid'
      and pg_catalog.format_type(p.prorettype, null) = 'date'
      and not p.proretset
  ) then
    raise exception 'hub_games.day_fn: % must take (uuid) and return date', new.day_fn using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger hub_games_day_check
before insert or update of day_fn on public.hub_games
for each row execute function public.hub_games_day_check();

revoke execute on function public.hub_games_day_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. What the home page reads
-- ---------------------------------------------------------------------------

-- For each game with the hook: has the signed-in pupil already moved on today (NZ time)? A pupil who never played is false.
create function public.my_next_parts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Pacific/Auckland')::date;
  game record;
  last date;
  out jsonb := '{}';
begin
  if me is null then
    return out;
  end if;
  for game in select h.id, h.day_fn from public.hub_games h where h.day_fn is not null order by h.id loop
    execute format('select %s($1)', game.day_fn::regproc) into last using me;
    out := out || jsonb_build_object(game.id, last is not distinct from today);
  end loop;
  return out;
end;
$$;

revoke execute on function public.my_next_parts() from public, anon;
grant execute on function public.my_next_parts() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The four games
-- ---------------------------------------------------------------------------

create function public.beanstalk_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select b.last_leaf_day from public.beanstalk_progress b where b.player = who
$$;

create function public.hop_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select h.last_pad_day from public.hop_progress h where h.player = who
$$;

create function public.pipi_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select p.last_shell_day from public.pipi_progress p where p.player = who
$$;

create function public.korora_last_day(who uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select k.last_pebble_day from public.korora_progress k where k.player = who
$$;

-- Only my_next_parts() calls them.
revoke execute on function public.beanstalk_last_day(uuid), public.hop_last_day(uuid), public.pipi_last_day(uuid),
  public.korora_last_day(uuid) from public, anon, authenticated;

update public.hub_games set day_fn = 'public.beanstalk_last_day(uuid)' where id = 'beanstalk';
update public.hub_games set day_fn = 'public.hop_last_day(uuid)' where id = 'hop';
update public.hub_games set day_fn = 'public.pipi_last_day(uuid)' where id = 'pipi';
update public.hub_games set day_fn = 'public.korora_last_day(uuid)' where id = 'korora';

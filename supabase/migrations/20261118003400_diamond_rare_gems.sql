-- Diamond Drop rare gems (a pupil's idea, James 18 Nov 2026; shared/diamond/config.ts RARE_GEMS). The rules and the
-- collection live in diamond_players.state (lifetime.rare: each rare gem's count and first date, kept through New Season).
-- This adds what the hub counts from it:
--
--   1. Achievements   five new ones, counted by diamond_counts (three new measures).
--   2. Trophies       the Rare Gem Cup (steps: 3, 5 and all 7 different rare gems; config RARE_CUP_STEPS) and the
--                     Phoenix Gem picture (the 1% gem caught).
--   3. Trigger        on diamond_players, so the game's own save doesn't change. A trophy that fails never stops a save.
--   4. Back-award     nobody has a rare gem yet, but it's safe to run.

-- ---------------------------------------------------------------------------
-- 1. Achievements
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure) values
  ('diamond_rare_kinds'), ('diamond_rare_total'), ('diamond_phoenix');

-- The rare gems page of a pupil's state, only the gems actually caught (count of 1 or more).
create function public.diamond_rare_book(state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p.key, p.value), '{}')
  from jsonb_each(case when jsonb_typeof(state #> '{lifetime,rare}') = 'object' then state #> '{lifetime,rare}' else '{}' end) p
  where jsonb_typeof(p.value) = 'object' and coalesce(p.value ->> 'count', '') ~ '^[0-9]+$' and (p.value ->> 'count')::integer >= 1
$$;

create function public.diamond_rare_kinds(state jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from jsonb_object_keys(public.diamond_rare_book(state))
$$;

create or replace function public.diamond_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'diamond_gems', coalesce((d.state #>> '{lifetime,gems}')::integer, 0),
    'diamond_grips', coalesce((d.state #>> '{lifetime,grips}')::integer, 0),
    'diamond_level', coalesce((d.state #>> '{lifetime,bestLevel}')::integer, 0),
    'diamond_kinds', (select count(*) from jsonb_array_elements_text(coalesce(d.state #> '{lifetime,kinds}', '[]')) k where k <> 'heartDiamond'),
    'diamond_found', coalesce((d.state #>> '{lifetime,found}')::integer, 0),
    'diamond_stars', coalesce((d.state #>> '{lifetime,bestStars}')::integer, 0),
    'diamond_rare_kinds', public.diamond_rare_kinds(d.state),
    'diamond_rare_total', (select coalesce(sum((p.value ->> 'count')::integer), 0) from jsonb_each(public.diamond_rare_book(d.state)) p),
    'diamond_phoenix', coalesce((d.state #>> '{lifetime,rare,phoenixGem,count}')::integer, 0))
  from public.diamond_players d where d.player = who
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('diamond-lucky-find', 'diamond', 'Lucky Find', '🍀', 'diamond_rare_kinds', 1, 7),
  ('diamond-rare-hunter', 'diamond', 'Rare Hunter', '🔮', 'diamond_rare_kinds', 4, 8),
  ('diamond-rare-hoard', 'diamond', 'Rare Hoard', '👑', 'diamond_rare_total', 25, 9),
  ('diamond-phoenix', 'diamond', 'Phoenix Finder', '🔥', 'diamond_phoenix', 1, 10),
  ('diamond-full-book', 'diamond', 'Complete Collection', '🏆', 'diamond_rare_kinds', 7, 11);

-- ---------------------------------------------------------------------------
-- 2. Trophies
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('diamond-rare-cup', 'diamond', 'Rare Gem Cup', 'Catch 3, 5 or all 7 different rare gems in Diamond Drop.', 'trophy', 'steps', null, 281),
  ('diamond-phoenix', 'diamond', 'Phoenix Gem', 'Catch the Phoenix Gem, the rarest gem in Diamond Drop (1 in 100 levels).', 'picture', 'once', null, 282);

-- ---------------------------------------------------------------------------
-- 3. Giving them
-- ---------------------------------------------------------------------------

-- What a pupil's rare collection has earned. Safe to call again: award_trophy adds nothing twice. Server only.
create function public.diamond_rare_rewards(who uuid, state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kinds integer := public.diamond_rare_kinds(state);
  step integer;
begin
  for step in 1..3 loop
    if kinds >= (array[3, 5, 7])[step] then
      perform public.award_trophy(who, 'diamond-rare-cup', jsonb_build_object('step', step));
    end if;
  end loop;
  if public.diamond_rare_book(state) ? 'phoenixGem' then
    perform public.award_trophy(who, 'diamond-phoenix');
  end if;
end;
$$;

create function public.diamond_rare_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.diamond_rare_rewards(new.player, new.state);
  exception when others then
    raise warning 'diamond rare rewards for %: %', new.player, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function
  public.diamond_rare_book(jsonb), public.diamond_rare_kinds(jsonb),
  public.diamond_rare_rewards(uuid, jsonb),
  public.diamond_rare_after_save()
from public, anon, authenticated;

create trigger diamond_rare_rewards after insert or update of state on public.diamond_players
for each row when (new.state #> '{lifetime,rare}' is not null and new.state #> '{lifetime,rare}' <> '{}'::jsonb)
execute function public.diamond_rare_after_save();

-- ---------------------------------------------------------------------------
-- 4. Back-award
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select player, state from public.diamond_players where state #> '{lifetime,rare}' is not null loop
    perform public.diamond_rare_rewards(r.player, r.state);
  end loop;
end;
$$;

-- Diamond Drop: the Monster Dig (James, 25 Nov 2026; docs/DIAMOND-MONSTERS-PLAN.md, shared/diamond/caverns.ts). Ten
-- caverns below the Heart Diamond where the claw catches Maths Monsters. The rules and the Monster Book live in
-- diamond_players.state (caves: this season's caverns; lifetime.monsters: each species' count, first date and shiny
-- count, kept through New Season). Nothing in Maths Monsters changes. This adds what the hub counts from it:
--
--   1. Achievements   seven new ones, counted by diamond_counts (five new measures).
--   2. Trophies       the Monster Book trophy (steps: 15, 40 and all 75 kinds; config MONSTER_CUP_STEPS) and the Full
--                     Monster Book picture.
--   3. Trigger        on diamond_players, so the game's own save doesn't change. A trophy that fails never stops a save.
--   No back-award: nobody has caught a monster yet.

-- ---------------------------------------------------------------------------
-- 1. Achievements
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure) values
  ('diamond_monster_kinds'), ('diamond_monster_total'), ('diamond_monster_shiny'), ('diamond_monster_giant'), ('diamond_monster_ultra');

-- The Monster Book pages of a pupil's state: only the monsters actually caught (count of 1 or more).
create function public.diamond_monster_book(state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p.key, p.value), '{}')
  from jsonb_each(case when jsonb_typeof(state #> '{lifetime,monsters}') = 'object' then state #> '{lifetime,monsters}' else '{}' end) p
  where jsonb_typeof(p.value) = 'object' and coalesce(p.value ->> 'count', '') ~ '^[0-9]+$' and (p.value ->> 'count')::integer >= 1
$$;

create function public.diamond_monster_kinds(state jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from jsonb_object_keys(public.diamond_monster_book(state))
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
    'diamond_phoenix', coalesce((d.state #>> '{lifetime,rare,phoenixGem,count}')::integer, 0),
    'diamond_monster_kinds', public.diamond_monster_kinds(d.state),
    'diamond_monster_total', (select coalesce(sum((p.value ->> 'count')::integer), 0) from jsonb_each(public.diamond_monster_book(d.state)) p),
    'diamond_monster_shiny', (select count(*) from jsonb_each(public.diamond_monster_book(d.state)) p where coalesce(p.value ->> 'shiny', '') ~ '^[1-9][0-9]*$'),
    'diamond_monster_giant', (select count(*) from jsonb_object_keys(public.diamond_monster_book(d.state)) k
      where k in ('dozepebble-1', 'dozepebble-2', 'napsea-1', 'napsea-2', 'blinkberg-1', 'blinkberg-2')),
    'diamond_monster_ultra', (select count(*) from jsonb_object_keys(public.diamond_monster_book(d.state)) k
      where k in ('infinitail-1', 'primerald-1', 'equalizard-1')))
  from public.diamond_players d where d.player = who
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('diamond-monster-first', 'diamond', 'Monster Catcher', '🐾', 'diamond_monster_kinds', 1, 12, 'Catch your first monster in the Monster Dig.', 1),
  ('diamond-monster-spotter', 'diamond', 'Monster Spotter: 10 kinds', '🔎', 'diamond_monster_kinds', 10, 13, 'Catch 10 different monsters in the Monster Dig.', 2),
  ('diamond-monster-keeper', 'diamond', 'Monster Keeper: 30 kinds', '📗', 'diamond_monster_kinds', 30, 14, 'Catch 30 different monsters in the Monster Dig.', 2),
  ('diamond-monster-shiny', 'diamond', 'Shiny Finder', '✨', 'diamond_monster_shiny', 1, 15, 'Catch a shiny monster in the Monster Dig.', 2),
  ('diamond-monster-giant', 'diamond', 'Giant Tamer', '😴', 'diamond_monster_giant', 1, 16, 'Catch a sleeping giant in the Monster Dig.', 2),
  ('diamond-monster-ultra', 'diamond', 'Ultra Catch', '🌟', 'diamond_monster_ultra', 1, 17, 'Catch an ultra rare monster in the Monster Dig.', 3),
  ('diamond-monster-book', 'diamond', 'Full Monster Book: all 75', '🏆', 'diamond_monster_kinds', 75, 18, 'Catch all 75 monsters in the Monster Dig.', 3);

-- ---------------------------------------------------------------------------
-- 2. Trophies
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('diamond-monster-book', 'diamond', 'Monster Book Trophy', 'Catch 15, 40 or all 75 different monsters in the Diamond Drop Monster Dig.', 'trophy', 'steps', null, 283),
  ('diamond-monster-full', 'diamond', 'Full Monster Book', 'Fill every page of the Monster Book in Diamond Drop.', 'picture', 'once', null, 284);

-- ---------------------------------------------------------------------------
-- 3. Giving them
-- ---------------------------------------------------------------------------

-- What a pupil's Monster Book has earned. Safe to call again: award_trophy adds nothing twice. Server only.
create function public.diamond_monster_rewards(who uuid, state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kinds integer := public.diamond_monster_kinds(state);
  step integer;
begin
  for step in 1..3 loop
    if kinds >= (array[15, 40, 75])[step] then
      perform public.award_trophy(who, 'diamond-monster-book', jsonb_build_object('step', step));
    end if;
  end loop;
  if kinds >= 75 then
    perform public.award_trophy(who, 'diamond-monster-full');
  end if;
end;
$$;

create function public.diamond_monster_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.diamond_monster_rewards(new.player, new.state);
  exception when others then
    raise warning 'diamond monster rewards for %: %', new.player, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function
  public.diamond_monster_book(jsonb), public.diamond_monster_kinds(jsonb),
  public.diamond_monster_rewards(uuid, jsonb),
  public.diamond_monster_after_save()
from public, anon, authenticated;

create trigger diamond_monster_rewards after insert or update of state on public.diamond_players
for each row when (new.state #> '{lifetime,monsters}' is not null and new.state #> '{lifetime,monsters}' <> '{}'::jsonb)
execute function public.diamond_monster_after_save();

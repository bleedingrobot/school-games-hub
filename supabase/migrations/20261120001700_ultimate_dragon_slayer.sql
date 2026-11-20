-- Ultimate Dragon Slayer (docs/plans/ultimate-dragon-slayer/PLAN.md; James, 20 Nov 2026): slay the Red Dragon twice in
-- one dragon season and win three things at once, given in the same request as the second win:
--
--   dm-double-season   achievement "Ultimate Dragon Slayer": beat the Red Dragon twice in one season
--   dm-crown           trophy "Dragon Slayer's Crown", won each dragon season (bronze, silver, gold, like the sword)
--   ultimate-dragon-slayer   the special Hero Title (20261120001600), owned for good and worn straight away
--
-- Like the Slayer's Sword it follows the dragon's own season (lord_hall.season), and lord_hall.kills already counts the
-- wins per season. Nothing shared is re-created:
--   1. The measure and achievement, counted through the game hooks (hub_games.counts_fn for dragon-maths was empty).
--   2. The trophy type.
--   3. lord_give_double(player, season): gives all three for one Hall row with 2 or more kills. Safe to call again.
--   4. A second trigger on lord_hall beside lord_hall_trophies. A failed award never loses the save.
--   5. Back-award: everyone already on 2 kills in a season gets them now.

-- ---------------------------------------------------------------------------
-- 1. The achievement
-- ---------------------------------------------------------------------------

-- The most dragon wins in any one dragon season.
create function public.dragon_maths_counts(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('lord_season_kills',
    (select coalesce(max(hl.kills), 0) from public.lord_hall hl where hl.player = who))
$$;

update public.hub_games set counts_fn = 'public.dragon_maths_counts(uuid)' where id = 'dragon-maths';

insert into public.achievement_measures (measure) values ('lord_season_kills');
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('dm-double-season', 'dragon-maths', 'Ultimate Dragon Slayer', '🐲', 'lord_season_kills', 2, 9,
   'Beat the Red Dragon twice in one season.', 3);

-- ---------------------------------------------------------------------------
-- 2. The trophy
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('dm-crown', 'dragon-maths', 'Dragon Slayer''s Crown', 'Slay the dragon twice in one season.', 'trophy', 'season', null, 25);

-- ---------------------------------------------------------------------------
-- 3. Giving them
-- ---------------------------------------------------------------------------

-- For one player's Hall row in one dragon season. Fewer than 2 kills: nothing. Teachers and hidden pupils win too (there
-- is no race). The title is worn straight away, as a picked Hero Title is; the pupil can change it in My titles.
create function public.lord_give_double(player uuid, season integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select hl.kills into n from public.lord_hall hl
  where hl.player = lord_give_double.player and hl.season = lord_give_double.season;
  if coalesce(n, 0) < 2 then
    return;
  end if;
  perform public.award_trophy(lord_give_double.player, 'dm-crown',
    jsonb_build_object('dragonSeason', lord_give_double.season), lord_give_double.season);
  perform public.award_achievements(lord_give_double.player, 'dragon-maths', now());
  insert into public.owned_titles (player, title) values (lord_give_double.player, 'ultimate-dragon-slayer')
  on conflict do nothing;
  if found then
    update public.profiles p set avatar = p.avatar || jsonb_build_object('title', 'ultimate-dragon-slayer')
    where p.id = lord_give_double.player;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. On every dragon win
-- ---------------------------------------------------------------------------

create function public.lord_hall_double()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kills >= 2 then
    begin
      perform public.lord_give_double(new.player, new.season);
    exception when others then
      raise warning 'giving Ultimate Dragon Slayer failed (%)', sqlstate;
    end;
  end if;
  return null;
end;
$$;

create trigger lord_hall_double
after insert or update of kills on public.lord_hall
for each row execute function public.lord_hall_double();

revoke execute on function public.dragon_maths_counts(uuid), public.lord_give_double(uuid, integer), public.lord_hall_double()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Back-award
-- ---------------------------------------------------------------------------

-- Dated now: the Hall keeps when the dragon was first slain each season, not the second time.
do $$
declare
  h record;
begin
  for h in select hl.player, hl.season from public.lord_hall hl where hl.kills >= 2 order by hl.season, hl.first_at loop
    perform public.lord_give_double(h.player, h.season);
  end loop;
end;
$$;

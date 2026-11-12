-- Trophies for five more games that already keep a record: Star Trader, Diamond Drop, Toon Flap, Gem Keep and Mine Runner
-- (docs/PROFILE-REVIEW.md section 5; docs/plans/profile/PLAN.md card P7 part 2; trophy system 20261112000800_trophies.sql;
-- the same pattern as part 1, 20261112001700_trophies_games_1.sql).
--
--   1. The trophy types (six, all once a year)
--   2. A small watcher on each game's own record table that calls award_trophy when the feat first comes true
--        trader_games       Star Ring (the Dyson ring built round your sun), Black Hole picture (a built black hole sun)
--        diamond_finds      Heart Diamond picture (the Heart Diamond found)
--        toonflap_progress  Rainbow Toon picture (gold on all 10 levels)
--        gem_keep_progress  Gem Crown picture (all 30 stars and all 10 Level Keys)
--        mine_bests         Miner's Lamp (gold in all 6 mines; plain mines only, hard mines are card P8)
--   3. Back-awards from today's records
--
-- The games' own functions are not changed: each watcher runs after the game has written its record, and a trophy that goes
-- wrong never loses a save (any error becomes a warning). Trophies give no hub points. Each watcher only acts when the feat
-- comes true in that save, so a "once a year" trophy is not given again just for saving in a new year while the record still
-- holds it. Mine Runner and Gem Keep records are cleared at each New Season, so doing it again in a later year counts again.

-- ---------------------------------------------------------------------------
-- 1. The trophy types
-- ---------------------------------------------------------------------------

-- sort follows the order of the review's section 5 table (10 a row), as in part 1.
insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('gem-crown', 'gem-keep', 'Gem Crown', 'Win all 30 stars and all 10 Level Keys in Gem Keep.', 'picture', 'year', null, 120),
  ('mine-lamp', 'mine', 'Miner''s Lamp', 'Win a gold medal in all 6 mines.', 'trophy', 'year', null, 200),
  ('trader-ring', 'trader', 'Star Ring', 'Build the ring around your sun in the Star Forge.', 'trophy', 'year', null, 260),
  ('trader-blackhole', 'trader', 'Black Hole', 'Make your sun a black hole in the Star Forge.', 'picture', 'year', null, 270),
  ('diamond-heart', 'diamond', 'Heart Diamond', 'Find the Heart Diamond.', 'picture', 'year', null, 280),
  ('toonflap-rainbow', 'toonflap', 'Rainbow Toon', 'Win gold on all 10 levels of Toon Flap.', 'picture', 'year', null, 310);

-- ---------------------------------------------------------------------------
-- 2. The watchers
-- ---------------------------------------------------------------------------

-- Star Trader: is a piece built in a Star Forge system (shared/trader/system.ts, SystemDesign)? 'ring' is the Dyson ring
-- (a built tech of kind 'dyson'), 'blackhole' a built sun of kind 'blackhole'.
create function public.trader_built(design jsonb, piece text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case piece
    when 'ring' then jsonb_typeof(design -> 'tech') = 'array' and exists (
      select 1 from jsonb_array_elements(design -> 'tech') t
      where jsonb_typeof(t) = 'object' and t ->> 'kind' = 'dyson' and t ->> 'built' = 'true')
    when 'blackhole' then jsonb_typeof(design -> 'sun') = 'object'
      and design -> 'sun' ->> 'kind' = 'blackhole' and design -> 'sun' ->> 'built' = 'true'
    else false
  end
$$;

-- Star Trader: the saved game (trader_games.game.system). A new season's game for a pupil who chose to keep last season's
-- system (trader_systems) starts with it already built, so that does not count as building it again.
create function public.trader_game_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before jsonb;
begin
  if tg_op = 'UPDATE' then
    before := old.game -> 'system';
  else
    select s.design into before from public.trader_systems s where s.player = new.player;
  end if;
  if coalesce(public.trader_built(new.game -> 'system', 'ring'), false)
     and not coalesce(public.trader_built(before, 'ring'), false) then
    perform public.award_trophy(new.player, 'trader-ring', jsonb_build_object('season', new.season));
  end if;
  if coalesce(public.trader_built(new.game -> 'system', 'blackhole'), false)
     and not coalesce(public.trader_built(before, 'blackhole'), false) then
    perform public.award_trophy(new.player, 'trader-blackhole', jsonb_build_object('season', new.season));
  end if;
  return null;
exception when others then
  raise warning 'a Star Trader trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of game on public.trader_games
for each row
execute function public.trader_game_trophies();

-- Diamond Drop: a row in diamond_finds is the Heart Diamond found that season (20261102000200).
create function public.diamond_find_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_trophy(new.player, 'diamond-heart', jsonb_build_object('season', new.season));
  return null;
exception when others then
  raise warning 'a Diamond Drop trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert on public.diamond_finds
for each row
execute function public.diamond_find_trophies();

-- Toon Flap: how many levels have a gold medal in a progress save (shared/toonflap/collection.ts, golds).
create function public.toonflap_golds(progress jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(progress -> 'levels') = 'object' then (
    select count(*)::integer from jsonb_each(progress -> 'levels') l
    where jsonb_typeof(l.value) = 'object' and l.value ->> 'medal' = 'gold')
  else 0 end
$$;

create function public.toonflap_progress_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.toonflap_golds(new.progress) >= 10
     and (tg_op = 'INSERT' or public.toonflap_golds(old.progress) < 10) then
    perform public.award_trophy(new.player, 'toonflap-rainbow');
  end if;
  return null;
exception when others then
  raise warning 'a Toon Flap trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of progress on public.toonflap_progress
for each row
execute function public.toonflap_progress_trophies();

-- Gem Keep: one row a level (best_stars 0 to 3, key_passed). The crown is all 30 stars and all 10 keys. The table already
-- holds the new row, so "before" is the totals with the old row put back.
create function public.gem_keep_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stars integer;
  keys integer;
  stars_before integer;
  keys_before integer;
begin
  select coalesce(sum(p.best_stars), 0)::integer, count(*) filter (where p.key_passed)::integer into stars, keys
  from public.gem_keep_progress p where p.player = new.player;
  stars_before := stars - new.best_stars + case when tg_op = 'UPDATE' then old.best_stars else 0 end;
  keys_before := keys - (case when new.key_passed then 1 else 0 end)
                 + (case when tg_op = 'UPDATE' and old.key_passed then 1 else 0 end);
  if stars >= 30 and keys >= 10 and (stars_before < 30 or keys_before < 10) then
    perform public.award_trophy(new.player, 'gem-crown');
  end if;
  return null;
exception when others then
  raise warning 'a Gem Keep trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of best_stars, key_passed on public.gem_keep_progress
for each row
execute function public.gem_keep_trophies();

-- Mine Runner: a best per mine, with and without maths. The lamp is a gold medal in each of the 6 plain mines (l1 to l6,
-- either way); hard mines ('l3:hard') are for the Golden Pickaxe, card P8.
create function public.mine_best_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  golds integer;
  golds_before integer;
begin
  if new.medal is distinct from 'gold' or new.level !~ '^l[1-6]$' then
    return null;
  end if;
  select count(distinct b.level)::integer into golds
  from public.mine_bests b where b.player = new.player and b.level ~ '^l[1-6]$' and b.medal = 'gold';
  select count(distinct x.level)::integer into golds_before from (
    select b.level from public.mine_bests b
    where b.player = new.player and b.level ~ '^l[1-6]$' and b.medal = 'gold'
      and not (b.level = new.level and b.maths = new.maths)
    union all
    select old.level where tg_op = 'UPDATE' and old.medal = 'gold' and old.level ~ '^l[1-6]$'
  ) x;
  if golds >= 6 and golds_before < 6 then
    perform public.award_trophy(new.player, 'mine-lamp');
  end if;
  return null;
exception when others then
  raise warning 'a Mine Runner trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of medal on public.mine_bests
for each row
execute function public.mine_best_trophies();

revoke execute on function
  public.trader_built(jsonb, text), public.trader_game_trophies(), public.diamond_find_trophies(),
  public.toonflap_golds(jsonb), public.toonflap_progress_trophies(), public.gem_keep_trophies(), public.mine_best_trophies()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Back-awards from today's records
-- ---------------------------------------------------------------------------

-- Each feat in today's records is given now, then dated as near to when it happened as the record knows (a day is dated
-- noon in New Zealand). All of these games started in 2026, so every back-award is this year's.
do $$
declare
  r record;
  res jsonb;
begin
  -- Star Trader: today's games, then last season's systems still kept for their owners.
  for r in select g.player, g.season, g.updated_at as at, g.game -> 'system' as design from public.trader_games g
           union all
           select s.player, s.season, s.updated_at, s.design from public.trader_systems s
           order by 3 loop
    if coalesce(public.trader_built(r.design, 'ring'), false) then
      res := public.award_trophy(r.player, 'trader-ring', jsonb_build_object('season', r.season));
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.at where player = r.player and trophy = 'trader-ring' and season = 0;
      end if;
    end if;
    if coalesce(public.trader_built(r.design, 'blackhole'), false) then
      res := public.award_trophy(r.player, 'trader-blackhole', jsonb_build_object('season', r.season));
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.at where player = r.player and trophy = 'trader-blackhole' and season = 0;
      end if;
    end if;
  end loop;

  -- Diamond Drop: the first Heart Diamond each pupil found.
  for r in select f.player, f.season, f.found_on from public.diamond_finds f order by f.found_on, f.season loop
    res := public.award_trophy(r.player, 'diamond-heart', jsonb_build_object('season', r.season));
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = (r.found_on + time '12:00') at time zone 'Pacific/Auckland'
      where player = r.player and trophy = 'diamond-heart' and season = 0;
    end if;
  end loop;

  -- Toon Flap: today's progress saves with all 10 golds.
  for r in select t.player, t.updated_at from public.toonflap_progress t where public.toonflap_golds(t.progress) >= 10 loop
    res := public.award_trophy(r.player, 'toonflap-rainbow');
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.updated_at where player = r.player and trophy = 'toonflap-rainbow' and season = 0;
    end if;
  end loop;

  -- Gem Keep: pupils with all 30 stars and all 10 keys, dated by their last level saved.
  for r in select p.player, max(p.updated_at) as at from public.gem_keep_progress p group by p.player
           having sum(p.best_stars) >= 30 and count(*) filter (where p.key_passed) >= 10 loop
    res := public.award_trophy(r.player, 'gem-crown');
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'gem-crown' and season = 0;
    end if;
  end loop;

  -- Mine Runner: gold in all 6 plain mines, dated by the latest of each mine's first gold.
  for r in select m.player, max(m.first_gold) as at from (
             select b.player, b.level, min(b.achieved_at) as first_gold from public.mine_bests b
             where b.level ~ '^l[1-6]$' and b.medal = 'gold' group by b.player, b.level) m
           group by m.player having count(*) >= 6 loop
    res := public.award_trophy(r.player, 'mine-lamp');
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'mine-lamp' and season = 0;
    end if;
  end loop;
end;
$$;

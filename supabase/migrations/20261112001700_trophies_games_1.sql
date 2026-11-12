-- Trophies for four games that already keep a record: Clan Quest, Sky Isles, Royal Decree and Maths Monsters
-- (docs/PROFILE-REVIEW.md section 5; docs/plans/profile/PLAN.md card P7 part 1; trophy system 20261112000800_trophies.sql).
--
--   1. The trophy types (eight)
--   2. A small watcher on each game's own record table that calls award_trophy when the feat first comes true
--        clan_hall       Monster Tooth (the clan's season monster beaten), Clan Banner picture (village and monster in one season)
--        isles_islands   Lighthouse picture (the Sky Lighthouse lit, once an island)
--        isles_hall      Keeper's Medal (class top three when the island ends)
--        decree_reigns   Royal Seal (a full reign)
--        monster_saves   League Champion (all 6 badges), Book Master picture (all 75 in the book), Shiny Star (a shiny owned)
--   3. Back-awards from today's records, dated when they happened
--   4. Maths Monsters' "Fill every page of the monster book" achievement: 75 monsters, not 54
--
-- The games' own functions are not changed: each watcher runs after the game has written its record, and a trophy that goes
-- wrong never loses a save (any error becomes a warning). Trophies give no hub points. Each watcher only acts when the feat
-- comes true in that save (not already true before it), so a "once a year" trophy is not given again just for saving in a new
-- year while the record still holds it.
-- Which season a trophy counts in: Clan Quest uses the clan's own season number (clan_hall.season), Sky Isles the island's
-- number (isles_islands.season), the others the hub season (award_trophy's default).

-- ---------------------------------------------------------------------------
-- 1. The trophy types
-- ---------------------------------------------------------------------------

-- sort follows the order of the review's section 5 table (10 a row), so every card's trophies sit in that order.
insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('clan-tooth', 'clan-quest', 'Monster Tooth', 'Beat the season monster with your clan.', 'trophy', 'season', null, 30),
  ('clan-banner', 'clan-quest', 'Clan Banner', 'Finish your whole village and beat the season monster in the same season.', 'picture', 'season', null, 40),
  ('mm-league', 'monsters', 'League Champion', 'Win all 6 Topic Tower badges.', 'trophy', 'year', null, 130),
  ('mm-book', 'monsters', 'Book Master', 'Fill every page of the monster book (75 monsters).', 'picture', 'once', null, 140),
  ('mm-shiny', 'monsters', 'Shiny Star', 'Own a shiny monster.', 'trophy', 'once', null, 150),
  ('decree-seal', 'decree', 'Royal Seal', 'Rule to the end of a full reign.', 'trophy', 'season', null, 240),
  ('isles-lighthouse', 'isles', 'Lighthouse', 'Light the Sky Lighthouse on your island.', 'picture', 'season', null, 290),
  ('isles-keeper', 'isles', 'Keeper''s Medal', 'Be in your class''s top three islands when the island ends.', 'trophy', 'season', null, 300);

-- ---------------------------------------------------------------------------
-- 2. The watchers
-- ---------------------------------------------------------------------------

-- Clan Quest: the clan's Hall row for a season. clan_monster_try fills monster_done_on on the first win of the season, and
-- clan_village_complete fills village_done_on when the village is finished (20261029000500, 20261029000600).
create function public.clan_hall_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.monster_done_on is not null and (tg_op = 'INSERT' or old.monster_done_on is null) then
    perform public.award_trophy(new.player, 'clan-tooth', jsonb_build_object('clanSeason', new.season), new.season);
  end if;
  if new.monster_done_on is not null and new.village_done_on is not null
     and (tg_op = 'INSERT' or old.monster_done_on is null or old.village_done_on is null) then
    perform public.award_trophy(new.player, 'clan-banner', jsonb_build_object('clanSeason', new.season), new.season);
  end if;
  return null;
exception when others then
  raise warning 'a Clan Quest trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of monster_done_on, village_done_on on public.clan_hall
for each row
execute function public.clan_hall_trophies();

-- Sky Isles: the Lighthouse is lit at stage 4 (isles_counts' isles_lighthouses, 20261104000100). Once an island: the island's
-- number is isles_islands.season.
create function public.isles_island_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((new.island ->> 'lighthouse')::integer, 0) >= 4
     and (tg_op = 'INSERT' or coalesce((old.island ->> 'lighthouse')::integer, 0) < 4) then
    perform public.award_trophy(new.player, 'isles-lighthouse', jsonb_build_object('island', new.season), new.season);
  end if;
  return null;
exception when others then
  raise warning 'a Sky Isles trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of island on public.isles_islands
for each row
execute function public.isles_island_trophies();

-- Sky Isles: the Hall of the Skies row written when the island ends (isles_season, at a New Season). place 1 to 3 is the
-- class's top three. isles_season clears the island and moves its number on in the same statement, so by the time this runs
-- the ended island's number is one less than the row's (unless the island is still there).
create function public.isles_hall_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  island_no integer;
begin
  if new.place is null then
    return null;
  end if;
  select case when i.island is null then i.season - 1 else i.season end into island_no
  from public.isles_islands i where i.player = new.player;
  island_no := greatest(coalesce(island_no, 1), 1);
  perform public.award_trophy(new.player, 'isles-keeper', jsonb_build_object('island', island_no, 'place', new.place), island_no);
  return null;
exception when others then
  raise warning 'a Sky Isles trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert on public.isles_hall
for each row
execute function public.isles_hall_trophies();

-- Royal Decree: a reign whose status becomes 'full' (all the years ruled).
create function public.decree_reign_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'full' and (tg_op = 'INSERT' or old.status is distinct from 'full') then
    perform public.award_trophy(new.player, 'decree-seal', jsonb_build_object('reign', new.id));
  end if;
  return null;
exception when others then
  raise warning 'a Royal Decree trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of status on public.decree_reigns
for each row
execute function public.decree_reign_trophies();

-- Maths Monsters: the save row (record_monster_save). badges_count and owned_count are worked out by the server's checks;
-- a shiny is a team or box monster with "shiny": true (shared/monsters/rules.ts).
create function public.monster_save_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.badges_count >= 6 and (tg_op = 'INSERT' or old.badges_count < 6) then
    perform public.award_trophy(new.player, 'mm-league');
  end if;
  if new.owned_count >= 75 and (tg_op = 'INSERT' or old.owned_count < 75) then
    perform public.award_trophy(new.player, 'mm-book');
  end if;
  if not exists (select 1 from public.trophies w where w.player = new.player and w.trophy = 'mm-shiny')
     and exists (
       select 1 from jsonb_array_elements(coalesce(new.world -> 'team', '[]'::jsonb) || coalesce(new.world -> 'box', '[]'::jsonb)) m
       where jsonb_typeof(m) = 'object' and m ->> 'shiny' = 'true') then
    perform public.award_trophy(new.player, 'mm-shiny');
  end if;
  return null;
exception when others then
  raise warning 'a Maths Monsters trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update on public.monster_saves
for each row
execute function public.monster_save_trophies();

revoke execute on function
  public.clan_hall_trophies(), public.isles_island_trophies(), public.isles_hall_trophies(), public.decree_reign_trophies(),
  public.monster_save_trophies()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Back-awards from today's records
-- ---------------------------------------------------------------------------

-- Each past feat is given now, then dated to when it happened (a day is dated noon in New Zealand).
do $$
declare
  r record;
  res jsonb;
begin
  -- Clan Quest, in season order so the metals build up in order.
  for r in select h.player, h.season, h.monster_done_on, h.village_done_on from public.clan_hall h
           where h.monster_done_on is not null order by h.season, h.monster_done_on loop
    res := public.award_trophy(r.player, 'clan-tooth', jsonb_build_object('clanSeason', r.season), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = (r.monster_done_on + time '12:00') at time zone 'Pacific/Auckland'
      where player = r.player and trophy = 'clan-tooth' and season = r.season;
    end if;
    if r.village_done_on is not null then
      res := public.award_trophy(r.player, 'clan-banner', jsonb_build_object('clanSeason', r.season), r.season);
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = (greatest(r.monster_done_on, r.village_done_on) + time '12:00') at time zone 'Pacific/Auckland'
        where player = r.player and trophy = 'clan-banner' and season = r.season;
      end if;
    end if;
  end loop;

  -- Sky Isles: islands that ended in the Hall (numbered in order, the first island being 1), then today's lit islands.
  for r in select h.player, h.place, h.lit, h.ended,
                  row_number() over (partition by h.player order by h.ended, h.id)::integer as island
           from public.isles_hall h order by h.ended, h.id loop
    if r.lit then
      res := public.award_trophy(r.player, 'isles-lighthouse', jsonb_build_object('island', r.island), r.island);
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = (r.ended + time '12:00') at time zone 'Pacific/Auckland'
        where player = r.player and trophy = 'isles-lighthouse' and season = r.island;
      end if;
    end if;
    if r.place is not null then
      res := public.award_trophy(r.player, 'isles-keeper', jsonb_build_object('island', r.island, 'place', r.place), r.island);
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = (r.ended + time '12:00') at time zone 'Pacific/Auckland'
        where player = r.player and trophy = 'isles-keeper' and season = r.island;
      end if;
    end if;
  end loop;
  for r in select i.player, i.season, i.updated_at from public.isles_islands i
           where coalesce((i.island ->> 'lighthouse')::integer, 0) >= 4 loop
    res := public.award_trophy(r.player, 'isles-lighthouse', jsonb_build_object('island', r.season), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.updated_at where player = r.player and trophy = 'isles-lighthouse' and season = r.season;
    end if;
  end loop;

  -- Royal Decree: every full reign, in the hub season it finished in (each school's own clock).
  for r in select d.player, d.id, coalesce(d.finished_at, d.updated_at) as at,
                  case when public.nz_day(coalesce(d.finished_at, d.updated_at)) < s.hub_season_start then 0
                       else (public.nz_day(coalesce(d.finished_at, d.updated_at)) - s.hub_season_start) / s.hub_season_days + 1 end as season
           from public.decree_reigns d
           join public.profiles p on p.id = d.player
           join public.schools s on s.id = p.school_id
           where d.status = 'full' order by 3 loop
    res := public.award_trophy(r.player, 'decree-seal', jsonb_build_object('reign', r.id), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'decree-seal' and season = r.season;
    end if;
  end loop;

  -- Maths Monsters: today's saves. The badges and book only ever grow, so the last save's time is the best date there is.
  for r in select m.player, m.saved_at, m.badges_count, m.owned_count,
                  exists (select 1 from jsonb_array_elements(coalesce(m.world -> 'team', '[]'::jsonb) || coalesce(m.world -> 'box', '[]'::jsonb)) x
                          where jsonb_typeof(x) = 'object' and x ->> 'shiny' = 'true') as shiny
           from public.monster_saves m loop
    if r.badges_count >= 6 then
      res := public.award_trophy(r.player, 'mm-league');
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.saved_at where player = r.player and trophy = 'mm-league';
      end if;
    end if;
    if r.owned_count >= 75 then
      res := public.award_trophy(r.player, 'mm-book');
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.saved_at where player = r.player and trophy = 'mm-book';
      end if;
    end if;
    if r.shiny then
      res := public.award_trophy(r.player, 'mm-shiny');
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.saved_at where player = r.player and trophy = 'mm-shiny';
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The full monster book is 75 monsters
-- ---------------------------------------------------------------------------

-- The book grew from 54 to 75 (rare and ultra rare monsters, 20261102000400). The id stays, so nobody loses it; from now on a
-- pupil needs all 75 to earn it.
update public.achievement_types set goal = 75 where id = 'mm-book-54';

-- Clan Quest's season monster, the database half (James, 29 Oct 2026; part 2 of the season goals, after 20261029000400 and 20261029000500).
--
--   1. clan_season_rules()   gets one more key, monsterReward (fame and points), which shared/clans/config.ts (CONFIG.monster.reward) must agree with
--   2. clan_monster_try()    after every saved request that carries a finished monster try (won or lost): the Hall row for that season
--                            remembers the most tries; the FIRST win of the season also pays fame, points, a news line and the achievement
--   3. Giant Slayer          the achievement for beating the season monster, counted by clan_quest_counts (stats.monsterSlain)
--
-- The game server puts { "monster": { "kind", "season", "won", "first", "tries" } } in the result it saves (clan_requests.result).
-- Like the finished village (clan_village_complete), the reward is paid once per clan per season: only the save that fills in the
-- Hall row's monster_done_on pays. A later win, or a lost try, gives nothing more than a higher tries count. Rewards can never lose a
-- save: any error is turned into a warning. Nothing is dropped or deleted.
-- clan_season_rules is re-created from 20261029000400 with the one new key; everything else in it is as it was.

-- ---------------------------------------------------------------------------
-- 1. The rules
-- ---------------------------------------------------------------------------

-- Must equal CONFIG.season, CONFIG.monster.reward and CONFIG.empire.buildings[b].max in shared/clans/config.ts (shared/clans/seasonRules.test.ts checks it).
create or replace function public.clan_season_rules() returns jsonb language sql immutable set search_path = ''
as $$ select jsonb_build_object(
  'length', 35, 'warnFrom', 22, 'monsterFrom', 29, 'buildsPerDay', 2, 'buildsSavedMax', 4,
  'villageReward', jsonb_build_object('fame', 50, 'points', 10),
  'monsterReward', jsonb_build_object('fame', 100, 'points', 10),
  'maxLevels', jsonb_build_object('trainingHall', 5, 'smithy', 6, 'church', 3, 'barracks', 5, 'walls', 5, 'tower', 5, 'forge', 5, 'strongroom', 5)) $$;

-- ---------------------------------------------------------------------------
-- 2. A try at the season monster
-- ---------------------------------------------------------------------------

-- Runs after every saved request. The game's own save (clans) is written before the request row, and the earned trigger
-- (earned_when_saved) runs before this one (triggers run in name order), so the fame added here is not overwritten.
create function public.clan_monster_try()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_season_rules();
  m jsonb := new.result -> 'monster';
  v_season integer;
  v_tries integer;
  c public.clans;
  sid integer;
  n integer;
  monster_name text;
begin
  if jsonb_typeof(m) is distinct from 'object' then
    return null;
  end if;
  v_season := (m ->> 'season')::integer;
  v_tries := greatest(coalesce((m ->> 'tries')::integer, 0), 0);
  select x.* into c from public.clans x where x.player = new.player;
  if not found then
    return null;
  end if;
  select p.school_id into sid from public.profiles p where p.id = new.player;
  insert into public.clan_hall as h (player, season, school_id, clan_name, monster_tries)
  values (new.player, v_season, sid, c.name, v_tries)
  on conflict (player, season) do update
    set monster_tries = greatest(h.monster_tries, excluded.monster_tries), school_id = excluded.school_id, clan_name = excluded.clan_name;
  -- Only the first win of the season pays, and only once.
  if coalesce((m ->> 'won')::boolean, false) and coalesce((m ->> 'first')::boolean, false) then
    update public.clan_hall h set monster_done_on = public.nz_day(now())
    where h.player = new.player and h.season = v_season and h.monster_done_on is null;
    get diagnostics n = row_count;
    if n > 0 then
      update public.clans x set
        fame = x.fame + (rules -> 'monsterReward' ->> 'fame')::integer,
        stats = x.stats || jsonb_build_object('monsterSlain', coalesce((x.stats ->> 'monsterSlain')::integer, 0) + 1)
      where x.player = new.player;
      insert into public.clan_scores (player, wins, bosses, wars, points_raw, counts_for_points)
      values (new.player, 0, 0, 0, (rules -> 'monsterReward' ->> 'points')::integer, true);
      if sid is not null then
        monster_name := case m ->> 'kind'
          when 'giant' then 'Grimmor the Storm Giant'
          when 'golem' then 'Old Craghold the Stone Golem'
          when 'troll' then 'Frostjaw the Frost Troll'
          else 'the season monster' end;
        insert into public.clan_news (nz_date, school_id, text)
        values (public.nz_day(now()), sid, c.name || ' beat ' || monster_name || '!');
      end if;
      perform public.award_achievements(new.player, 'clan-quest', now());
    end if;
  end if;
  return null;
exception when others then
  -- Never lose a save because a reward went wrong.
  raise warning 'rewarding a season monster try failed (%)', sqlstate;
  return null;
end;
$$;

-- Named to run after earned_when_saved (triggers run in name order).
create trigger monster_when_saved
after insert on public.clan_requests
for each row
execute function public.clan_monster_try();

-- ---------------------------------------------------------------------------
-- 3. Giant Slayer
-- ---------------------------------------------------------------------------

-- Clan Quest's older achievements are counted in progress_counts; this one comes through the game hooks (hub_games.counts_fn),
-- whose figures are added to progress_counts. Clan Quest had no counts_fn before this file.
create function public.clan_quest_counts(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('clan_monster',
    coalesce((select (c.stats ->> 'monsterSlain')::integer from public.clans c where c.player = clan_quest_counts.who), 0))
$$;

insert into public.achievement_measures (measure) values ('clan_monster') on conflict do nothing;

update public.hub_games set counts_fn = 'public.clan_quest_counts(uuid)'::regprocedure where id = 'clan-quest';

-- Same name, emoji, measure and goal as ACHIEVEMENTS in shared/clans/rewards.ts. Sorted last (10), after Master Builder.
insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('cq-giant-slayer', 'clan-quest', 'Giant Slayer', '🗡️', 'clan_monster', 1, 10)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

-- Both are used only inside the database (the trigger, and progress_counts through hub_games_counts, which is security definer).
-- clan_season_rules was replaced in place, so its grants still stand.
revoke execute on function public.clan_monster_try(), public.clan_quest_counts(uuid) from public, anon, authenticated, service_role;

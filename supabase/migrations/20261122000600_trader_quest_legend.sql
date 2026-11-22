-- Star Trader quests R.4 (docs/plans/trader-quests-2/PLAN.md, James's answer 2): quests 6 to 10 in the Quest Log, with
-- 2 hub points each, and Star Quest Legend for all ten.
--
-- 1. The Quest Log takes the ten quest ids (it took the first five).
-- 2. trader_quest_finished: Star Quest Master stays on the first five (counted on those ids only, so five of any ten
--    never gives it); the new Star Quest Legend trophy is all ten in one Star Trader season (repeat 'season': bronze,
--    then silver, then gold on later seasons).
-- 3. trader_save: as in 20261121000500, with the ten ids.
-- 4. Measures: trader_quests is now the first five only (it could only ever be those till now); trader_quests_all is all
--    ten, for the Star Quest Legend achievement (kept through a New Season, like Master).
-- 5. Back-award: quests 6 to 10 already finished go into the log, with their 2 points (the Quest complete screen
--    already said "+2 hub points" for them). None were finished on 22 Nov 2026; this is only a safety net.
-- Nothing is dropped except the old check on the log's quest ids, which is replaced by a wider one.

-- ---------------------------------------------------------------------------
-- 1. The Quest Log takes all ten
-- ---------------------------------------------------------------------------

alter table public.trader_quest_log drop constraint trader_quest_log_quest_check;
alter table public.trader_quest_log add constraint trader_quest_log_quest_check
  check (quest in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai', 'puddle', 'gorbo', 'zip', 'pippop', 'sable'));

-- ---------------------------------------------------------------------------
-- 2. A quest just finished: Master for the first five, Legend for all ten
-- ---------------------------------------------------------------------------

create or replace function public.trader_quest_finished(player uuid, quest text, season integer, points boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer;
  added integer := 0;
begin
  select p.school_id into sid from public.profiles p where p.id = player;
  insert into public.trader_quest_log (player, quest, season, school_id)
  values (player, quest, season, sid)
  on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    return;
  end if;
  if points then
    -- add_game_points checks the achievements too.
    perform public.add_game_points(player, 'trader', 2, 'quest:' || player || ':' || season || ':' || quest);
  else
    perform public.game_progress_changed(player, 'trader');
  end if;
  if (select count(distinct l.quest) from public.trader_quest_log l
      where l.player = trader_quest_finished.player and l.season = trader_quest_finished.season
        and l.quest in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai')) >= 5 then
    perform public.award_trophy(player, 'trader-quest-master', '{}'::jsonb, season);
  end if;
  if (select count(distinct l.quest) from public.trader_quest_log l
      where l.player = trader_quest_finished.player and l.season = trader_quest_finished.season) >= 10 then
    perform public.award_trophy(player, 'trader-quest-legend', '{}'::jsonb, season);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Saving: as in 20261121000500, with the ten ids
-- ---------------------------------------------------------------------------

create or replace function public.trader_save(
  player uuid,
  expected_version integer,
  new_game jsonb,
  new_day integer,
  new_net_worth integer,
  new_moon boolean,
  new_season integer,
  request_id text,
  reply jsonb,
  claims jsonb,
  market jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer;
  new_version integer;
  was_moon boolean;
  was_finished jsonb := '[]'::jsonb;
  q text;
begin
  perform public.gem_keep_check_player(player);
  select p.school_id into sid from public.profiles p where p.id = player;
  if expected_version = 0 then
    insert into public.trader_games (player, school_id, season, game, day, net_worth, moon)
    values (player, sid, new_season, new_game, new_day, new_net_worth, new_moon)
    on conflict on constraint trader_games_pkey do nothing
    returning version into new_version;
    was_moon := false;
  else
    select g.moon, coalesce(g.game -> 'quests' -> 'finished', '[]'::jsonb) into was_moon, was_finished
    from public.trader_games g where g.player = trader_save.player and g.version = expected_version;
    update public.trader_games g
    set game = new_game, day = new_day, net_worth = new_net_worth, moon = new_moon, version = g.version + 1,
        season = new_season, updated_at = now()
    where g.player = trader_save.player and g.version = expected_version
    returning g.version into new_version;
  end if;
  if new_version is null then
    return null;
  end if;
  if claims is not null and jsonb_typeof(claims) = 'object' and claims <> '{}'::jsonb then
    update public.trader_days d set answered = d.answered || claims where d.player = trader_save.player and d.day = new_day;
  end if;
  if new_moon and not coalesce(was_moon, false) then
    insert into public.trader_moons (player, season, school_id) values (player, new_season, sid) on conflict do nothing;
  end if;
  if market is not null then
    perform public.trader_push_market(sid, new_day, market);
  end if;
  -- Quests finished in this save (the server's own game says so). A problem here never loses the save.
  if jsonb_typeof(new_game -> 'quests' -> 'finished') = 'array' then
    for q in select jsonb_array_elements_text(new_game -> 'quests' -> 'finished') loop
      if q in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai', 'puddle', 'gorbo', 'zip', 'pippop', 'sable') and not (coalesce(was_finished, '[]'::jsonb) ? q) then
        begin
          perform public.trader_quest_finished(player, q, new_season);
        exception when others then
          raise warning 'a Star Trader quest log step failed (%)', sqlstate;
        end;
      end if;
    end loop;
  end if;
  insert into public.trader_requests (player, request_id, reply) values (player, request_id, reply) on conflict do nothing;
  return new_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Measures, the achievement and the trophy
-- ---------------------------------------------------------------------------

create or replace function public.trader_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'trader_quests', (select count(distinct l.quest) from public.trader_quest_log l
                      where l.player = who and l.quest in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai')),
    'trader_quests_all', (select count(distinct l.quest) from public.trader_quest_log l where l.player = who))
$$;

insert into public.achievement_measures (measure) values ('trader_quests_all');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('trader-quest-legend', 'trader', 'Star Quest Legend', '💜', 'trader_quests_all', 10, 2, 'Finish all ten Star Trader quests.', 3);

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('trader-quest-legend', 'trader', 'Star Quest Legend', 'Finish all ten Star Trader quests in one season.', 'trophy', 'season', null, 262);

-- ---------------------------------------------------------------------------
-- 5. Back-award: quests 6 to 10 finished before this went live (with points: they were promised)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select g.player, g.season, f.quest
    from public.trader_games g
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(g.game -> 'quests' -> 'finished') = 'array' then g.game -> 'quests' -> 'finished' else '[]'::jsonb end) as f(quest)
    where f.quest in ('puddle', 'gorbo', 'zip', 'pippop', 'sable')
  loop
    perform public.trader_quest_finished(r.player, r.quest, r.season);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what (create or replace keeps the grants; said again to be sure)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.trader_quest_finished(uuid, text, integer, boolean),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb),
  public.trader_counts(uuid)
from public, anon, authenticated;
grant execute on function
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb)
to service_role;

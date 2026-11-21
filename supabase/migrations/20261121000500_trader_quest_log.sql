-- Star Trader quests Q.5 (docs/plans/trader-quests/PLAN.md, rules 10 and 11, James's answer 4):
--
-- 1. The Quest Log: one row per quest a pupil finished, per Star Trader season. A New Season clears the saved game (and
--    with it the quests), but never this table, so the keepsakes stay. Only the server writes it: trader_save adds a row
--    when the saved game (worked out by the server) says a quest was just finished.
-- 2. Hub points: 2 for each finished quest, inside the shared daily cap (add_game_points, `once` per pupil, season and
--    quest, so a save sent twice earns once). The only hub points Star Trader gives.
-- 3. The Star Quest Master achievement (all five quests finished, ever) through the hub_games hooks, kept through a New
--    Season.
-- 4. The Star Quest Master trophy: all five finished in one Star Trader season. Quests start again each season, so
--    doing them all again makes it silver, then gold.
-- 5. Back-award: quests finished before this went live go into the log (no points), with the achievement and trophy.
--
-- trader_save is the body from 20261031000200_trader_market.sql with step 1 added (same arguments, so `create or
-- replace`). The quest steps are wrapped so a problem with points or trophies can never lose the save.

-- ---------------------------------------------------------------------------
-- 1. The Quest Log
-- ---------------------------------------------------------------------------

create table public.trader_quest_log (
  player uuid not null references public.profiles (id) on delete cascade,
  quest text not null check (quest in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai')),
  season integer not null,
  school_id integer references public.schools (id) on delete cascade,
  finished_at timestamptz not null default now(),
  primary key (player, quest, season)
);

-- Read and written only by the server (the trader function and the functions below).
alter table public.trader_quest_log enable row level security;
revoke all on public.trader_quest_log from public, anon, authenticated;

-- The quests a pupil has ever finished (their keepsakes), oldest first. Server only.
create function public.trader_quest_log_of(player uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.quest order by x.first_at), '{}')
  from (select l.quest, min(l.finished_at) as first_at
        from public.trader_quest_log l where l.player = trader_quest_log_of.player group by l.quest) x
$$;

-- A quest just finished: the log row, the points, the trophy and the achievement. `points` is false for the back-award.
create function public.trader_quest_finished(player uuid, quest text, season integer, points boolean default true)
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
      where l.player = trader_quest_finished.player and l.season = trader_quest_finished.season) >= 5 then
    perform public.award_trophy(player, 'trader-quest-master', '{}'::jsonb, season);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Saving: as in 20261031000200, plus the quests just finished
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
      if q in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai') and not (coalesce(was_finished, '[]'::jsonb) ? q) then
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
-- 3. Hooks and the achievement
-- ---------------------------------------------------------------------------

-- Different quests ever finished (the Quest Log keeps them through a New Season).
create function public.trader_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('trader_quests', (select count(distinct l.quest) from public.trader_quest_log l where l.player = who))
$$;

create function public.trader_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array('Finish a quest: 2 points.'))
$$;

create function public.trader_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct l.player from public.trader_quest_log l
$$;

update public.hub_games
set counts_fn = 'public.trader_counts(uuid)',
    rules_fn = 'public.trader_point_rules()',
    players_fn = 'public.trader_players_list()',
    keep_achievements = true
where id = 'trader';

insert into public.achievement_measures (measure) values ('trader_quests');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('trader-quest-master', 'trader', 'Star Quest Master', '🌟', 'trader_quests', 5, 1, 'Finish all five Star Trader quests.', 3);

-- ---------------------------------------------------------------------------
-- 4. The trophy
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('trader-quest-master', 'trader', 'Star Quest Master', 'Finish all five Star Trader quests in one season.', 'trophy', 'season', null, 261);

-- ---------------------------------------------------------------------------
-- 5. Back-award: quests finished before this went live (no points: they were not promised then)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select g.player, g.season, f.quest, g.updated_at
    from public.trader_games g
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(g.game -> 'quests' -> 'finished') = 'array' then g.game -> 'quests' -> 'finished' else '[]'::jsonb end) as f(quest)
    where f.quest in ('zuzu', 'sprocket', 'nettle', 'vex', 'kai')
  loop
    perform public.trader_quest_finished(r.player, r.quest, r.season, false);
    update public.trader_quest_log l set finished_at = r.updated_at
    where l.player = r.player and l.quest = r.quest and l.season = r.season;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.trader_quest_log_of(uuid),
  public.trader_quest_finished(uuid, text, integer, boolean),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb),
  public.trader_counts(uuid),
  public.trader_point_rules(),
  public.trader_players_list()
from public, anon, authenticated;
grant execute on function
  public.trader_quest_log_of(uuid),
  public.trader_save(uuid, integer, jsonb, integer, integer, boolean, integer, text, jsonb, jsonb, jsonb)
to service_role;

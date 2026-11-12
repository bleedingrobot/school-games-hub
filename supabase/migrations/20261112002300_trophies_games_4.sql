-- Trophies for Marble Rush, Bond Match, Mine Runner on hard, Royal Decree's perfect reign and Training
-- (docs/PROFILE-REVIEW.md section 5; docs/plans/profile/PLAN.md card P8 part 2; trophy system 20261112000800_trophies.sql;
-- the same pattern as cards P7 and P8 part 1, 20261112001700, 20261112002000 and 20261112002200).
--
--   1. The trophy types (seven)
--   2. Marble Rush: its first achievements (it had none) and the hooks they need; Marble Cup (gold on all 8 courses) and
--      the Golden Marble picture (gold on all 8 in hard mode), from marble_bests
--   3. Bond Match: its first achievements (it had none); Bond Star (72 stars) and the Perfect Match picture (all 144),
--      from bond_match_bests
--   4. Mine Runner: the Golden Pickaxe picture (gold in all 6 hard mines), next to the Miner's Lamp
--   5. Royal Decree: the Royal Crown picture (a full reign with all 8 riddles right), next to the Royal Seal
--   6. Training: the Times Tables Shield (20 facts sessions in a hub season), counted in season_counts
--   7. Back-awards from today's records
--
-- Every watcher runs after the game has written its record and turns any error into a warning, so a game is never lost
-- to a trophy. Trophies give no hub points. A year trophy is given when the feat first comes true, so a pupil whose
-- records stay gold doesn't get it again just by playing next year.

-- ---------------------------------------------------------------------------
-- 1. The trophy types
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('marble-cup', 'marble', 'Marble Cup', 'Win gold on all 8 Marble Rush courses.', 'trophy', 'year', null, 160),
  ('marble-golden', 'marble', 'Golden Marble', 'Win gold on all 8 Marble Rush courses in hard mode.', 'picture', 'year', null, 170),
  ('bond-star', 'bond-match', 'Bond Star', 'Earn 72 stars in Bond Match.', 'trophy', 'year', null, 180),
  ('bond-perfect', 'bond-match', 'Perfect Match', 'Earn all 144 stars in Bond Match.', 'picture', 'year', null, 190),
  ('mine-pickaxe', 'mine', 'Golden Pickaxe', 'Win a gold medal in all 6 hard mines.', 'picture', 'year', null, 210),
  ('decree-crown', 'decree', 'Royal Crown', 'Rule a full reign and get all 8 riddles right.', 'picture', 'season', null, 250),
  ('training-shield', 'training', 'Times Tables Shield', 'Finish 20 Training sessions in a season.', 'trophy', 'season', null, 320);

-- ---------------------------------------------------------------------------
-- 2. Marble Rush
-- ---------------------------------------------------------------------------

-- The gold time of each of the 8 courses, in clock steps (shared/marble/nzCourses.ts medals: gold, and goldMaths for a run
-- with maths, in seconds; a test keeps the two the same). Null for a practice course. Gold is the same time in hard mode:
-- the finish time is counted the same way in both, hard mode just has a clock running down as well.
create function public.marble_gold_steps(course text, maths boolean)
returns integer
language sql
immutable
set search_path = ''
as $$
  select 60 * case course
    when 'boulder-beach' then case when maths then 18 else 22 end
    when 'crown-range' then case when maths then 47 else 52 end
    when 'geyser-valley' then case when maths then 24 else 28 end
    when 'glacier-run' then case when maths then 23 else 27 end
    when 'windy-welly' then case when maths then 43 else 49 end
    when 'alpine-crossing' then case when maths then 30 else 35 end
    when 'wide-hill' then case when maths then 19 else 23 end
    when 'gap-and-ice' then case when maths then 19 else 23 end
  end
$$;

-- Courses (of the 8) with a gold best; only hard mode if `hard`. A best only ever gets faster, so a gold stays gold.
create function public.marble_golds(who uuid, hard boolean)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct b.course)::integer from public.marble_bests b
  where b.player = who and (not hard or b.mode = 'down') and b.steps <= public.marble_gold_steps(b.course, b.maths)
$$;

-- Counts for the achievements: courses finished (of the 8) and courses with gold.
create function public.marble_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'marble_courses', (select count(distinct b.course) from public.marble_bests b
                       where b.player = who and public.marble_gold_steps(b.course, false) is not null),
    'marble_golds', public.marble_golds(who, false))
$$;

create function public.marble_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct b.player from public.marble_bests b
$$;

-- No switch (Marble Rush is on for everyone) and no points. A New Season doesn't touch Marble's bests, so its achievements
-- stay too.
insert into public.hub_games (id, counts_fn, players_fn, keep_achievements)
values ('marble', 'public.marble_counts(uuid)', 'public.marble_players_list()', true)
on conflict (id) do update set counts_fn = excluded.counts_fn, players_fn = excluded.players_fn,
  keep_achievements = excluded.keep_achievements;

insert into public.achievement_measures (measure) values ('marble_courses'), ('marble_golds');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('marble-first', 'marble', 'First roll', '🔵', 'marble_courses', 1, 1),
  ('marble-gold-1', 'marble', 'First gold', '🥇', 'marble_golds', 1, 2),
  ('marble-gold-4', 'marble', 'Gold rush', '🏅', 'marble_golds', 4, 3);

-- A new best: achievements, then the cup and the picture the first time their 8th gold comes.
create function public.marble_best_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gold integer := public.marble_gold_steps(new.course, new.maths);
  was_gold boolean;
begin
  perform public.award_achievements(new.player, 'marble', now());
  if gold is null or new.steps > gold then
    return null;
  end if;
  was_gold := tg_op = 'UPDATE' and old.steps <= gold;
  -- Without this row, was the course gold already (another mode or maths flag)? If not, this row made the 8th gold.
  if not was_gold and public.marble_golds(new.player, false) >= 8 and not exists (
    select 1 from public.marble_bests b
    where b.player = new.player and b.course = new.course and (b.mode, b.maths) <> (new.mode, new.maths)
      and b.steps <= public.marble_gold_steps(b.course, b.maths)) then
    perform public.award_trophy(new.player, 'marble-cup');
  end if;
  if new.mode = 'down' and not was_gold and public.marble_golds(new.player, true) >= 8 and not exists (
    select 1 from public.marble_bests b
    where b.player = new.player and b.course = new.course and b.mode = 'down' and b.maths <> new.maths
      and b.steps <= public.marble_gold_steps(b.course, b.maths)) then
    perform public.award_trophy(new.player, 'marble-golden');
  end if;
  return null;
exception when others then
  raise warning 'a Marble Rush trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of steps on public.marble_bests
for each row
execute function public.marble_best_trophies();

-- ---------------------------------------------------------------------------
-- 3. Bond Match
-- ---------------------------------------------------------------------------

-- Counts for the achievements: finished games, boards with 3 stars, and stars (the best on each set and board size).
create function public.bond_match_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'bond_match_played', (select count(*) from public.bond_match_games g where g.player = who),
    'bond_match_threes', (select count(*) from public.bond_match_bests b where b.player = who and b.best_stars = 3),
    'bond_match_stars', (select coalesce(sum(b.best_stars), 0) from public.bond_match_bests b where b.player = who))
$$;

create function public.bond_match_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct b.player from public.bond_match_bests b
$$;

-- Bond Match is already a hub game (switch and points rules); a New Season clears its bests, and its achievements with them.
update public.hub_games set counts_fn = 'public.bond_match_counts(uuid)', players_fn = 'public.bond_match_players_list()'
where id = 'bond-match';

insert into public.achievement_measures (measure) values ('bond_match_played'), ('bond_match_threes'), ('bond_match_stars');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('bond-first', 'bond-match', 'First match', '🃏', 'bond_match_played', 1, 1),
  ('bond-three', 'bond-match', 'Three stars', '⭐', 'bond_match_threes', 1, 2),
  ('bond-stars-36', 'bond-match', 'Star collector', '🌟', 'bond_match_stars', 36, 3);

-- A best saved: achievements, then the trophy and the picture when the stars first reach 72 and 144.
create function public.bond_match_best_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stars integer;
  before integer;
begin
  perform public.award_achievements(new.player, 'bond-match', now());
  select coalesce(sum(b.best_stars), 0)::integer into stars from public.bond_match_bests b where b.player = new.player;
  before := stars - new.best_stars + case when tg_op = 'UPDATE' then old.best_stars else 0 end;
  if stars >= 72 and before < 72 then
    perform public.award_trophy(new.player, 'bond-star', jsonb_build_object('stars', 72));
  end if;
  if stars >= 144 and before < 144 then
    perform public.award_trophy(new.player, 'bond-perfect', jsonb_build_object('stars', 144));
  end if;
  return null;
exception when others then
  raise warning 'a Bond Match trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert or update of best_stars on public.bond_match_bests
for each row
execute function public.bond_match_best_trophies();

-- A finished game that isn't a new best still counts for "First match".
create function public.bond_match_game_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_achievements(new.player, 'bond-match', now());
  return null;
exception when others then
  raise warning 'a Bond Match achievement failed (%)', sqlstate;
  return null;
end;
$$;

create trigger achievements_when_saved
after insert on public.bond_match_games
for each row
execute function public.bond_match_game_achievements();

-- ---------------------------------------------------------------------------
-- 4. Mine Runner on hard
-- ---------------------------------------------------------------------------

-- The same watcher as card P7 part 2's, for both sets of mines: the 6 plain ones (l1 to l6) give the Miner's Lamp, the 6
-- hard ones (l1:hard to l6:hard) the Golden Pickaxe.
create or replace function public.mine_best_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pattern text := case when new.level ~ ':hard$' then '^l[1-6]:hard$' else '^l[1-6]$' end;
  golds integer;
  golds_before integer;
begin
  if new.medal is distinct from 'gold' or new.level !~ pattern then
    return null;
  end if;
  select count(distinct b.level)::integer into golds
  from public.mine_bests b where b.player = new.player and b.level ~ pattern and b.medal = 'gold';
  select count(distinct x.level)::integer into golds_before from (
    select b.level from public.mine_bests b
    where b.player = new.player and b.level ~ pattern and b.medal = 'gold'
      and not (b.level = new.level and b.maths = new.maths)
    union all
    select old.level where tg_op = 'UPDATE' and old.medal = 'gold' and old.level ~ pattern
  ) x;
  if golds >= 6 and golds_before < 6 then
    perform public.award_trophy(new.player, case when new.level ~ ':hard$' then 'mine-pickaxe' else 'mine-lamp' end);
  end if;
  return null;
exception when others then
  raise warning 'a Mine Runner trophy failed (%)', sqlstate;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Royal Decree's perfect reign
-- ---------------------------------------------------------------------------

-- How many of a reign's riddles were marked right (a full reign has 8: shared/decree/engine.ts RIDDLES_IN_REIGN).
create function public.decree_riddles_right(answered jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from jsonb_each(answered) a(slot, v) where (a.v ->> 'right')::boolean
$$;

-- The same watcher as card P7 part 1's, with the Royal Crown for a full reign with all 8 riddles right.
create or replace function public.decree_reign_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'full' and (tg_op = 'INSERT' or old.status is distinct from 'full') then
    perform public.award_trophy(new.player, 'decree-seal', jsonb_build_object('reign', new.id));
    if public.decree_riddles_right(new.answered) >= 8 then
      perform public.award_trophy(new.player, 'decree-crown', jsonb_build_object('reign', new.id));
    end if;
  end if;
  return null;
exception when others then
  raise warning 'a Royal Decree trophy failed (%)', sqlstate;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Training
-- ---------------------------------------------------------------------------

-- A whole facts session finished (Quick looks rounds are pictures, not times tables): counted in the hub season, and the
-- 20th of the season gives the Times Tables Shield. A session sent twice is one row, so it counts once.
create function public.training_session_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'facts' and public.season_count_add(new.player, 'training', 'sessions') = 20 then
    perform public.award_trophy(new.player, 'training-shield', jsonb_build_object('sessions', 20));
  end if;
  return null;
exception when others then
  raise warning 'a Training trophy failed (%)', sqlstate;
  return null;
end;
$$;

create trigger trophies_when_saved
after insert on public.training_sessions
for each row
execute function public.training_session_trophies();

revoke execute on function
  public.marble_gold_steps(text, boolean), public.marble_golds(uuid, boolean), public.marble_counts(uuid),
  public.marble_players_list(), public.marble_best_trophies(), public.bond_match_counts(uuid),
  public.bond_match_players_list(), public.bond_match_best_trophies(), public.bond_match_game_achievements(),
  public.decree_riddles_right(jsonb), public.training_session_trophies()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Back-awards
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  res jsonb;
begin
  -- Achievements for everyone who has played Marble Rush or Bond Match.
  perform public.award_achievements(p, 'marble', now()) from public.marble_players_list() p;
  perform public.award_achievements(p, 'bond-match', now()) from public.bond_match_players_list() p;

  -- Marble Rush: gold on all 8 courses (and all 8 in hard mode), dated by the newest of those golds.
  for r in select h.hard, b.player, max(b.achieved_at) as at
           from (values (false), (true)) h(hard)
           join public.marble_bests b on (not h.hard or b.mode = 'down')
           where b.steps <= public.marble_gold_steps(b.course, b.maths)
           group by h.hard, b.player
           having count(distinct b.course) >= 8 loop
    res := public.award_trophy(r.player, case when r.hard then 'marble-golden' else 'marble-cup' end);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at
      where player = r.player and trophy = case when r.hard then 'marble-golden' else 'marble-cup' end and season = 0;
    end if;
  end loop;

  -- Bond Match: 72 and 144 stars, dated by the newest best.
  for r in select b.player, sum(b.best_stars) as stars, max(b.updated_at) as at from public.bond_match_bests b
           group by b.player having sum(b.best_stars) >= 72 loop
    res := public.award_trophy(r.player, 'bond-star', jsonb_build_object('stars', 72));
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'bond-star' and season = 0;
    end if;
    if r.stars >= 144 then
      res := public.award_trophy(r.player, 'bond-perfect', jsonb_build_object('stars', 144));
      if (res ->> 'won')::boolean then
        update public.trophies set earned_at = r.at where player = r.player and trophy = 'bond-perfect' and season = 0;
      end if;
    end if;
  end loop;

  -- Mine Runner: gold in all 6 hard mines, dated by the latest of each mine's first gold.
  for r in select m.player, max(m.first_gold) as at from (
             select b.player, b.level, min(b.achieved_at) as first_gold from public.mine_bests b
             where b.level ~ '^l[1-6]:hard$' and b.medal = 'gold' group by b.player, b.level) m
           group by m.player having count(*) >= 6 loop
    res := public.award_trophy(r.player, 'mine-pickaxe');
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'mine-pickaxe' and season = 0;
    end if;
  end loop;

  -- Royal Decree: every full reign with all 8 riddles right, in the hub season it finished in.
  for r in select d.player, d.id, coalesce(d.finished_at, d.updated_at) as at,
                  case when public.nz_day(coalesce(d.finished_at, d.updated_at)) < s.hub_season_start then 0
                       else (public.nz_day(coalesce(d.finished_at, d.updated_at)) - s.hub_season_start) / s.hub_season_days + 1 end as season
           from public.decree_reigns d
           join public.profiles p on p.id = d.player
           join public.schools s on s.id = p.school_id
           where d.status = 'full' and public.decree_riddles_right(d.answered) >= 8 order by 3 loop
    res := public.award_trophy(r.player, 'decree-crown', jsonb_build_object('reign', r.id), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.at where player = r.player and trophy = 'decree-crown' and season = r.season;
    end if;
  end loop;

  -- Training: facts sessions counted in the hub season they were finished in; 20 in a season give the shield, dated by
  -- the 20th.
  insert into public.season_counts (player, game, season, year, key, n)
  select w.player, 'training', w.season, extract(year from public.hub_season_began(w.school_id, w.season))::integer, 'sessions', count(*)
  from (
    select t.player, p.school_id, (public.nz_day(t.finished_at) - s.hub_season_start) / s.hub_season_days + 1 as season
    from public.training_sessions t
    join public.profiles p on p.id = t.player
    join public.schools s on s.id = p.school_id
    where t.kind = 'facts' and public.nz_day(t.finished_at) >= s.hub_season_start
  ) w
  group by w.player, w.season, w.school_id
  on conflict on constraint season_counts_pkey do update set n = excluded.n, updated_at = now();

  for r in
    select x.player, x.season, x.finished_at from (
      select t.player, (public.nz_day(t.finished_at) - s.hub_season_start) / s.hub_season_days + 1 as season, t.finished_at,
             row_number() over (partition by t.player, (public.nz_day(t.finished_at) - s.hub_season_start) / s.hub_season_days
                                order by t.finished_at, t.seed) as nth
      from public.training_sessions t
      join public.profiles p on p.id = t.player
      join public.schools s on s.id = p.school_id
      where t.kind = 'facts' and public.nz_day(t.finished_at) >= s.hub_season_start) x
    where x.nth = 20 order by x.finished_at
  loop
    res := public.award_trophy(r.player, 'training-shield', jsonb_build_object('sessions', 20), r.season);
    if (res ->> 'won')::boolean then
      update public.trophies set earned_at = r.finished_at where player = r.player and trophy = 'training-shield' and season = r.season;
    end if;
  end loop;
end;
$$;

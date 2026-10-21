-- Archery Challenge, stage 7: how it fits into the hub (docs/ARCHERY-PLAN.md, sections 7 and 8).
--
-- NOT APPLIED to the live database. Apply after 20261021000300_archery.sql and 20261022000100_archery_classmates.sql.
--
-- 1. The teacher's "Classmate fights" switch: app_settings.archery_duels, per class, ON to start (James, 22 Oct 2026),
--    beside the main switch; teacher_set_archery_duels(). While it's off (or the game is), "I'm here" lists nobody and
--    ends the pupil's open classmate fights fairly (gear back to both, nobody gets points), and the server function
--    refuses every classmate-fight step.
-- 2. Achievement counts: archery_players.stats, numbers the server function adds through archery_note() once per fight
--    or round, worked out from what it replayed or marked (shared/archery/stats.ts). Bows owned are read from the
--    Armory itself.
-- 3. The hooks: counts_fn and players_fn added to Archery's hub_games row; ten achievements (game = 'archery').
-- 4. The teacher's class summary: teacher_archery_summary(), counts only, the teacher's own pupils only.
--
-- Nothing shared is re-created. archery_here() and archery_duel_load() (stage 6's own functions) are replaced with
-- create or replace; stage 6's migration isn't applied either.

-- ---------------------------------------------------------------------------
-- 1. The Classmate fights switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column archery_duels boolean not null default true;

create function public.teacher_set_archery_duels(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Archery Challenge setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set archery_duels = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- Are classmate fights on for this pupil's class: the game on, and its Classmate fights switch on?
create function public.archery_duels_on_for(player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.archery_enabled and s.archery_duels from public.settings_of(player) s), false)
$$;

-- A fight ended because classmate fights were switched off says so (the screens' words differ from the main switch's).
alter table public.archery_duels drop constraint archery_duels_ending_check;
alter table public.archery_duels add constraint archery_duels_ending_check
  check (ending in ('finished', 'left', 'timeouts', 'switched-off', 'duels-off', 'idle'));

-- Ends this pupil's open classmate fights because classmate fights are off for their class: a fight being played ends
-- with nobody winning, one that never started is called off, and everyone gets back what they didn't use (the row's
-- `used` is saved with every turn, so it's exact). Both screens hear it through Realtime.
create function public.archery_duels_end_for(player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.archery_duels;
begin
  for d in
    select * from public.archery_duels x
    where x.status in ('asked', 'packing', 'playing') and archery_duels_end_for.player in (x.seat_a, x.seat_b)
  loop
    perform public.archery_duel_close(d.id, d.version, case when d.status = 'playing' then 'done' else 'cancelled' end,
      case when d.status = 'playing' then 'duels-off' end, null, null, null, null, null);
  end loop;
end;
$$;

-- "I'm here" (stage 6), now also saying whether classmate fights are on:
--   off:     true if the game is switched off for their class (then nothing else);
--   duels:   false if classmate fights are switched off for their class: nobody is listed, no challenges, and their own
--            open classmate fights end fairly (above). The pupil isn't noted as here, so nobody can challenge them.
-- Otherwise as before: online, asks, duel (see 20261022000100_archery_classmates.sql), with duels: true.
create or replace function public.archery_here()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_class uuid;
  my_school integer;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles p where p.id = me and p.role = 'student' and not p.hidden) then
    return jsonb_build_object('online', '[]'::jsonb, 'asks', '[]'::jsonb, 'duel', null);
  end if;
  if not public.archery_on_for(me) then
    return jsonb_build_object('off', true);
  end if;
  if not public.archery_duels_on_for(me) then
    delete from public.archery_here h where h.player = me;
    perform public.archery_duels_end_for(me);
    return jsonb_build_object('duels', false, 'online', '[]'::jsonb, 'asks', '[]'::jsonb, 'duel', null);
  end if;
  insert into public.archery_here as h (player, seen_at) values (me, now())
  on conflict (player) do update set seen_at = now();
  perform public.archery_duel_tidy_for(me);
  my_class := public.current_class_of(me);
  select p.school_id into my_school from public.profiles p where p.id = me;
  return jsonb_build_object(
    'duels', true,
    'online', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar, 'busy', public.archery_duel_busy(p.id)) order by p.display_name)
      from public.archery_here h
      join public.profiles p on p.id = h.player
      where my_class is not null
        and h.seen_at > now() - interval '75 seconds'
        and p.id <> me and p.role = 'student' and not p.hidden and p.school_id = my_school
        and public.current_class_of(p.id) = my_class), '[]'::jsonb),
    'asks', coalesce((
      select jsonb_agg(jsonb_build_object('duel', d.id, 'from', d.name_a, 'world', d.world, 'deadline', d.deadline) order by d.created_at)
      from public.archery_duels d
      where d.seat_b = me and d.status = 'asked' and d.deadline > now()), '[]'::jsonb),
    'duel', (
      select to_jsonb(d) from public.archery_duels d
      where (d.status in ('packing', 'playing') and me in (d.seat_a, d.seat_b)) or (d.status = 'asked' and d.seat_a = me)
      order by d.created_at desc limit 1));
end;
$$;

-- One fight, whether the game is on for each player's class, and whether classmate fights are:
-- { duel, on: [a, b], duels: [a, b] }, or null.
create or replace function public.archery_duel_load(duel bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('duel', to_jsonb(d),
    'on', jsonb_build_array(public.archery_on_for(d.seat_a), public.archery_on_for(d.seat_b)),
    'duels', jsonb_build_array(public.archery_duels_on_for(d.seat_a), public.archery_duels_on_for(d.seat_b)))
  from public.archery_duels d where d.id = archery_duel_load.duel
$$;

-- ---------------------------------------------------------------------------
-- 2. Achievement counts
-- ---------------------------------------------------------------------------

-- { "<count>": n }: see shared/archery/stats.ts for each one. Only the server function adds to them (archery_note).
alter table public.archery_players add column stats jsonb not null default '{}' check (jsonb_typeof(stats) = 'object');

-- Adds to a pupil's counts once per `once` (a fight or round: sent twice, counted once), then checks their Archery
-- achievements. Each number added is a whole number from 0 to 10, and only the known counts are kept. An empty `add`
-- only checks the achievements (after a bow is bought). Returns true if it was added (false: already counted).
create function public.archery_note(player uuid, once text, add jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh integer;
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(add) <> 'object' or exists (
    select 1 from jsonb_each(add) e
    where e.key not in ('win_forest', 'win_desert', 'win_snow', 'win_city', 'plain_wins', 'hawk_wins', 'perfect_rounds', 'duel_wins', 'duels')
       or jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric not in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)) then
    raise exception 'Those counts are not right.' using errcode = '22023';
  end if;
  -- The once-only keys share the requests table (kept 2 days; a browser's own request ids never have a colon).
  insert into public.archery_requests (player, request_id, reply) values (player, once, '{}')
  on conflict do nothing;
  get diagnostics fresh = row_count;
  if fresh = 0 then
    return false;
  end if;
  insert into public.archery_players (player) values (player) on conflict do nothing;
  update public.archery_players p
  set stats = public.archery_gear_plus(p.stats, add, 1), updated_at = now()
  where p.player = archery_note.player;
  perform public.game_progress_changed(player, 'archery');
  return true;
end;
$$;

-- The counts for Archery's achievements (the hub_games counts hook).
create function public.archery_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'archery_win_forest', coalesce((p.stats ->> 'win_forest')::integer, 0),
    'archery_win_desert', coalesce((p.stats ->> 'win_desert')::integer, 0),
    'archery_win_snow', coalesce((p.stats ->> 'win_snow')::integer, 0),
    'archery_win_city', coalesce((p.stats ->> 'win_city')::integer, 0),
    'archery_plain_wins', coalesce((p.stats ->> 'plain_wins')::integer, 0),
    'archery_hawk_wins', coalesce((p.stats ->> 'hawk_wins')::integer, 0),
    'archery_perfect_rounds', coalesce((p.stats ->> 'perfect_rounds')::integer, 0),
    'archery_duel_wins', coalesce((p.stats ->> 'duel_wins')::integer, 0),
    'archery_duels', coalesce((p.stats ->> 'duels')::integer, 0),
    -- Bought bows (the Starter Bow is always owned and never listed).
    'archery_bows', coalesce(jsonb_array_length(p.bows), 0))
  from (select who) w
  left join public.archery_players p on p.player = w.who
$$;

-- Pupils with Archery progress outside points (a rebuild gives their achievements back).
create function public.archery_progress_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select p.player from public.archery_players p where p.stats <> '{}' or jsonb_array_length(p.bows) > 0
$$;

-- ---------------------------------------------------------------------------
-- 3. The hooks and the achievements
-- ---------------------------------------------------------------------------

-- Achievements stay through a New Season (James, 22 Oct 2026), as Maths Monsters', Dragon Maths' and Clan Quest's do,
-- even though the season wipes the coins, gear, bows and counts: a badge earned is kept, and the counts start again.
update public.hub_games set counts_fn = 'public.archery_counts(uuid)', players_fn = 'public.archery_progress_players()', keep_achievements = true
where id = 'archery';

insert into public.achievement_measures (measure) values
  ('archery_win_forest'), ('archery_win_desert'), ('archery_win_snow'), ('archery_win_city'), ('archery_plain_wins'),
  ('archery_hawk_wins'), ('archery_perfect_rounds'), ('archery_bows'), ('archery_duel_wins'), ('archery_duels');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('archery-forest', 'archery', 'Forest champion', '🌲', 'archery_win_forest', 1, 1),
  ('archery-desert', 'archery', 'Desert champion', '🏜️', 'archery_win_desert', 1, 2),
  ('archery-snow', 'archery', 'Snow champion', '❄️', 'archery_win_snow', 1, 3),
  ('archery-city', 'archery', 'City champion', '🏙️', 'archery_win_city', 1, 4),
  ('archery-plain', 'archery', 'Plain Arrows only', '🏹', 'archery_plain_wins', 1, 5),
  ('archery-hawk', 'archery', 'Beat Hawk', '🦅', 'archery_hawk_wins', 1, 6),
  ('archery-perfect', 'archery', 'Perfect speed round', '⚡', 'archery_perfect_rounds', 1, 7),
  ('archery-bows', 'archery', 'Every bow', '🎯', 'archery_bows', 4, 8),
  ('archery-duel-win', 'archery', 'Beat a classmate', '🤝', 'archery_duel_wins', 1, 9),
  ('archery-duels-10', 'archery', 'Ten classmate fights', '🏅', 'archery_duels', 10, 10);

-- ---------------------------------------------------------------------------
-- 4. The teacher's class summary
-- ---------------------------------------------------------------------------

-- A few counts for the teacher's panel, for one class they teach (or, with no class, all their pupils): how many pupils
-- played in the last 7 days, bot and classmate fights finished in the last 7 days, and speed rounds in the last day
-- (rounds are kept 2 days). Counts only: never a pupil's name, coins or maths results.
create function public.teacher_archery_summary(target_class uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kids uuid[];
  week timestamptz := now() - interval '7 days';
begin
  perform public.require_teacher();
  if target_class is not null and not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select coalesce(array_agg(s.id), '{}') into kids
  from public.my_students() s(id)
  where target_class is null or exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class);
  return jsonb_build_object(
    'pupils', cardinality(kids),
    'played', (
      select count(distinct k)::integer from unnest(kids) k
      where exists (select 1 from public.archery_fights f where f.player = k and f.created_at > week)
         or exists (select 1 from public.archery_rounds r where r.player = k and r.created_at > week)
         or exists (select 1 from public.archery_duels d where k in (d.seat_a, d.seat_b) and d.created_at > week and d.status = 'done')),
    'botFights', (
      select count(*)::integer from public.archery_fights f
      where f.player = any (kids) and f.status = 'done' and f.finished_at > week),
    'duels', (
      select count(*)::integer from public.archery_duels d
      where (d.seat_a = any (kids) or d.seat_b = any (kids)) and d.status = 'done' and d.ending = 'finished' and d.finished_at > week),
    'rounds', (
      select count(*)::integer from public.archery_rounds r
      where r.player = any (kids) and r.created_at > now() - interval '1 day'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_archery_duels(boolean, uuid), public.archery_duels_on_for(uuid), public.archery_duels_end_for(uuid),
  public.archery_note(uuid, text, jsonb), public.archery_counts(uuid), public.archery_progress_players(),
  public.teacher_archery_summary(uuid)
from public, anon, authenticated;
-- create or replace keeps the old grants, but say it again so this file reads on its own.
revoke execute on function public.archery_here(), public.archery_duel_load(bigint) from public, anon;
grant execute on function public.archery_here() to authenticated;
grant execute on function public.teacher_set_archery_duels(boolean, uuid), public.teacher_archery_summary(uuid) to authenticated;
grant execute on function public.archery_note(uuid, text, jsonb), public.archery_duel_load(bigint) to service_role;

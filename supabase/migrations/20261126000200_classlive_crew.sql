-- Class Live: Saboteur Crew (docs/CREW-PLAN.md). Nothing is deleted. Builds on 20261125000800_classlive_activities: only
-- inserts rows, plus one new function of its own.
--
--   1. The 'crew' activity (pupils move; MAX_SPEED in shared/classlive/crew.ts).
--   2. classlive_crew_move(): a pupil's device saves its spot through classlive_move() and gets back every other spot
--      with its kind (no names, no ids): 0 a player, 1 a helper drone, 2 a fellow Glitch (only ever sent to a Glitch).
--      While the lights are out, Crew on the floor only get spots within 0.2 of themselves (unless their camera is on).
--      Times in the session are ms since the room started (classlive_rooms.started_ms).
--   3. Trophies: machines mended, Glitches found, rounds won as a Glitch (classlive_stats.extra via PupilReward.extra).

-- ---------------------------------------------------------------------------
-- 1. The activity
-- ---------------------------------------------------------------------------

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('crew', 'Saboteur Crew', true, 0.6, 'Be on the winning side in a Saboteur Crew round: 2 more points.', 15);

-- ---------------------------------------------------------------------------
-- 2. Moving with roles
-- ---------------------------------------------------------------------------

-- Answers { me: { glitch, drone }, spots: [[x, y, kind], ...] }, or null when the caller isn't playing a live Saboteur
-- Crew room.
create function public.classlive_crew_move(target bigint, x double precision, y double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  saved jsonb;
  sess jsonb;
  started bigint;
  t bigint;
  mine jsonb;
  is_glitch boolean;
  dark boolean;
  mx double precision;
  my double precision;
begin
  if me is null then
    return null;
  end if;
  select r.started_ms, st.session into started, sess
  from public.classlive_rooms r join public.classlive_state st on st.room = r.id
  where r.id = target and r.activity = 'crew' and r.state = 'live';
  if not found or started is null then
    return null;
  end if;
  saved := public.classlive_move(target, x, y);
  if saved is null then
    return null;
  end if;
  t := floor(extract(epoch from clock_timestamp()) * 1000) - started;
  mine := sess #> array['game', 'mine', me::text];
  is_glitch := coalesce((mine ->> 'glitch')::boolean, false);
  dark := coalesce((sess #>> '{game,round,lightsTo}')::bigint, 0) > t
    and not is_glitch
    and not coalesce((mine ->> 'drone')::boolean, false)
    and coalesce((mine ->> 'cameraTo')::bigint, 0) <= t;
  select s.x, s.y into mx, my from public.classlive_spots s where s.room = target and s.player = me;
  return jsonb_build_object(
    'me', jsonb_build_object('glitch', is_glitch, 'drone', coalesce((mine ->> 'drone')::boolean, false)),
    'spots', coalesce((
      select jsonb_agg(jsonb_build_array(round(s.x::numeric, 4), round(s.y::numeric, 4), k.kind))
      from public.classlive_spots s
      cross join lateral (select sess #> array['game', 'mine', s.player::text] as m) mm
      cross join lateral (select case
        when coalesce((mm.m ->> 'drone')::boolean, false) then 1
        when is_glitch and coalesce((mm.m ->> 'glitch')::boolean, false) then 2
        else 0 end as kind) k
      where s.room = target and s.player <> me and mm.m is not null
        and (not dark or sqrt((s.x - mx) ^ 2 + (s.y - my) ^ 2) <= 0.2)
    ), '[]'::jsonb));
end;
$$;

revoke execute on function public.classlive_crew_move(bigint, double precision, double precision) from public, anon, authenticated;
grant execute on function public.classlive_crew_move(bigint, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trophies (PupilReward.extra keys: crew_mends, crew_detects, crew_glitchwins)
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure)
values ('classlive_crew_mends'), ('classlive_crew_detects'), ('classlive_crew_glitchwins');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-chief-engineer', 'classlive', 'Chief Engineer', '🔧', 'classlive_crew_mends', 25, 60, 'Mend 25 machines in Saboteur Crew.', 1),
  ('classlive-sharp-detective', 'classlive', 'Sharp Detective', '🔍', 'classlive_crew_detects', 10, 61, 'Vote for a real Glitch 10 times in Saboteur Crew.', 2),
  ('classlive-master-glitch', 'classlive', 'Master Glitch', '⚡', 'classlive_crew_glitchwins', 5, 62, 'Win 5 Saboteur Crew rounds as a Glitch.', 2);

-- Class Live: Ghost Tag (docs/GHOST-PLAN.md). Nothing is deleted. Builds on 20261125000800_classlive_activities: only
-- inserts rows, plus one new function of its own.
--
--   1. The 'ghost' activity (pupils move; MAX_SPEED in shared/classlive/ghost.ts).
--   2. classlive_ghost_move(): a pupil's device saves its spot through classlive_move() and gets back every other spot
--      with who is a ghost (no names, no ids). Pupils who are invisible are left out, except to a ghost whose lantern
--      is lit and who is near them. Times in the session are ms since the room started (classlive_rooms.started_ms).
--   3. Trophies: catches, rounds won, vanishes (classlive_stats.extra via PupilReward.extra).

-- ---------------------------------------------------------------------------
-- 1. The activity
-- ---------------------------------------------------------------------------

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('ghost', 'Ghost Tag', true, 0.6, 'Finish on the Ghost Tag podium: 2 more points.', 9);

-- ---------------------------------------------------------------------------
-- 2. Moving with roles
-- ---------------------------------------------------------------------------

-- Answers { me: { ghost }, spots: [[x, y, kind], ...] } where kind 0 is a pupil, 1 a ghost, 2 a frozen ghost and 3 an
-- invisible pupil shown by the caller's lantern; or null when the caller isn't playing a live Ghost Tag room.
create function public.classlive_ghost_move(target bigint, x double precision, y double precision)
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
  lantern boolean;
  mx double precision;
  my double precision;
begin
  if me is null then
    return null;
  end if;
  select r.started_ms, st.session into started, sess
  from public.classlive_rooms r join public.classlive_state st on st.room = r.id
  where r.id = target and r.activity = 'ghost' and r.state = 'live';
  if not found or started is null then
    return null;
  end if;
  saved := public.classlive_move(target, x, y);
  if saved is null then
    return null;
  end if;
  t := floor(extract(epoch from clock_timestamp()) * 1000) - started;
  mine := sess #> array['game', 'mine', me::text];
  lantern := coalesce((mine ->> 'ghost')::boolean, false) and coalesce((mine ->> 'lanternTo')::bigint, 0) > t;
  select s.x, s.y into mx, my from public.classlive_spots s where s.room = target and s.player = me;
  return jsonb_build_object(
    'me', jsonb_build_object('ghost', coalesce((mine ->> 'ghost')::boolean, false)),
    'spots', coalesce((
      select jsonb_agg(jsonb_build_array(round(s.x::numeric, 4), round(s.y::numeric, 4), k.kind))
      from public.classlive_spots s
      cross join lateral (select sess #> array['game', 'mine', s.player::text] as m) mm
      cross join lateral (select case
        when coalesce((mm.m ->> 'ghost')::boolean, false) then
          case when coalesce((mm.m ->> 'frozenTo')::bigint, 0) > t then 2 else 1 end
        when coalesce((mm.m ->> 'hideTo')::bigint, 0) > t then
          case when lantern and sqrt((s.x - mx) ^ 2 + (s.y - my) ^ 2) < 0.28 then 3 else -1 end
        else 0 end as kind) k
      where s.room = target and s.player <> me and mm.m is not null and k.kind >= 0
    ), '[]'::jsonb));
end;
$$;

revoke execute on function public.classlive_ghost_move(bigint, double precision, double precision) from public, anon, authenticated;
grant execute on function public.classlive_ghost_move(bigint, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trophies (PupilReward.extra keys: ghost_tags, ghost_crowns, ghost_vanishes)
-- ---------------------------------------------------------------------------

insert into public.achievement_measures (measure)
values ('classlive_ghost_tags'), ('classlive_ghost_crowns'), ('classlive_ghost_vanishes');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-ghost-hunter', 'classlive', 'Ghost Hunter', '👻', 'classlive_ghost_tags', 20, 40, 'Catch 20 pupils as a Ghost Tag ghost.', 1),
  ('classlive-last-light', 'classlive', 'Last Light', '🕯️', 'classlive_ghost_crowns', 5, 41, 'Win 5 Ghost Tag rounds without being caught.', 2),
  ('classlive-vanishing-act', 'classlive', 'Vanishing Act', '✨', 'classlive_ghost_vanishes', 25, 42, 'Turn invisible 25 times in Ghost Tag.', 1);

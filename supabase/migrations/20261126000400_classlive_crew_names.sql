-- Glitches (Class Live `crew`, was "Saboteur Crew"): pupils' own maps show who is who (James, 26 Nov 2026 NZ: "it does not show kids names... they won't be
-- able to guess"), then "let's generate fun random names for players for this game". Each player gets a factory name
-- for the game (game.mine[id].nick, e.g. "Turbo Toaster", made by the server when they join), shown everywhere in the
-- game instead of their real name. classlive_crew_move() now sends it with each other player's spot, and their colour:
-- [x, y, kind, factory name, colour] (a first name only for a game saved before factory names). Still no ids, and still
-- no roles (a fellow Glitch is marked only for a Glitch).
-- Only this game's own function is replaced; none of the shared classlive_* functions change.

create or replace function public.classlive_crew_move(target bigint, x double precision, y double precision)
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
      select jsonb_agg(jsonb_build_array(
        round(s.x::numeric, 4), round(s.y::numeric, 4), k.kind,
        coalesce(mm.m ->> 'nick', left(split_part(btrim(coalesce(sess #>> array['players', s.player::text, 'name'], '')), ' ', 1), 20)),
        coalesce((sess #>> array['players', s.player::text, 'colour'])::int, 0)))
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
-- The game is called Glitches (James, 26 Nov 2026 NZ); its id stays 'crew'. The roles are still Crew and Glitches.
-- ---------------------------------------------------------------------------

update public.classlive_activities
set name = 'Glitches', reward_line = 'Be on the winning side in a Glitches round: 2 more points.'
where id = 'crew';

update public.achievement_types
set how = replace(how, 'Saboteur Crew', 'Glitches')
where id in ('classlive-chief-engineer', 'classlive-sharp-detective', 'classlive-master-glitch');

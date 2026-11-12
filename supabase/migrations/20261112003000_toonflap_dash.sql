-- Toon Flap stage F.7: Sky Dash (docs/TOON-FLAP-PLAN.md, section 9). The classic one-touch mode, open after level 5.
-- A dash is kept in toonflap_runs like a level run (level 'dash', no medal) with the walls flown past; each pupil's best
-- this season goes in toonflap_dash_best for the class board, and New Season clears it (season_fn). Pupils can't read or
-- change any of it: the toonflap function does everything with the server's key. Nothing existing is dropped or changed
-- except one new column and the game's points lines and season hook.

alter table public.toonflap_runs add column walls integer check (walls is null or walls >= 0);

create table public.toonflap_dash_best (
  player uuid primary key references public.profiles (id) on delete cascade,
  walls integer not null check (walls >= 0),
  at timestamptz not null default now()
);
alter table public.toonflap_dash_best enable row level security;
revoke all on public.toonflap_dash_best from anon, authenticated;

-- Closes an open dash, saves the progress (only if its version still matches) and keeps the season best, together.
-- Answers {"before": the season best before this dash (0: none)}, or null if nothing was saved.
create function public.toonflap_dash_finish(
  player uuid, seed text, version integer, progress jsonb, flaps text, seconds numeric, walls integer, bumps integer,
  checks_right integer, potion boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  had integer;
begin
  if jsonb_typeof(progress) is distinct from 'object' or flaps is null or seconds is null or seconds < 0 or walls is null
     or walls < 0 or bumps is null or bumps < 0 or checks_right is null or checks_right < 0 or potion is null
     or version is null or version < 0 then
    raise exception 'That dash is not right.' using errcode = '22023';
  end if;
  perform 1 from public.toonflap_runs r
  where r.player = toonflap_dash_finish.player and r.seed = toonflap_dash_finish.seed and r.open and r.level = 'dash' for update;
  if not found then
    return null;
  end if;
  if version = 0 then
    insert into public.toonflap_progress (player, progress) values (player, progress)
    on conflict on constraint toonflap_progress_pkey do nothing;
  else
    update public.toonflap_progress t
    set progress = toonflap_dash_finish.progress, version = t.version + 1, updated_at = now()
    where t.player = toonflap_dash_finish.player and t.version = toonflap_dash_finish.version;
  end if;
  if not found then
    return null;
  end if;
  update public.toonflap_runs r
  set open = false, finished_at = now(), finished_day = (now() at time zone 'Pacific/Auckland')::date,
      flaps = toonflap_dash_finish.flaps, seconds = toonflap_dash_finish.seconds, walls = toonflap_dash_finish.walls,
      bumps = toonflap_dash_finish.bumps, checks_right = toonflap_dash_finish.checks_right, gaps_right = 0,
      potion = toonflap_dash_finish.potion
  where r.player = toonflap_dash_finish.player and r.seed = toonflap_dash_finish.seed;
  select b.walls into had from public.toonflap_dash_best b where b.player = toonflap_dash_finish.player for update;
  if had is null then
    insert into public.toonflap_dash_best (player, walls) values (player, walls);
  elsif walls > had then
    update public.toonflap_dash_best b set walls = toonflap_dash_finish.walls, at = now() where b.player = toonflap_dash_finish.player;
  end if;
  return jsonb_build_object('before', coalesce(had, 0));
end;
$$;

-- The pupil's class board this season: classmates (pupils only, not hidden) with a dash, best first, top ten, and the
-- pupil's own line. Names are display names (never real names). A pupil with no class sees only themselves.
create function public.toonflap_dash_board(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mates as (
    select distinct m2.student_id as id
    from public.class_members m1
    join public.class_members m2 on m2.class_id = m1.class_id
    where m1.student_id = toonflap_dash_board.player
    union select toonflap_dash_board.player
  ),
  ranked as (
    select rank() over (order by b.walls desc)::integer as place, p.display_name as name, b.walls,
           (b.player = toonflap_dash_board.player) as me, b.at
    from public.toonflap_dash_best b
    join mates on mates.id = b.player
    join public.profiles p on p.id = b.player
    where not p.hidden and p.role = 'student'
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', r.place, 'name', r.name, 'walls', r.walls, 'me', r.me)
                                       order by r.place, r.at)
                      from (select * from ranked order by place, at limit 10) r), '[]'::jsonb),
    'mine', (select jsonb_build_object('place', r.place, 'name', r.name, 'walls', r.walls, 'me', true) from ranked r where r.me))
$$;

-- New Season clears the Sky Dash board for those pupils (levels, medals, flyers and potions stay).
create function public.toonflap_season(players uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.toonflap_dash_best b where b.player = any(players);
$$;

update public.hub_games set season_fn = 'public.toonflap_season(uuid[])' where id = 'toonflap';

create or replace function public.toonflap_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Finish a level: 2 points.',
    'Finish a level for the first time: 5 more.',
    'A new gold medal: 3 more.',
    'Finish a Sky Dash: 1 point. Your best Sky Dash this season: 3 more.',
    'Only your first 10 finished flights each day earn points. Right answers earn no points: they take time off.'))
$$;

revoke execute on function
  public.toonflap_dash_finish(uuid, text, integer, jsonb, text, numeric, integer, integer, integer, boolean),
  public.toonflap_dash_board(uuid), public.toonflap_season(uuid[])
from public, anon, authenticated;
grant execute on function
  public.toonflap_dash_finish(uuid, text, integer, jsonb, text, numeric, integer, integer, integer, boolean),
  public.toonflap_dash_board(uuid), public.toonflap_season(uuid[])
to service_role;

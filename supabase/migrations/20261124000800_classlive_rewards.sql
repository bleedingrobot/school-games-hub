-- Class Live stage 4 (docs/CLASSLIVE-PLAN.md): rewards and trophies for Star Web, Serpent Chain and Mystery Mural.
--
--   1. classlive_stats: each pupil's totals for the trophies; classlive_finished: sessions already paid (room + seed).
--   2. classlive_finish(room, done): pays a finished session once: hub points (add_game_points) and the totals, then
--      checks the trophies. The points are worked out on the server (shared/classlive/rewards.ts), at most 10 a session.
--   3. hub_games hooks, measures and trophies.
-- Everything here is for the server key only. Nothing is deleted.

create table public.classlive_stats (
  player uuid primary key references public.profiles (id) on delete cascade,
  sessions integer not null default 0 check (sessions >= 0),
  stars integer not null default 0 check (stars >= 0),
  boxes integer not null default 0 check (boxes >= 0),
  heads integer not null default 0 check (heads >= 0),
  tiles integer not null default 0 check (tiles >= 0),
  guessed integer not null default 0 check (guessed >= 0),
  goals integer not null default 0 check (goals >= 0),
  updated_at timestamptz not null default now()
);
alter table public.classlive_stats enable row level security;

create table public.classlive_finished (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  seed bigint not null,
  finished_at timestamptz not null default now(),
  primary key (room, seed)
);
alter table public.classlive_finished enable row level security;

-- done: { seed, activity, goal, players: [{ player, points, stars, boxes, head, tiles, guessed }] }. Pupils not in the
-- room's class are skipped. 'paid' if this session was paid before (nothing changes), 'gone' if there is no such room.
create function public.classlive_finish(target bigint, done jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_class uuid;
  p jsonb;
  who uuid;
  reached boolean := coalesce((done ->> 'goal')::boolean, false);
  small integer;
begin
  select r.class_id into room_class from public.classlive_rooms r where r.id = target;
  if room_class is null then
    return 'gone';
  end if;
  insert into public.classlive_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if public.current_class_of(who) is distinct from room_class then
      continue;
    end if;
    perform public.add_game_points(who, 'classlive', least(greatest(coalesce((p ->> 'points')::integer, 0), 0), 10),
      'classlive:' || target || ':' || (done ->> 'seed'));
    small := 500;
    insert into public.classlive_stats as s (player, sessions, stars, boxes, heads, tiles, guessed, goals)
    values (who, 1,
      least(greatest(coalesce((p ->> 'stars')::integer, 0), 0), small),
      least(greatest(coalesce((p ->> 'boxes')::integer, 0), 0), small),
      case when coalesce((p ->> 'head')::boolean, false) then 1 else 0 end,
      least(greatest(coalesce((p ->> 'tiles')::integer, 0), 0), small),
      case when coalesce((p ->> 'guessed')::boolean, false) then 1 else 0 end,
      case when reached then 1 else 0 end)
    on conflict (player) do update set
      sessions = s.sessions + 1,
      stars = s.stars + excluded.stars,
      boxes = s.boxes + excluded.boxes,
      heads = s.heads + excluded.heads,
      tiles = s.tiles + excluded.tiles,
      guessed = s.guessed + excluded.guessed,
      goals = s.goals + excluded.goals,
      updated_at = now();
    perform public.game_progress_changed(who, 'classlive');
  end loop;
  return 'ok';
end;
$$;

create function public.classlive_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'classlive_sessions', coalesce(s.sessions, 0),
    'classlive_stars', coalesce(s.stars, 0),
    'classlive_boxes', coalesce(s.boxes, 0),
    'classlive_heads', coalesce(s.heads, 0),
    'classlive_tiles', coalesce(s.tiles, 0),
    'classlive_guessed', coalesce(s.guessed, 0),
    'classlive_goals', coalesce(s.goals, 0))
  from (select 1) one left join public.classlive_stats s on s.player = who
$$;

create function public.classlive_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'Join a Class Live game: 1 point, or 3 points if you find a star, get a box right or answer a question right.',
    'Your class reaches the goal (the sky creature, the serpent awake or the picture guessed): 2 more points.',
    'Guess the Mystery Mural picture: 2 more points.'))
$$;

create function public.classlive_players()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select s.player from public.classlive_stats s
$$;

update public.hub_games
set counts_fn = 'public.classlive_counts(uuid)', rules_fn = 'public.classlive_rules()', players_fn = 'public.classlive_players()',
    keep_achievements = true
where id = 'classlive';

insert into public.achievement_measures (measure)
values ('classlive_sessions'), ('classlive_stars'), ('classlive_boxes'), ('classlive_heads'), ('classlive_tiles'),
  ('classlive_guessed'), ('classlive_goals');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-first', 'classlive', 'Live on Stage', '🌟', 'classlive_sessions', 1, 1, 'Play your first Class Live game.', 1),
  ('classlive-stargazer', 'classlive', 'Stargazer', '✨', 'classlive_stars', 10, 2, 'Find 10 new stars in Star Web.', 1),
  ('classlive-serpent-head', 'classlive', 'Head of the Serpent', '🐍', 'classlive_heads', 1, 3, 'Reach the head of the serpent in Serpent Chain.', 2),
  ('classlive-chain-master', 'classlive', 'Chain Master', '⛓️', 'classlive_boxes', 50, 4, 'Get 50 Serpent Chain boxes right.', 2),
  ('classlive-sharp-eye', 'classlive', 'Sharp Eye', '🔍', 'classlive_guessed', 1, 5, 'Guess a Mystery Mural picture.', 1),
  ('classlive-tile-flipper', 'classlive', 'Tile Flipper', '🎨', 'classlive_tiles', 30, 6, 'Flip 30 Mystery Mural tiles.', 2),
  ('classlive-team-player', 'classlive', 'Team Player', '🤝', 'classlive_goals', 5, 7, 'Help your class reach the goal in 5 Class Live games.', 2),
  ('classlive-regular', 'classlive', 'Class Live Star', '🎖️', 'classlive_sessions', 20, 8, 'Play 20 Class Live games.', 3);

revoke all on public.classlive_stats, public.classlive_finished from public, anon, authenticated;
revoke execute on function public.classlive_finish(bigint, jsonb), public.classlive_counts(uuid), public.classlive_rules(),
  public.classlive_players()
  from public, anon, authenticated;
grant execute on function public.classlive_finish(bigint, jsonb) to service_role;

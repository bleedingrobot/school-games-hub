-- Hop's Glow-worm Pond in the hub (docs/HOP-PLAN.md, Stage 4): the hub_games hooks, one achievement per Golden Glow Jar,
-- and the teacher's class and student lines. Nothing shared is re-created.
--
-- No points (James, 4 Nov 2026): the Golden Glow Jar is the reward. Each jar brings a new New Zealand friend to a fresh
-- pond, and each friend's jar is an achievement (shared/hop/progress.ts: FRIENDS, DAYS_PER_JAR = 30).
-- It isn't a season game: days are counted, not dates, so New Season leaves the pond and the achievements as they are.
--
-- Depends on 20261104000600_hop.sql and 20261020000100_game_hooks.sql.

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Glow Jars won: one for every 30 finished days.
create function public.hop_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('hop_jars', coalesce((select h.days_done / 30 from public.hop_progress h where h.player = who), 0))
$$;

-- The lines on How points work.
create function public.hop_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Glow Jar is the prize, and an achievement.'))
$$;

-- Pupils with a pond (a rebuild gives their achievements back).
create function public.hop_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select h.player from public.hop_progress h
$$;

create function public.hop_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select h.updated_at from public.hop_progress h where h.player = hop_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('hop', 'hop_enabled', 'public.hop_counts(uuid)', 'public.hop_point_rules()',
  'public.hop_players_list()', null, 'public.hop_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('hop_jars');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('hop-hop', 'hop', 'Hop’s Golden Glow Jar', '🐸', 'hop_jars', 1, 1),
  ('hop-gecko', 'hop', 'Gecko’s Golden Glow Jar', '🦎', 'hop_jars', 2, 2),
  ('hop-weta', 'hop', 'Wētā’s Golden Glow Jar', '🦗', 'hop_jars', 3, 3),
  ('hop-tuatara', 'hop', 'Tuatara’s Golden Glow Jar', '🐊', 'hop_jars', 4, 4),
  ('hop-kiwi', 'hop', 'Kiwi’s Golden Glow Jar', '🥝', 'hop_jars', 5, 5),
  ('hop-ruru', 'hop', 'Ruru’s Golden Glow Jar', '🦉', 'hop_jars', 6, 6);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Glow Jars won between them.
create function public.teacher_hop_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object('players', count(*), 'jars', coalesce(sum(h.days_done / 30), 0))
    from public.hop_progress h
    join public.my_students() s(id) on s.id = h.player
    where exists (select 1 from public.class_members m where m.student_id = h.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the day and jars), the NZ day a pad
-- last changed, the step reached (10, 5 or 2) and when they last played; or null.
create function public.teacher_hop_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPadDay', to_char(h.last_pad_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at)
          from public.hop_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.hop_counts(uuid), public.hop_point_rules(), public.hop_players_list(), public.hop_last_played(uuid),
  public.teacher_hop_class(uuid), public.teacher_hop_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_hop_class(uuid), public.teacher_hop_student(uuid) to authenticated;

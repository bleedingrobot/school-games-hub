-- Kiwi's Beanstalk in the hub (docs/BEANSTALK-PLAN.md, Stage 4): the hub_games hooks, one achievement per Golden Egg,
-- and the teacher's class and student lines. Nothing shared is re-created.
--
-- No points (James, 4 Nov 2026): the Golden Egg is the reward. Each egg brings a new New Zealand friend down the
-- beanstalk, and each friend's egg is an achievement (shared/beanstalk/progress.ts: FRIENDS, DAYS_PER_EGG = 30).
-- It isn't a season game: days are counted, not dates, so New Season leaves the beanstalk and the achievements as they are.
--
-- Depends on 20261104000700_beanstalk.sql and 20261020000100_game_hooks.sql.

-- ---------------------------------------------------------------------------
-- The hooks
-- ---------------------------------------------------------------------------

-- Golden Eggs won: one for every 30 finished days.
create function public.beanstalk_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('beanstalk_eggs', coalesce((select b.days_done / 30 from public.beanstalk_progress b where b.player = who), 0))
$$;

-- The lines on How points work.
create function public.beanstalk_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each Golden Egg is the prize, and an achievement.'))
$$;

-- Pupils with a beanstalk (a rebuild gives their achievements back).
create function public.beanstalk_players_list()
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select b.player from public.beanstalk_progress b
$$;

create function public.beanstalk_last_played(player uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select b.updated_at from public.beanstalk_progress b where b.player = beanstalk_last_played.player
$$;

insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements)
values ('beanstalk', 'beanstalk_enabled', 'public.beanstalk_counts(uuid)', 'public.beanstalk_point_rules()',
  'public.beanstalk_players_list()', null, 'public.beanstalk_last_played(uuid)', true);

insert into public.achievement_measures (measure) values ('beanstalk_eggs');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('beanstalk-kiwi', 'beanstalk', 'Kiwi’s Golden Egg', '🥚', 'beanstalk_eggs', 1, 1),
  ('beanstalk-tui', 'beanstalk', 'Tūī’s Golden Egg', '🐦', 'beanstalk_eggs', 2, 2),
  ('beanstalk-kereru', 'beanstalk', 'Kererū’s Golden Egg', '🕊️', 'beanstalk_eggs', 3, 3),
  ('beanstalk-weta', 'beanstalk', 'Wētā’s Golden Egg', '🦗', 'beanstalk_eggs', 4, 4),
  ('beanstalk-ruru', 'beanstalk', 'Ruru’s Golden Egg', '🦉', 'beanstalk_eggs', 5, 5),
  ('beanstalk-takahe', 'beanstalk', 'Takahē’s Golden Egg', '💙', 'beanstalk_eggs', 6, 6);

-- ---------------------------------------------------------------------------
-- The teacher's lines
-- ---------------------------------------------------------------------------

-- The teacher's Games table line for a class: how many of its pupils play, and the Golden Eggs won between them.
create function public.teacher_beanstalk_class(target_class uuid)
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
    select jsonb_build_object('players', count(*), 'eggs', coalesce(sum(b.days_done / 30), 0))
    from public.beanstalk_progress b
    join public.my_students() s(id) on s.id = b.player
    where exists (select 1 from public.class_members m where m.student_id = b.player and m.class_id = target_class));
end;
$$;

-- One line's worth for a student's page: finished days in all (the screens work out the day and eggs), or null.
create function public.teacher_beanstalk_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', b.days_done, 'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'))
          from public.beanstalk_progress b where b.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.beanstalk_counts(uuid), public.beanstalk_point_rules(), public.beanstalk_players_list(), public.beanstalk_last_played(uuid),
  public.teacher_beanstalk_class(uuid), public.teacher_beanstalk_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_beanstalk_class(uuid), public.teacher_beanstalk_student(uuid) to authenticated;

-- Gem Keep's class report for one class (docs/TEACHER-VIEW-PLAN.md, section 6, stage 3).
--
-- teacher_gem_keep_class(target_class) gives the same report as teacher_gem_keep_class() (players, levels won and Level Keys
-- passed, the 10 hardest times-table facts), but only for the students in that class. The teacher must teach the class (a
-- school admin teaches every class), checked with teaches_class(), as teacher_question_skips() does.
--
-- The old teacher_gem_keep_class() with no class stays as it was until the website has moved to the new one. The new
-- argument has no default on purpose: with a default, a call with no arguments could mean either function and PostgREST
-- would refuse it.

create function public.teacher_gem_keep_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    )
    select jsonb_build_object(
      'players', (select count(distinct g.player) from public.gem_keep_progress g join students s on s.id = g.player),
      'levels', (select coalesce(jsonb_agg(jsonb_build_object('levelId', x.level_id, 'won', x.won, 'keys', x.keys)
          order by x.level_id), '[]')
        from (select g.level_id, count(*) filter (where g.wins > 0) as won, count(*) filter (where g.key_passed) as keys
              from public.gem_keep_progress g join students s on s.id = g.player group by g.level_id) x),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', x.fact_key, 'students', x.students, 'attempts', x.attempts, 'correct', x.correct)
          order by x.wrong_share desc, x.attempts desc), '[]')
        from (select f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join students s on s.id = f.player
              where f.pack = 'times-tables' and f.attempts > 0
              group by f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 10) x)
    )
  );
end;
$$;

revoke execute on function public.teacher_gem_keep_class(uuid) from public, anon, authenticated;
grant execute on function public.teacher_gem_keep_class(uuid) to authenticated;

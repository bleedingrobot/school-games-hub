-- Clan Quest's class report for one class (docs/TEACHER-VIEW-PLAN.md, section 6, stage 3).
--
-- teacher_clan_maths_class(target_class) gives the same report as teacher_clan_maths_class() (how many pupils have answered
-- Clan Quest's story questions, every kind of question, and the kinds most often wrong), but only for the students in that
-- class. The teacher must teach the class (a school admin teaches every class), checked with teaches_class(), as
-- teacher_question_skips() and teacher_gem_keep_class(target_class) do.
--
-- The old teacher_clan_maths_class() with no class stays as it was (20261018002600) until the website has moved to the new
-- one. The new argument has no default on purpose: with a default, a call with no arguments could mean either function and
-- PostgREST would refuse it.
--
-- The village functions are not changed: villages stay whole school, and any teacher can manage them (James, 28 Oct 2026).

create function public.teacher_clan_maths_class(target_class uuid)
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
    ),
    facts as (
      select f.player, f.fact_key, f.attempts, f.correct
      from public.gem_keep_facts f
      join students s on s.id = f.player
      join public.profiles p on p.id = f.player
      where f.pack = 'clan-quest' and p.role = 'student' and f.attempts > 0
    )
    select jsonb_build_object(
      'players', (select count(distinct x.player) from facts x),
      'kinds', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', y.fact_key, 'students', y.students, 'attempts', y.attempts, 'correct', y.correct) order by y.fact_key), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct
              from facts x group by x.fact_key) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select x.fact_key, count(*) as students, sum(x.attempts) as attempts, sum(x.correct) as correct,
                     1 - sum(x.correct)::numeric / sum(x.attempts) as wrong_share
              from facts x
              group by x.fact_key
              having sum(x.attempts) >= 6 and count(*) >= 2 and sum(x.correct) < sum(x.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z)
    )
  );
end;
$$;

revoke execute on function public.teacher_clan_maths_class(uuid) from public, anon, authenticated;
grant execute on function public.teacher_clan_maths_class(uuid) to authenticated;

-- Maths Monsters' class report for one class (docs/TEACHER-VIEW-PLAN.md, section 6, stage 3).
--
-- teacher_monster_class(target_class) gives the same report as teacher_monster_class() (players, Topic Tower badges, each
-- topic's answers, the hardest questions, and saves the server check turned down in the last 2 weeks), but only for the
-- students in that class. The teacher must teach the class (a school admin teaches every class), checked with
-- teaches_class(), as teacher_question_skips() and teacher_gem_keep_class(target_class) do.
--
-- The old teacher_monster_class() with no class stays as it was until the website has moved to the new one. The new
-- argument has no default on purpose: with a default, a call with no arguments could mean either function and PostgREST
-- would refuse it.

create function public.teacher_monster_class(target_class uuid)
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
    packs as (select unnest(array['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals']) as pack)
    select jsonb_build_object(
      'players', (select count(*) from public.monster_saves m join students s on s.id = m.player),
      'badges', (select coalesce(jsonb_agg(c order by i), '[]') from (
          select n.i, (select count(*) from public.monster_saves m join students s on s.id = m.player where m.badges_count >= n.i) as c
          from generate_series(1, 6) as n(i)) x),
      'topics', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', pk.pack,
          'students', coalesce(t.students, 0), 'attempts', coalesce(t.attempts, 0), 'correct', coalesce(t.correct, 0)) order by pk.pack), '[]')
        from packs pk left join (
          select f.pack, count(distinct f.player) as students, sum(f.attempts) as attempts, sum(f.correct) as correct
          from public.gem_keep_facts f join students s on s.id = f.player group by f.pack) t on t.pack = pk.pack),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', x.pack, 'key', x.fact_key, 'students', x.students, 'attempts', x.attempts, 'correct', x.correct)
          order by x.wrong_share desc, x.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join students s on s.id = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) x),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', y.display_name, 'realName', y.real_name, 'reason', y.reason, 'at', y.at) order by y.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.at
              from public.monster_refusals r
              join students s on s.id = r.player
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days'
              order by r.at desc limit 15) y)
    )
  );
end;
$$;

revoke execute on function public.teacher_monster_class(uuid) from public, anon, authenticated;
grant execute on function public.teacher_monster_class(uuid) to authenticated;

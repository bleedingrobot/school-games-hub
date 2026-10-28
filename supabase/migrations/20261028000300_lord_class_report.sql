-- Dragon Maths' class report for one class (docs/TEACHER-VIEW-PLAN.md, section 6, stage 3).
--
-- teacher_lord_class(target_class) gives the same report as teacher_lord_class() (where the season is, heroes at each level
-- this season, the hardest questions, requests the game turned down in the last 2 weeks, and the Hall of Heroes), but only
-- for the students in that class. The teacher must teach the class (a school admin teaches every class), checked with
-- teaches_class(), as teacher_question_skips() and teacher_monster_class(target_class) do.
--
-- The season is the class's own: its settings row (the one its pupils play by), else the school's default row, the way
-- settings_id_of() picks a pupil's. The old call read the teacher's own row instead, which was some other class's season
-- for a teacher with two classes. Seasons still work exactly as before: nothing here changes how they are worked out.
--
-- The old teacher_lord_class() with no class stays as it was until the website has moved to the new one. The new argument
-- has no default on purpose: with a default, a call with no arguments could mean either function and PostgREST would refuse it.

create function public.teacher_lord_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  season_start date;
  season_now integer;
  today date := public.nz_day(now());
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select coalesce(
    (select s.lord_season_start from public.app_settings s where s.class_id = target_class),
    (select s.lord_season_start from public.app_settings s where s.class_id is null and s.school_id = public.my_school())
  ) into season_start;
  season_now := case when season_start is null or today < season_start then null else ((today - season_start) / 35) + 1 end;
  return (
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    heroes as (select h.player, h.season, h.hero from public.lord_heroes h join students s on s.id = h.player)
    select jsonb_build_object(
      'season', jsonb_build_object(
          'number', season_now,
          'start', to_char(season_start, 'YYYY-MM-DD'),
          'daysLeft', case when season_now is null then null else 35 - (((today - season_start) % 35) + 1) end),
      'players', (select count(*) from heroes),
      'thisSeason', (select count(*) from heroes x where x.season = season_now),
      'levels', (select coalesce(jsonb_agg(y.c order by y.i), '[]') from (
          select n.i, (select count(*) from heroes x where x.season = season_now and (x.hero ->> 'level')::integer = n.i) as c
          from generate_series(1, 12) as n(i)) y),
      'hardest', (select coalesce(jsonb_agg(jsonb_build_object(
          'pack', z.pack, 'key', z.fact_key, 'students', z.students, 'attempts', z.attempts, 'correct', z.correct)
          order by z.wrong_share desc, z.attempts desc), '[]')
        from (select f.pack, f.fact_key, count(*) as students, sum(f.attempts) as attempts, sum(f.correct) as correct,
                     1 - sum(f.correct)::numeric / sum(f.attempts) as wrong_share
              from public.gem_keep_facts f join heroes x on x.player = f.player
              where f.attempts > 0
              group by f.pack, f.fact_key
              having sum(f.attempts) >= 6 and count(*) >= 2 and sum(f.correct) < sum(f.attempts)
              order by wrong_share desc, attempts desc
              limit 12) z),
      'refusals', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', w.display_name, 'realName', w.real_name, 'reason', w.reason, 'action', w.action, 'at', w.at) order by w.at desc), '[]')
        from (select p.display_name, split_part(u.email, '@', 1) as real_name, r.reason, r.action, r.at
              from public.lord_refusals r
              join students s on s.id = r.player
              join public.profiles p on p.id = r.player
              left join auth.users u on u.id = p.id
              where r.at > now() - interval '14 days'
              order by r.at desc limit 20) w),
      'hall', (select coalesce(jsonb_agg(jsonb_build_object(
          'season', v.season, 'name', v.display_name, 'realName', v.real_name, 'kills', v.kills) order by v.season desc, v.kills desc, v.first_at), '[]')
        from (select hl.season, p.display_name, split_part(u.email, '@', 1) as real_name, hl.kills, hl.first_at
              from public.lord_hall hl
              join students s on s.id = hl.player
              join public.profiles p on p.id = hl.player
              left join auth.users u on u.id = p.id
              order by hl.season desc, hl.kills desc, hl.first_at limit 60) v)
    )
  );
end;
$$;

revoke execute on function public.teacher_lord_class(uuid) from public, anon, authenticated;
grant execute on function public.teacher_lord_class(uuid) to authenticated;

-- Glyph Gates (docs/GLYPH-PLAN.md, stage 5): the teacher's reads, and its column on the Progress tab.
--
-- 1. teacher_glyph_class(class): one read for the Games table, "Hardest right now" and "Needs you". Per pupil: temples passed,
--    walls opened, last played, and `stuck`: the temple they have gone to on 3 or more different NZ days without ever
--    passing it (null when none) and how many days. Also `hardest`.
--    NOTE ON `hardest`: the walls are made from seeds and not stored, so the class's hardest gold stones can't be read back
--    here. Instead `hardest` is the most common named mistakes (glyph_goes.result.walls[].mistakes, first go of each wall)
--    across the class's goes finished in the last 14 days, with how many pupils made each.
-- 2. teacher_glyph_student(student): best first goes per temple and the pupil's most common mistakes.
-- 3. teacher_progress_other_games: re-created from its newest body (20261114000200_orderup.sql) plus a glyph block (temples passed).
-- Same guards as Toon Flap's teacher reads (20261111000200): require_teacher() and teaches_class(), or require_teacher_of().

create function public.teacher_glyph_class(target_class uuid)
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
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    days as (
      select g.player, g.temple, count(distinct (g.started_at at time zone 'Pacific/Auckland')::date)::integer as n
      from public.glyph_goes g join students s on s.id = g.player
      where not exists (select 1 from public.glyph_goes w where w.player = g.player and w.temple = g.temple and w.passed)
      group by g.player, g.temple
    ),
    stuck as (
      select distinct on (d.player) d.player, d.temple, d.n from days d where d.n >= 3 order by d.player, d.n desc, d.temple desc
    ),
    pupils as (
      select p.player,
             coalesce((p.progress ->> 'passed')::integer, 0) as passed,
             coalesce((p.progress ->> 'walls')::integer, 0) as walls,
             (select max(g.started_at) from public.glyph_goes g where g.player = p.player) as last_played
      from public.glyph_progress p join students s on s.id = p.player
    ),
    mistakes as (
      select m.name, count(*)::integer as n, count(distinct g.player)::integer as pupils
      from public.glyph_goes g
      join students s on s.id = g.player
      cross join lateral jsonb_array_elements(coalesce(g.result -> 'walls', '[]'::jsonb)) w(wall)
      cross join lateral jsonb_array_elements_text(coalesce(w.wall -> 'mistakes', '[]'::jsonb)) m(name)
      where g.finished_at > now() - interval '14 days'
      group by m.name
    )
    select jsonb_build_object(
      'players', coalesce((select jsonb_agg(jsonb_build_object(
          'student', p.player, 'passed', p.passed, 'walls', p.walls, 'lastPlayed', p.last_played,
          'stuckTemple', k.temple, 'stuckDays', k.n) order by p.player)
        from pupils p left join stuck k on k.player = p.player), '[]'::jsonb),
      'hardest', coalesce((select jsonb_agg(jsonb_build_object('mistake', x.name, 'count', x.n, 'students', x.pupils)
                                            order by x.n desc, x.name)
        from (select * from mistakes order by n desc, name limit 5) x), '[]'::jsonb))
  );
end;
$$;

create function public.teacher_glyph_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (
    select jsonb_build_object(
      'passed', coalesce((p.progress ->> 'passed')::integer, 0),
      'walls', coalesce((p.progress ->> 'walls')::integer, 0),
      'best', coalesce(p.progress -> 'best', '{}'::jsonb),
      'lastPlayed', (select max(g.started_at) from public.glyph_goes g where g.player = student),
      'mistakes', coalesce((
        select jsonb_agg(jsonb_build_object('mistake', x.name, 'count', x.n) order by x.n desc, x.name)
        from (
          select m.name, count(*)::integer as n
          from public.glyph_goes g
          cross join lateral jsonb_array_elements(coalesce(g.result -> 'walls', '[]'::jsonb)) w(wall)
          cross join lateral jsonb_array_elements_text(coalesce(w.wall -> 'mistakes', '[]'::jsonb)) m(name)
          where g.player = student
          group by m.name order by n desc, m.name limit 5
        ) x), '[]'::jsonb))
    from public.glyph_progress p where p.player = student);
end;
$$;

create or replace function public.teacher_progress_other_games(target_class uuid)
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
    with students as (
      select s.id from public.my_students() s(id)
      where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class)
    ),
    rows as (
      select g.player as student, 'gem-keep' as game,
             coalesce(max(g.level_number) filter (where g.result = 'won'), 0) as value, max(g.finished_at) as at
        from public.gem_keep_runs g join students s on s.id = g.player group by g.player
      union all
      select d.player, 'diamond', coalesce((d.state ->> 'deepest')::integer, 0), d.updated_at
        from public.diamond_players d join students s on s.id = d.player
      union all
      select h.player, 'dragon-maths', coalesce((h.hero ->> 'level')::integer, 0), h.saved_at
        from public.lord_heroes h join students s on s.id = h.player
      union all
      select b.player, 'bond-match', sum(b.best_stars)::integer, max(b.updated_at)
        from public.bond_match_bests b join students s on s.id = b.player group by b.player
      union all
      select t.player, 'toonflap',
             (select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where (l.rec ->> 'finishes')::int > 0)::integer, t.updated_at
        from public.toonflap_progress t join students s on s.id = t.player
      union all
      select o.player, 'orderup', o.passed, o.updated_at
        from public.orderup_progress o join students s on s.id = o.player
      union all
      select p.player, 'glyph', coalesce((p.progress ->> 'passed')::integer, 0),
             (select max(g.started_at) from public.glyph_goes g where g.player = p.player)
        from public.glyph_progress p join students s on s.id = p.player
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;

revoke execute on function public.teacher_progress_other_games(uuid) from public, anon, authenticated;
grant execute on function public.teacher_progress_other_games(uuid) to authenticated;

revoke execute on function public.teacher_glyph_class(uuid), public.teacher_glyph_student(uuid) from public, anon, authenticated;
grant execute on function public.teacher_glyph_class(uuid), public.teacher_glyph_student(uuid) to authenticated;

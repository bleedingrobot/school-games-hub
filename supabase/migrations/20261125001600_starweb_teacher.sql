-- Star Web solo (docs/STARWEB-PLAN.md, stage SW4): its column on the teacher's Progress tab, "tables lit" of 11.
-- teacher_progress_other_games is re-created from its newest body (20261123000500_circuit_guide.sql) plus a starweb block.

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
      union all
      select gs.player, 'goblinstorm', cardinality(gs.bosses),
             (select max(r.started_at) from public.goblinstorm_runs r where r.player = gs.player)
        from public.goblinstorm_saves gs join students s on s.id = gs.player
      union all
      select c.player, 'circuit', (count(*) filter (where c.finishes > 0))::integer, max(c.updated_at)
        from public.circuit_progress c join students s on s.id = c.player group by c.player
      union all
      select w.player, 'starweb',
             (select count(*) from jsonb_each_text(coalesce(w.progress -> 'tables', '{}'::jsonb)) t(k, m) where t.m::int >= 1)::integer,
             (select max(k.saved_at) from public.starweb_skies k where k.player = w.player)
        from public.starweb_progress w join students s on s.id = w.player
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;

-- Teacher progress P11: the "Other games" columns on the Progress tab.
--
-- None of the other games' class reads gives one line a pupil (they are all class totals), so this adds one new read that gives
-- every pupil in a class one number a game, for the five games that have levels but are not stepped lessons:
--   gem-keep   the highest level won           (gem_keep_runs.level_number)
--   diamond    the deepest level passed        (diamond_players.state.deepest)
--   dragon-maths the hero's level              (lord_heroes.hero.level)
--   bond-match the stars over all the sets     (bond_match_bests.best_stars, added up)
--   toonflap   the levels finished             (toonflap_progress.progress.levels, finishes > 0)
-- Each row is { student, game, value, at } where `at` is when the pupil last played that game. A pupil who has never played a
-- game has no row for it. Nothing is created apart from this one function and nothing existing is changed.
-- Same guard as teacher_toonflap_class: require_teacher(), then teaches_class(), and only the teacher's own students.

create function public.teacher_progress_other_games(target_class uuid)
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
    )
    select coalesce(jsonb_agg(jsonb_build_object('student', r.student, 'game', r.game, 'value', r.value, 'at', r.at)
                              order by r.game, r.student), '[]'::jsonb)
    from rows r
  );
end;
$$;

revoke execute on function public.teacher_progress_other_games(uuid) from public, anon, authenticated;
grant execute on function public.teacher_progress_other_games(uuid) to authenticated;

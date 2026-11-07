-- R7 Stage 1 (docs/plans/maths-review/R7-teacher-foundational-view.md, section 5) and game kit K5: what a teacher needs to see who is
-- stuck in the Foundational games.
--   * teacher_foundational_class: for each pupil of ONE class the teacher teaches, how far they are in each of the six games
--     (days done, last day played, level or step, Beanstalk's child) and their last 10 finished challenges in each (the NZ day,
--     wrong taps, taps, level). A pupil who has played none gets an empty object.
--   * teacher_quick_looks_class: the same for Quick looks (a Training activity): the saved settings in the Training student row,
--     sessions done, the last 20 counted answers and how many were given in the last 30 days.
-- Both use exactly the guard of teacher_class_skill_map (require_teacher, then teaches_class(target, is_school_admin())), so a
-- teacher only ever gets their own class. They change no table and no row. Pupils' facts are NOT here: the grid reuses
-- teacher_class_skill_map for them.

create function public.teacher_foundational_class(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if not public.teaches_class(target, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(m.student_id::text, jsonb_strip_nulls(jsonb_build_object(
        'hop', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_pad_day, 'level', p.reached, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.step as lv, r.finished_at as fin
                  from public.hop_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.hop_progress p where p.player = m.student_id),
        'korora', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_pebble_day, 'level', p.reached, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.level as lv, r.finished_at as fin
                  from public.korora_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.korora_progress p where p.player = m.student_id),
        'pipi', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_shell_day, 'level', p.reached, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.level as lv, r.finished_at as fin
                  from public.pipi_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.pipi_progress p where p.player = m.student_id),
        'tui', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_flower_day, 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.tui_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.tui_progress p where p.player = m.student_id),
        'weka', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_stone_day, 'level', p.reached, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.level as lv, r.finished_at as fin
                  from public.weka_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.weka_progress p where p.player = m.student_id),
        'beanstalk', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_leaf_day, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                          r.finished_at as fin
                  from public.beanstalk_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x), 'child', p.child
          ) from public.beanstalk_progress p where p.player = m.student_id)
      ))), '{}')
  into result
  from public.class_members m
  where m.class_id = target;
  return result;
end;
$$;

create function public.teacher_quick_looks_class(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if not public.teaches_class(target, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(m.student_id::text, q.data), '{}')
  into result
  from public.class_members m
  cross join lateral (
    select case when s.player is null and not exists (
             select 1 from public.training_answers a where a.player = m.student_id and a.fact_key ~ '^(sub|gap)h?:')
           then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object(
      'q', s.typing -> 'q',
      'sessions', s.sessions_done,
      'recent', (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where x.correct))
                 from (select a.correct from public.training_answers a
                       where a.player = m.student_id and a.fact_key ~ '^(sub|gap):'
                       order by a.answered_at desc, a.id desc limit 20) x),
      'last30', (select count(*) from public.training_answers a
                 where a.player = m.student_id and a.fact_key ~ '^(sub|gap)h?:' and a.answered_at > now() - interval '30 days'),
      'lastDay', (select to_char(max(a.day), 'YYYY-MM-DD') from public.training_answers a
                  where a.player = m.student_id and a.fact_key ~ '^(sub|gap)h?:'))) end as data
    from (select 1) one
    left join public.training_students s on s.player = m.student_id
  ) q
  where m.class_id = target;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_foundational_class(uuid),
  public.teacher_quick_looks_class(uuid)
from public, anon, authenticated;

-- Each one checks that the asker is a teacher of the class.
grant execute on function
  public.teacher_foundational_class(uuid),
  public.teacher_quick_looks_class(uuid)
to authenticated;

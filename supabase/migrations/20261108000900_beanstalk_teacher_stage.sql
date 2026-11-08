-- S23 (Beanstalk part): the teacher's Foundational class view sends Beanstalk's stage (0 bonds to 10, 1 to 20, 2 to 100, 3 to 1000,
-- from 20261108000700) as `level`, and marks the recent challenges since the stage last changed with it, so the grid can name the sum
-- and the "same sum for 5 or more days" alert can work. Everything else in the function is copied unchanged from
-- 20261108000500_foundational_teacher_five.sql. Same name, arguments, guard and grants; no table or row changes. The current page
-- ignores a Beanstalk level it does not have a name for, so it is safe to apply before or after the page code.

create or replace function public.teacher_foundational_class(target uuid)
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
        'beanstalk', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_leaf_day, 'level', p.stage, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', y.d, 'm', y.wr, 't', y.tp, 'l', y.lv) order by y.fin desc), '[]')
            from (select x.d, x.wr, x.tp, x.fin,
                         -- The round does not save its sum, so the days since the stage last changed (stage_days) are marked as on this stage.
                         case when dense_rank() over (order by x.d desc) <= greatest(p.stage_days, 1) then p.stage end as lv
                  from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                               case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                               r.finished_at as fin
                        from public.beanstalk_rounds r
                        where r.player = m.student_id and r.finished_at is not null
                        order by r.finished_at desc limit 10) x) y), 'child', p.child
          ) from public.beanstalk_progress p where p.player = m.student_id),
        'pigeon', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.pigeon_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.pigeon_progress p where p.player = m.student_id),
        'parrot', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.parrot_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.parrot_progress p where p.player = m.student_id),
        'lizard', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.lizard_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.lizard_progress p where p.player = m.student_id),
        'swamphen', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.swamphen_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.swamphen_progress p where p.player = m.student_id),
        'robin', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.robin_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.robin_progress p where p.player = m.student_id)
      ))), '{}')
  into result
  from public.class_members m
  where m.class_id = target;
  return result;
end;
$$;

revoke execute on function public.teacher_foundational_class(uuid) from public, anon, authenticated;
grant execute on function public.teacher_foundational_class(uuid) to authenticated;

-- P4 (teacher progress): the teacher's Foundational class view also sends, for each game, `since` (the NZ day the pupil's current
-- step began: the earliest finished round in the unbroken run of rounds at today's step, counting back from the newest, across all
-- the rounds kept) and, for the six step games (Tui, Robin, Parrot, Lizard, Pigeon, Swamp Hen), `good` (good_at_step, the good goes
-- so far at this step). Beanstalk does not save its stage on a round, so it has neither. Everything else is copied unchanged from
-- 20261108000900_beanstalk_teacher_stage.sql. Same name, arguments, guard and grants; additive only, no table or row changes. The
-- current page ignores keys it does not know, so it is safe to apply before or after the page code.

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
        'hop', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_pad_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.hop_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.hop_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.step) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.step as lv, r.finished_at as fin
                  from public.hop_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.hop_progress p where p.player = m.student_id),
        'korora', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_pebble_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.korora_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.korora_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.level as lv, r.finished_at as fin
                  from public.korora_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.korora_progress p where p.player = m.student_id),
        'pipi', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_shell_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.pipi_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.pipi_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         r.level as lv, r.finished_at as fin
                  from public.pipi_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.pipi_progress p where p.player = m.student_id),
        'tui', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_flower_day, 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.tui_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.tui_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.tui_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.tui_progress p where p.player = m.student_id),
        'weka', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_stone_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.weka_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.weka_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
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
        'pigeon', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.pigeon_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.pigeon_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.pigeon_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.pigeon_progress p where p.player = m.student_id),
        'parrot', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.parrot_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.parrot_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.parrot_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.parrot_progress p where p.player = m.student_id),
        'lizard', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.lizard_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.lizard_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.lizard_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.lizard_progress p where p.player = m.student_id),
        'swamphen', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.swamphen_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.swamphen_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.swamphen_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x)
          ) from public.swamphen_progress p where p.player = m.student_id),
        'robin', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.robin_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.robin_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
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

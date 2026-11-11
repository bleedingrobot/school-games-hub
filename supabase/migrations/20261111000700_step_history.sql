-- P9 (teacher progress): step history. A new table, public.step_changes, records every move up (or down) in the eleven Foundational
-- games from now on: who, which game, the step before and after (as the game saves it, so Hop keeps 10/5/2/3/4/200 and the page turns
-- it into a step with stepOf), and when. One shared trigger function is given the column to watch (step, reached or Beanstalk's
-- stage) and each progress table gets an `after update` trigger that adds a row when that column changes. The table is read only by
-- teacher_foundational_class below (no policy, no grant), which now also sends `moves`: each game's last 5 changes, newest first, as
-- [{from, to, at (NZ day, YYYY-MM-DD), est}]. `from` is left out when there was no step before.
--
-- Back-fill, once: from the rounds still kept (30 days), the earliest finished round at each step, marked estimated = true, for
-- every game whose rounds save their step (Beanstalk's do not, so it starts empty). Insert only; nothing existing is changed.
--
-- teacher_foundational_class is the body of 20261111000500_teacher_progress_first_try.sql with only `moves` added to each game;
-- same name, arguments, guard and grants; additive only. The current page ignores keys it does not know, so it is safe to apply
-- before or after the page code.
--
-- End of year: the Foundational games keep their steps through New Season (their hub_games season_fn is null), so this history is
-- kept with them and no clearing is wired here. Whether the year reset should clear it is a question for James (see the P9 report).

create table public.step_changes (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null,
  step_from integer,
  step_to integer not null,
  at timestamptz not null default now(),
  -- True for rows worked out from old rounds in the back-fill, not seen as it happened.
  estimated boolean not null default false
);
create index step_changes_by_player on public.step_changes (player, game, at);

alter table public.step_changes enable row level security;
-- No policy and no grant: only the teacher functions (security definer) and the triggers below read or write it.
revoke all on public.step_changes from anon, authenticated;

-- Back-fill (before the triggers, so nothing is counted twice).
insert into public.step_changes (player, game, step_from, step_to, at, estimated)
select f.player, f.game, lag(f.step) over (partition by f.player, f.game order by f.at), f.step, f.at, true
from (
  select k.game, k.player, k.step, min(k.finished_at) as at
  from (
    select 'robin' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.robin_rounds r where r.finished_at is not null
  union all
    select 'pipi' as game, r.player, r.level::integer as step, r.finished_at from public.pipi_rounds r where r.finished_at is not null
  union all
    select 'korora' as game, r.player, r.level::integer as step, r.finished_at from public.korora_rounds r where r.finished_at is not null
  union all
    select 'tui' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.tui_rounds r where r.finished_at is not null
  union all
    select 'weka' as game, r.player, r.level::integer as step, r.finished_at from public.weka_rounds r where r.finished_at is not null
  union all
    select 'parrot' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.parrot_rounds r where r.finished_at is not null
  union all
    select 'hop' as game, r.player, r.step::integer as step, r.finished_at from public.hop_rounds r where r.finished_at is not null
  union all
    select 'lizard' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.lizard_rounds r where r.finished_at is not null
  union all
    select 'pigeon' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.pigeon_rounds r where r.finished_at is not null
  union all
    select 'swamphen' as game, r.player, (r.round ->> 'step')::integer as step, r.finished_at from public.swamphen_rounds r where r.finished_at is not null
  ) k
  where k.step is not null
  group by k.game, k.player, k.step
) f;

-- One trigger function for all of them: TG_ARGV[0] is the column to watch, TG_ARGV[1] the game id.
create function public.step_changes_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was integer := (to_jsonb(old) ->> tg_argv[0])::integer;
  now_at integer := (to_jsonb(new) ->> tg_argv[0])::integer;
begin
  if now_at is not null and now_at is distinct from was then
    insert into public.step_changes (player, game, step_from, step_to) values (new.player, tg_argv[1], was, now_at);
  end if;
  return null;
end;
$$;
revoke execute on function public.step_changes_log() from public, anon, authenticated;

create trigger robin_step_changes after update on public.robin_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'robin');
create trigger pipi_step_changes after update on public.pipi_progress
for each row when (old.reached is distinct from new.reached) execute function public.step_changes_log('reached', 'pipi');
create trigger beanstalk_step_changes after update on public.beanstalk_progress
for each row when (old.stage is distinct from new.stage) execute function public.step_changes_log('stage', 'beanstalk');
create trigger korora_step_changes after update on public.korora_progress
for each row when (old.reached is distinct from new.reached) execute function public.step_changes_log('reached', 'korora');
create trigger tui_step_changes after update on public.tui_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'tui');
create trigger weka_step_changes after update on public.weka_progress
for each row when (old.reached is distinct from new.reached) execute function public.step_changes_log('reached', 'weka');
create trigger parrot_step_changes after update on public.parrot_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'parrot');
create trigger hop_step_changes after update on public.hop_progress
for each row when (old.reached is distinct from new.reached) execute function public.step_changes_log('reached', 'hop');
create trigger lizard_step_changes after update on public.lizard_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'lizard');
create trigger pigeon_step_changes after update on public.pigeon_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'pigeon');
create trigger swamphen_step_changes after update on public.swamphen_progress
for each row when (old.step is distinct from new.step) execute function public.step_changes_log('step', 'swamphen');

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
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.step as lv, r.finished_at as fin
                  from public.hop_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'hop'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.hop_progress p where p.player = m.student_id),
        'korora', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_pebble_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.korora_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.korora_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.level as lv, r.finished_at as fin
                  from public.korora_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'korora'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.korora_progress p where p.player = m.student_id),
        'pipi', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_shell_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.pipi_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.pipi_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.level as lv, r.finished_at as fin
                  from public.pipi_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'pipi'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.pipi_progress p where p.player = m.student_id),
        'tui', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_flower_day, 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.tui_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.tui_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.tui_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'tui'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.tui_progress p where p.player = m.student_id),
        'weka', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_stone_day, 'level', p.reached, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.weka_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.weka_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and (b.level) is distinct from p.reached), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.level as lv, r.finished_at as fin
                  from public.weka_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'weka'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.weka_progress p where p.player = m.student_id),
        'beanstalk', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', p.last_leaf_day, 'level', p.stage, 'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', y.d, 'm', y.wr, 't', y.tp, 'l', y.lv, 'ms', y.ms) order by y.fin desc), '[]')
            from (select x.d, x.wr, x.tp, x.ms, x.fin,
                         -- The round does not save its sum, so the days since the stage last changed (stage_days) are marked as on this stage.
                         case when dense_rank() over (order by x.d desc) <= greatest(p.stage_days, 1) then p.stage end as lv
                  from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                               case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                               (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                                from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                                where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                               r.finished_at as fin
                        from public.beanstalk_rounds r
                        where r.player = m.student_id and r.finished_at is not null
                        order by r.finished_at desc limit 10) x) y), 'child', p.child,
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'beanstalk'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.beanstalk_progress p where p.player = m.student_id),
        'pigeon', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.pigeon_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.pigeon_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.pigeon_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'pigeon'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.pigeon_progress p where p.player = m.student_id),
        'parrot', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.parrot_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.parrot_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.parrot_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'parrot'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.parrot_progress p where p.player = m.student_id),
        'lizard', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.lizard_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.lizard_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.lizard_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'lizard'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.lizard_progress p where p.player = m.student_id),
        'swamphen', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.swamphen_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.swamphen_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.swamphen_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'swamphen'
                  order by sc.at desc, sc.id desc limit 5) c)
          ) from public.swamphen_progress p where p.player = m.student_id),
        'robin', (select jsonb_build_object('daysDone', p.days_done, 'lastDay', to_char(p.last_day, 'YYYY-MM-DD'), 'level', p.step, 'good', p.good_at_step, 'since', (
            select to_char(min((s.finished_at at time zone 'Pacific/Auckland')::date), 'YYYY-MM-DD')
            from public.robin_rounds s
            where s.player = m.student_id and s.finished_at is not null
              and s.finished_at > coalesce((select max(b.finished_at) from public.robin_rounds b
                                            where b.player = m.student_id and b.finished_at is not null
                                              and ((b.round ->> 'step')::integer) is distinct from p.step), '-infinity'::timestamptz)),
          'recent', (
            select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'm', x.wr, 't', x.tp, 'l', x.lv, 'f', x.fr, 'ms', x.ms) order by x.fin desc), '[]')
            from (select (r.finished_at at time zone 'Pacific/Auckland')::date as d, r.mistakes as wr,
                         case when jsonb_typeof(r.taps) = 'array' then jsonb_array_length(r.taps) end as tp,
                         (select round(percentile_cont(0.5) within group (order by (e.v ->> 'ms')::double precision))::integer
                          from jsonb_array_elements(case when r.mistakes = 0 and jsonb_typeof(r.taps) = 'array' then r.taps else '[]'::jsonb end) e(v)
                          where jsonb_typeof(e.v -> 'ms') = 'number') as ms,
                         r.first_right as fr,
                         (r.round ->> 'step')::integer as lv, r.finished_at as fin
                  from public.robin_rounds r
                  where r.player = m.student_id and r.finished_at is not null
                  order by r.finished_at desc limit 10) x),
          'moves', (select coalesce(jsonb_agg(jsonb_build_object('from', c.step_from, 'to', c.step_to, 'at', to_char(c.at at time zone 'Pacific/Auckland', 'YYYY-MM-DD'), 'est', c.estimated) order by c.at desc, c.id desc), '[]')
            from (select sc.* from public.step_changes sc where sc.player = m.student_id and sc.game = 'robin'
                  order by sc.at desc, sc.id desc limit 5) c)
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

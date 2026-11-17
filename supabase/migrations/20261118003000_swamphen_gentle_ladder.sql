-- Swamp Hen's Reed Rows: the gentler ladder (James, 18 Nov 2026: "too hard too fast, very confusing for kids").
-- Nine steps instead of six (shared/swamphen/round.ts STEPS): 1 Equal rows, 2 Rows of 2, 3 Rows of 10 and 5, 4 Share them out,
-- 5 Turn the garden, 6 Rows of 3 and 4, 7 Under the mat, 8 Big Garden: 6 and 7 rows, 9 Big Garden: 8 and 9 rows.
--   * step may now be 1 to 9;
--   * days_at_step: counted days at the step (new goes ease in: 3, then 5, then 7 of the ten);
--   * hard_in_row: hard challenges in a row (two take the child back one step);
--   * every pupil already playing moves to the matching new step, never a harder one, with help at least level 3 and the
--     counts towards the next change started again: old 1 (rows of 2, 5, 10) -> 2, old 2 (turn) -> 4, old 3 (under the mat,
--     rows of 6 to 9) -> 6, old 4 (share) -> 6, old 5 (cut) -> 7, old 6 (one row short) -> 8. Their saved rounds' step and the
--     step history are moved the same way, and the move itself is not logged as a step change;
--   * swamphen_load and swamphen_finish carry the two new numbers; the old finish functions are dropped;
--   * the "Turn it round" achievement now needs step 6 (turning passed) and "Cut it up" step 9 (the first Big Garden step passed).

alter table public.swamphen_progress
  add column days_at_step integer not null default 0 check (days_at_step >= 0),
  add column hard_in_row integer not null default 0 check (hard_in_row >= 0);

alter table public.swamphen_progress drop constraint if exists swamphen_progress_step_check;
alter table public.swamphen_progress add constraint swamphen_progress_step_check check (step between 1 and 9);

-- The old step numbers to the new ones, the same map for progress, saved rounds and the step history.
alter table public.swamphen_progress disable trigger swamphen_step_changes;
update public.swamphen_progress
set step = (case step when 1 then 2 when 2 then 4 when 3 then 6 when 4 then 6 when 5 then 7 when 6 then 8 else step end), level = greatest(level, 3), good_in_row = 0, good_at_step = 0,
    days_at_step = 0, hard_in_row = 0, kind_levels = '{}'::jsonb;
alter table public.swamphen_progress enable trigger swamphen_step_changes;

update public.swamphen_rounds
set round = jsonb_set(round, '{step}', to_jsonb((case (round ->> 'step')::integer when 1 then 2 when 2 then 4 when 3 then 6 when 4 then 6 when 5 then 7 when 6 then 8 else (round ->> 'step')::integer end)))
where jsonb_typeof(round -> 'step') = 'number';

update public.step_changes
set step_from = (case step_from when 1 then 2 when 2 then 4 when 3 then 6 when 4 then 6 when 5 then 7 when 6 then 8 else step_from end), step_to = (case step_to when 1 then 2 when 2 then 4 when 3 then 6 when 4 then 6 when 5 then 7 when 6 then 8 else step_to end)
where game = 'swamphen';

-- The pupil's garden and its version (with the help level of each kind of go and the two new counts), or null if they've never played.
create or replace function public.swamphen_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'goodInRow', h.good_in_row,
                                    'goodAtStep', h.good_at_step, 'daysAtStep', h.days_at_step, 'hardInRow', h.hard_in_row,
                                    'kindLevels', h.kind_levels, 'version', h.version)
          from public.swamphen_progress h where h.player = swamphen_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of finished
-- days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
drop function if exists public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb);
drop function if exists public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb);

create function public.swamphen_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, days_at_step integer, hard_in_row integer,
  taps jsonb, mistakes integer, first_right integer, kind_levels jsonb, slips jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 9 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0
     or days_at_step is null or days_at_step < 0 or hard_in_row is null or hard_in_row < 0
     or jsonb_typeof(kind_levels) is distinct from 'object'
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.swamphen_rounds r where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.swamphen_progress h
  set days_done = swamphen_finish.days_done, last_day = swamphen_finish.last_day, step = swamphen_finish.step,
      level = swamphen_finish.level, good_in_row = swamphen_finish.good_in_row, good_at_step = swamphen_finish.good_at_step,
      days_at_step = swamphen_finish.days_at_step, hard_in_row = swamphen_finish.hard_in_row,
      kind_levels = swamphen_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = swamphen_finish.player and h.version = swamphen_finish.version
    and swamphen_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.swamphen_rounds r
  set open = false, taps = swamphen_finish.taps, mistakes = swamphen_finish.mistakes, first_right = swamphen_finish.first_right,
      slips = swamphen_finish.slips, finished_at = now()
  where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed;
  return true;
end;
$$;

revoke execute on function
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, integer, integer, jsonb, integer, integer, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, integer, integer, jsonb, integer, integer, jsonb, jsonb)
to service_role;

update public.achievement_types set goal = 6 where id = 'swamphen-turn-it-round';
update public.achievement_types set goal = 9 where id = 'swamphen-cut-it-up';

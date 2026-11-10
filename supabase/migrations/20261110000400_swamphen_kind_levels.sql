-- Swamp Hen's Reed Rows: a help level for each kind of go (docs/plans/maths-review-2/S19-help-per-kind-newer-five.md).
-- The whole-child level, the step and the gate stay as they are; kind_levels is { "<kind>": { "level": 0-5, "goodInRow": n } },
-- moved once a day on the first finish of the day. A kind not in the map starts at the whole-child level.

alter table public.swamphen_progress
  add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');

-- The pupil's garden and its version (with the help level of each kind of go), or null if they've never played.
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
                                    'goodAtStep', h.good_at_step, 'kindLevels', h.kind_levels, 'version', h.version)
          from public.swamphen_progress h where h.player = swamphen_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress (and the help level of each kind
-- of go), together. The count of finished days only ever stays or goes up by one. False if the challenge had already
-- finished or the version moved on.
drop function public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer);

create function public.swamphen_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, kind_levels jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 6 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0
     or jsonb_typeof(kind_levels) is distinct from 'object' then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.swamphen_rounds r where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.swamphen_progress h
  set days_done = swamphen_finish.days_done, last_day = swamphen_finish.last_day, step = swamphen_finish.step,
      level = swamphen_finish.level, good_in_row = swamphen_finish.good_in_row, good_at_step = swamphen_finish.good_at_step,
      kind_levels = swamphen_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = swamphen_finish.player and h.version = swamphen_finish.version
    and swamphen_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.swamphen_rounds r
  set open = false, taps = swamphen_finish.taps, mistakes = swamphen_finish.mistakes, first_right = swamphen_finish.first_right,
      finished_at = now()
  where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed;
  return true;
end;
$$;

revoke execute on function
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
from public, anon, authenticated;
grant execute on function
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
to service_role;

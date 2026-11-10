-- Pigeon's Berry Branch: help for each kind of go (card S19, part 2). Each kind (place, read, tens, near) keeps its own help
-- level and good days in a row, so a hard kind keeps its help while an easy one fades. The map is
-- { "<kind>": { "level": 0 to 5, "goodInRow": n } }, worked out by the server function (shared/pigeon/server.ts) on the
-- day's first finish. A kind not in the map starts at the child's whole-child level.

alter table public.pigeon_progress
  add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');

-- The pupil's branch and its version, or null if they've never played (now with the level of each kind).
create or replace function public.pigeon_load(player uuid)
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
          from public.pigeon_progress h where h.player = pigeon_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress (and the level of each kind),
-- together. The count of finished days only ever stays or goes up by one. False if the challenge had already finished or the
-- version moved on.
drop function public.pigeon_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer);

create function public.pigeon_finish(
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
     or days_done is null or step is null or step not between 1 and 7 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0
     or jsonb_typeof(kind_levels) is distinct from 'object' then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.pigeon_rounds r where r.player = pigeon_finish.player and r.seed = pigeon_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.pigeon_progress h
  set days_done = pigeon_finish.days_done, last_day = pigeon_finish.last_day, step = pigeon_finish.step,
      level = pigeon_finish.level, good_in_row = pigeon_finish.good_in_row, good_at_step = pigeon_finish.good_at_step,
      kind_levels = pigeon_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = pigeon_finish.player and h.version = pigeon_finish.version
    and pigeon_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.pigeon_rounds r
  set open = false, taps = pigeon_finish.taps, mistakes = pigeon_finish.mistakes, first_right = pigeon_finish.first_right,
      finished_at = now()
  where r.player = pigeon_finish.player and r.seed = pigeon_finish.seed;
  return true;
end;
$$;

-- Only the server function (service role) may call them.
revoke execute on function
  public.pigeon_load(uuid),
  public.pigeon_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
from public, anon, authenticated;
grant execute on function
  public.pigeon_load(uuid),
  public.pigeon_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
to service_role;

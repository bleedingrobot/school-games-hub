-- Parrot's Equal Stones: help for each kind of go (card S19, part 3).
-- Each pupil keeps a help level for each kind of go (miss, swap, both, sub, tf) beside the whole-child level:
-- { "<kind>": { "level": 0-5, "goodInRow": n } }. A kind missing from the map starts at the whole-child level.

alter table public.parrot_progress
  add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');

-- The pupil's rope and its version, or null if they've never played. Now with the help for each kind of go.
create or replace function public.parrot_load(player uuid)
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
          from public.parrot_progress h where h.player = parrot_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together (now with the help for
-- each kind of go). The count of finished days only ever stays or goes up by one. False if the challenge had already
-- finished or the version moved on.
drop function public.parrot_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb);

create function public.parrot_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, slips jsonb default null,
  kind_levels jsonb default '{}'::jsonb
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
  perform 1 from public.parrot_rounds r where r.player = parrot_finish.player and r.seed = parrot_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.parrot_progress h
  set days_done = parrot_finish.days_done, last_day = parrot_finish.last_day, step = parrot_finish.step,
      level = parrot_finish.level, good_in_row = parrot_finish.good_in_row, good_at_step = parrot_finish.good_at_step,
      kind_levels = parrot_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = parrot_finish.player and h.version = parrot_finish.version
    and parrot_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.parrot_rounds r
  set open = false, taps = parrot_finish.taps, mistakes = parrot_finish.mistakes, first_right = parrot_finish.first_right, slips = parrot_finish.slips,
      finished_at = now()
  where r.player = parrot_finish.player and r.seed = parrot_finish.seed;
  return true;
end;
$$;

revoke execute on function
  public.parrot_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.parrot_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb)
to service_role;

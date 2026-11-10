-- Lizard's Bundles: help for each kind of go (card S19, part 4).
--
-- Each kind of go (build, read, bundle, swap, more) keeps its own help level, saved as one object in
-- lizard_progress.kind_levels: { "<kind>": { "level": 0 to 5, "goodInRow": n } }. A kind not in it yet starts at the
-- child's own level (lizard_progress.level). The shared kit works the map out (shared/kit/help.ts, fadeByKind) on the
-- day's first finish; lizard_finish only saves it, and lizard_load returns it as kindLevels.

alter table public.lizard_progress
  add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');

create or replace function public.lizard_load(player uuid)
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
          from public.lizard_progress h where h.player = lizard_load.player);
end;
$$;

drop function public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer);

create function public.lizard_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, kind_levels jsonb, taps jsonb, mistakes integer, first_right integer
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
  perform 1 from public.lizard_rounds r where r.player = lizard_finish.player and r.seed = lizard_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.lizard_progress h
  set days_done = lizard_finish.days_done, last_day = lizard_finish.last_day, step = lizard_finish.step,
      level = lizard_finish.level, good_in_row = lizard_finish.good_in_row, good_at_step = lizard_finish.good_at_step,
      kind_levels = lizard_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = lizard_finish.player and h.version = lizard_finish.version
    and lizard_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.lizard_rounds r
  set open = false, taps = lizard_finish.taps, mistakes = lizard_finish.mistakes, first_right = lizard_finish.first_right,
      finished_at = now()
  where r.player = lizard_finish.player and r.seed = lizard_finish.seed;
  return true;
end;
$$;

revoke execute on function
  public.lizard_load(uuid),
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, jsonb, integer, integer)
from public, anon, authenticated;
grant execute on function
  public.lizard_load(uuid),
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, jsonb, integer, integer)
to service_role;

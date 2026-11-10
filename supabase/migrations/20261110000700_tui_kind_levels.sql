-- Tūī's Ten Tree: help for each way of asking (card S35, part 1, copying S19's Pigeon change). Each way (v0 "10 + n", v1 "n + 10",
-- v2 "10 + ? = 1n", v3 "1n - 10") keeps its own help level and good rounds in a row, so a hard way keeps its help while an easy one
-- fades. The map is { "v0": { "level": 0 to 5, "goodInRow": n } }, worked out by the server function (shared/tui/server.ts) on the
-- day's first finish. A way not in the map starts at the child's whole-child level. Unlike Pigeon, a new step does not clear the
-- map: ways already in play keep their level. `level` stays the whole-child level the step logic uses.

alter table public.tui_progress
  add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');

-- The pupil's tree and its version, or null if they've never played (now with the level of each way).
create or replace function public.tui_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastFlowerDay', to_char(h.last_flower_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'goodInRow', h.good_in_row,
                                    'goodAtStep', h.good_at_step, 'kindLevels', h.kind_levels, 'version', h.version)
          from public.tui_progress h where h.player = tui_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress (and the level of each way), together.
-- The count of finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
drop function public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer);

create function public.tui_finish(
  player uuid, seed bigint, version integer, days_done integer, last_flower_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, kind_levels jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 5 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0
     or jsonb_typeof(kind_levels) is distinct from 'object' then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.tui_rounds r where r.player = tui_finish.player and r.seed = tui_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.tui_progress h
  set days_done = tui_finish.days_done, last_flower_day = tui_finish.last_flower_day, step = tui_finish.step,
      level = tui_finish.level, good_in_row = tui_finish.good_in_row, good_at_step = tui_finish.good_at_step,
      kind_levels = tui_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = tui_finish.player and h.version = tui_finish.version
    and tui_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.tui_rounds r
  set open = false, taps = tui_finish.taps, mistakes = tui_finish.mistakes, first_right = tui_finish.first_right,
      finished_at = now()
  where r.player = tui_finish.player and r.seed = tui_finish.seed;
  return true;
end;
$$;

-- The teacher's line for one student: as 20261108000200, plus helpMax, the highest level among the ways they have met (null
-- until the first finish after this change). `level` stays the whole-child level; the teacher line says "highest of the ways".
create or replace function public.teacher_tui_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastFlowerDay', to_char(h.last_flower_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'helpMax', (select max((v ->> 'level')::integer) from jsonb_each(h.kind_levels) k(way, v)),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^ten(and|less):[1-9]$'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.tui_progress h where h.player = student);
end;
$$;

-- Only the server function (service role) may call them.
revoke execute on function
  public.tui_load(uuid),
  public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
from public, anon, authenticated;
grant execute on function
  public.tui_load(uuid),
  public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)
to service_role;

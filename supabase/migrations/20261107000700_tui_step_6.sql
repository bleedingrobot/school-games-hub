-- Tui step 6, "Ten more, ten less" (R8): the step check widens from 1..5 to 1..6. Existing rows (steps 1..5) stay valid.
-- Depends on 20261106000100_tui.sql.

alter table public.tui_progress drop constraint tui_progress_step_check;
alter table public.tui_progress add constraint tui_progress_step_check check (step between 1 and 6);

create or replace function public.tui_finish(
  player uuid, seed bigint, version integer, days_done integer, last_flower_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or first_right is null or first_right < 0
     or days_done is null or step is null or step not between 1 and 6 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.tui_rounds r where r.player = tui_finish.player and r.seed = tui_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.tui_progress h
  set days_done = tui_finish.days_done, last_flower_day = tui_finish.last_flower_day, step = tui_finish.step,
      level = tui_finish.level, good_in_row = tui_finish.good_in_row, good_at_step = tui_finish.good_at_step,
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

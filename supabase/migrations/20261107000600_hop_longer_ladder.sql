-- Hop's longer ladder (maths review R8): threes and fours after twos, then tens past 100. A step is saved as the size of its
-- hop (10, 5, 2, 3, 4) and 200 for tens past 100 (tens to 200). Existing rows are all 10, 5 or 2, so widening the checks changes
-- none of them. The steps in order, so the furthest step reached can only go on, is now 10, 5, 2, 3, 4, 200.
-- Depends on 20261104000600_hop.sql.

alter table public.hop_progress drop constraint hop_progress_reached_check;
alter table public.hop_progress add constraint hop_progress_reached_check check (reached in (10, 5, 2, 3, 4, 200));
alter table public.hop_rounds drop constraint hop_rounds_step_check;
alter table public.hop_rounds add constraint hop_rounds_step_check check (step in (10, 5, 2, 3, 4, 200));

create or replace function public.hop_step_rank(step integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select array_position(array[10, 5, 2, 3, 4, 200], step) $$;

-- The same as before, with the wider list of steps.
create or replace function public.hop_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pad_day date, reached smallint, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not in (10, 5, 2, 3, 4, 200) then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.hop_rounds r where r.player = hop_finish.player and r.seed = hop_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.hop_progress h
  set days_done = hop_finish.days_done, last_pad_day = hop_finish.last_pad_day, reached = hop_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = hop_finish.player and h.version = hop_finish.version
    and hop_finish.days_done between h.days_done and h.days_done + 1
    and public.hop_step_rank(hop_finish.reached) >= public.hop_step_rank(h.reached);
  if not found then
    return false;
  end if;
  update public.hop_rounds r set open = false, taps = hop_finish.taps, mistakes = hop_finish.mistakes, finished_at = now()
  where r.player = hop_finish.player and r.seed = hop_finish.seed;
  return true;
end;
$$;

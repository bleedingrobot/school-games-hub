-- Penguin Pairs level 5, near doubles (maths review R8, Stage A). The furthest level reached and a challenge's level could only
-- be 1 to 4; both now allow 1 to 5. Nothing a pupil has changes: every saved row already sits inside 1 to 4, and no row is
-- deleted or rewritten. The new level asks Weka's own add facts (add:6+7), which record_fact_answers already keeps.

alter table public.korora_progress drop constraint korora_progress_reached_check;
alter table public.korora_progress add constraint korora_progress_reached_check check (reached between 1 and 5);

alter table public.korora_rounds drop constraint korora_rounds_level_check;
alter table public.korora_rounds add constraint korora_rounds_level_check check (level between 1 and 5);

-- The same function as before, only with the new top level (its grants stay as they were).
create or replace function public.korora_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pebble_day date, reached smallint, taps jsonb, mistakes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 5 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.korora_rounds r where r.player = korora_finish.player and r.seed = korora_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.korora_progress h
  set days_done = korora_finish.days_done, last_pebble_day = korora_finish.last_pebble_day, reached = korora_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = korora_finish.player and h.version = korora_finish.version
    and korora_finish.days_done between h.days_done and h.days_done + 1
    and korora_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.korora_rounds r set open = false, taps = korora_finish.taps, mistakes = korora_finish.mistakes, finished_at = now()
  where r.player = korora_finish.player and r.seed = korora_finish.seed;
  return true;
end;
$$;

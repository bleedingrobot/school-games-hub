-- Kiwi's Beanstalk: the dots follow the child, not the calendar (maths review R6, docs/plans/maths-review/R6-help-follows-the-child.md).
--
-- Until now the leaves' ten-frame dots were full for days 1 to 10 of a beanstalk, small for 11 to 20 and gone for 21 to 30,
-- for every child. Now each child has their own help level, worked out by shared/beanstalk/progress.ts (placeAfter) from how
-- the day's first finished challenge went, and saved with the progress:
--   help         0 full dots, 1 small dots, 2 none (more help is a lower number);
--   good_in_row  good challenges in a row so far (two take the help down a step, then it goes back to 0).
-- The leaves' colours, the Golden Egg and the friend still come from days_done alone.
--
-- Existing pupils: help starts where the calendar had them (full for days 0-9 of the beanstalk, small for 10-19, none for
-- 20-29), so nobody's picture jumps the day this goes live; good_in_row starts at 0. Not destructive.
--
-- beanstalk_load returns the two new fields. beanstalk_finish takes them as two new LAST arguments with a null default
-- (null keeps what is saved), so the server function that is deployed before this migration, which doesn't send them,
-- still saves its finishes. teacher_beanstalk_student returns help too, for the teacher's line.
-- Depends on 20261104000700_beanstalk.sql and 20261104000800_beanstalk_hub.sql.

alter table public.beanstalk_progress
  add column help smallint not null default 0 check (help between 0 and 2),
  add column good_in_row smallint not null default 0 check (good_in_row between 0 and 1);

update public.beanstalk_progress set help = least(2, (days_done % 30) / 10);

-- The pupil's beanstalk and its version, or null if they've never played.
create or replace function public.beanstalk_load(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  return (select jsonb_build_object('child', b.child, 'daysDone', b.days_done,
                                    'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'), 'version', b.version,
                                    'help', b.help, 'goodInRow', b.good_in_row)
          from public.beanstalk_progress b where b.player = beanstalk_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one. False if the challenge had already finished or the version moved on.
drop function public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer);
create function public.beanstalk_finish(
  player uuid, seed bigint, version integer, days_done integer, last_leaf_day date, taps jsonb, mistakes integer,
  help smallint default null, good_in_row smallint default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or help < 0 or help > 2 or good_in_row < 0 or good_in_row > 1 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.beanstalk_rounds r where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.beanstalk_progress b
  set days_done = beanstalk_finish.days_done, last_leaf_day = beanstalk_finish.last_leaf_day,
      help = coalesce(beanstalk_finish.help, b.help), good_in_row = coalesce(beanstalk_finish.good_in_row, b.good_in_row),
      version = b.version + 1, updated_at = now()
  where b.player = beanstalk_finish.player and b.version = beanstalk_finish.version
    and beanstalk_finish.days_done between b.days_done and b.days_done + 1;
  if not found then
    return false;
  end if;
  update public.beanstalk_rounds r set open = false, taps = beanstalk_finish.taps, mistakes = beanstalk_finish.mistakes, finished_at = now()
  where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed;
  return true;
end;
$$;

-- One line's worth for a student's page: finished days and the dots help, or null if they haven't played.
create or replace function public.teacher_beanstalk_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', b.days_done, 'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'), 'help', b.help)
          from public.beanstalk_progress b where b.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what (lock the new function as the first Beanstalk migration does)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.beanstalk_load(uuid),
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint),
  public.teacher_beanstalk_student(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_beanstalk_student(uuid) to authenticated;
grant execute on function
  public.beanstalk_load(uuid),
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint)
to service_role;

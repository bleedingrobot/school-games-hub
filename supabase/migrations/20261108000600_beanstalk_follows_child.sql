-- Kiwi's Beanstalk: the next sum follows the child, not the calendar (maths review 2, card S21,
-- docs/plans/maths-review-2/S21-beanstalk-follows-the-child.md).
--
-- Until now the sum (10, 20, 100, 1000) came from the Golden Egg count: one egg, 30 days, one step. Now each child has a saved
-- stage, worked out by shared/beanstalk/progress.ts (afterDay) from how the day's first finished challenge went:
--   stage       0 bonds to 10, 1 to 20, 2 to 100, 3 to 1000 (an index into TARGETS);
--   good_days   good days in a row so far (8 or more of 10 pairs right at the first tap);
--   hard_days   hard days in a row (4 or fewer);
--   stage_days  finished days since the stage last changed (0 shows the bridge line on the next challenge).
-- Two good days with the sum secure move a child up, two hard days step them back. The egg and the friend still come from days_done.
--
-- Existing children: stage starts where the calendar had them (egg count mod 4), so nobody's sum changes the day this goes live.
-- stage_days starts at the days into their beanstalk, but at least 1, so no existing child sees the "new beanstalk" bridge line.
--
-- beanstalk_rounds keeps the round as the server made it (the child's stage, with a few older pairs in a second tray),
-- so the taps are checked against exactly what the child was shown. Open challenges have none; the server then makes it from the seed.
--
-- Old deployed function: the four new beanstalk_finish arguments come LAST with a null default (null keeps what is saved) and
-- beanstalk_start's round is last with a null default, so the server function deployed before this migration still works.
-- Not destructive. Depends on 20261104000700_beanstalk.sql, 20261104000800_beanstalk_hub.sql and 20261107000300_beanstalk_help.sql.

alter table public.beanstalk_progress
  add column stage smallint not null default 0 check (stage between 0 and 3),
  add column good_days smallint not null default 0 check (good_days between 0 and 9),
  add column hard_days smallint not null default 0 check (hard_days between 0 and 9),
  add column stage_days smallint not null default 0 check (stage_days between 0 and 100);

update public.beanstalk_progress
set stage = (days_done / 30) % 4, stage_days = greatest(1, days_done % 30);

alter table public.beanstalk_rounds
  add column round jsonb check (round is null or (jsonb_typeof(round) = 'object' and jsonb_typeof(round -> 'leaves') = 'array'));

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
                                    'help', b.help, 'goodInRow', b.good_in_row,
                                    'stage', b.stage, 'goodDays', b.good_days, 'hardDays', b.hard_days, 'stageDays', b.stage_days)
          from public.beanstalk_progress b where b.player = beanstalk_load.player);
end;
$$;

-- Keeps a new challenge and its round, and closes any other open one. False if the pupil has used this seed before.
drop function public.beanstalk_start(uuid, bigint);
create function public.beanstalk_start(player uuid, seed bigint, round jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if round is not null and (jsonb_typeof(round) is distinct from 'object' or jsonb_typeof(round -> 'leaves') is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  if exists (select 1 from public.beanstalk_rounds r where r.player = beanstalk_start.player and r.seed = beanstalk_start.seed) then
    return false;
  end if;
  update public.beanstalk_rounds r set open = false where r.player = beanstalk_start.player and r.open;
  delete from public.beanstalk_rounds r
  where r.player = beanstalk_start.player and not r.open and r.started_at < now() - interval '30 days';
  insert into public.beanstalk_rounds (player, seed, round) values (player, seed, round);
  return true;
end;
$$;

-- One of the pupil's challenges by its seed: { open, round }, or null if it isn't theirs. The round is null for a challenge started before rounds were kept.
create or replace function public.beanstalk_round(player uuid, seed bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', r.open, 'round', r.round)
  from public.beanstalk_rounds r where r.player = beanstalk_round.player and r.seed = beanstalk_round.seed
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, and the stage moves by one at most. False if the challenge had already
-- finished or the version moved on.
drop function public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint);
create function public.beanstalk_finish(
  player uuid, seed bigint, version integer, days_done integer, last_leaf_day date, taps jsonb, mistakes integer,
  help smallint default null, good_in_row smallint default null,
  stage smallint default null, good_days smallint default null, hard_days smallint default null, stage_days smallint default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or help < 0 or help > 2 or good_in_row < 0 or good_in_row > 1
     or stage < 0 or stage > 3 or good_days < 0 or good_days > 9 or hard_days < 0 or hard_days > 9
     or stage_days < 0 or stage_days > 100 then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.beanstalk_rounds r where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.beanstalk_progress b
  set days_done = beanstalk_finish.days_done, last_leaf_day = beanstalk_finish.last_leaf_day,
      help = coalesce(beanstalk_finish.help, b.help), good_in_row = coalesce(beanstalk_finish.good_in_row, b.good_in_row),
      stage = coalesce(beanstalk_finish.stage, b.stage), good_days = coalesce(beanstalk_finish.good_days, b.good_days),
      hard_days = coalesce(beanstalk_finish.hard_days, b.hard_days), stage_days = coalesce(beanstalk_finish.stage_days, b.stage_days),
      version = b.version + 1, updated_at = now()
  where b.player = beanstalk_finish.player and b.version = beanstalk_finish.version
    and beanstalk_finish.days_done between b.days_done and b.days_done + 1
    and (beanstalk_finish.stage is null or abs(beanstalk_finish.stage - b.stage) <= 1);
  if not found then
    return false;
  end if;
  update public.beanstalk_rounds r set open = false, taps = beanstalk_finish.taps, mistakes = beanstalk_finish.mistakes, finished_at = now()
  where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed;
  return true;
end;
$$;

-- One line's worth for a student's page: finished days, the dots help and the stage, or null if they haven't played.
create or replace function public.teacher_beanstalk_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', b.days_done, 'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'), 'help', b.help, 'stage', b.stage)
          from public.beanstalk_progress b where b.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what (lock the new functions as the first Beanstalk migration does)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.beanstalk_start(uuid, bigint, jsonb),
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint)
from public, anon, authenticated;
grant execute on function
  public.beanstalk_start(uuid, bigint, jsonb),
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint)
to service_role;

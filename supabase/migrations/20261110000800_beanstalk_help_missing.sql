-- Kiwi's Beanstalk: one dots level for pair goes and one for missing-leaf goes (maths review 2, card S35 Part 2,
-- docs/plans/maths-review-2/S35-help-per-kind-of-go-older-games.md).
--
-- Until now a child had one dots level (help, good_in_row) for the whole challenge. A child strong at pairs but new at the
-- missing leaf ("7 + ? = 10") got the same dots for both. Now help and good_in_row are the PAIR goes (7 a round) and the new
-- help_missing and good_in_row_missing are the MISSING-LEAF goes (3 a round). 0 full dots, 1 small, 2 none.
--
-- Existing children: both new columns start equal to the pair kind's, so nobody's dots jump on go-live.
-- Old deployed function: the two new beanstalk_finish arguments come LAST with a null default (null keeps what is saved),
-- so the server function deployed before this migration still works until it is rebuilt.
-- Not destructive. Depends on 20261107000300_beanstalk_help.sql and 20261108000700_beanstalk_follows_child.sql.

alter table public.beanstalk_progress
  add column help_missing smallint not null default 0 check (help_missing between 0 and 2),
  add column good_in_row_missing smallint not null default 0 check (good_in_row_missing between 0 and 1);

update public.beanstalk_progress set help_missing = help, good_in_row_missing = good_in_row;

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
                                    'helpMissing', b.help_missing, 'goodInRowMissing', b.good_in_row_missing,
                                    'stage', b.stage, 'goodDays', b.good_days, 'hardDays', b.hard_days, 'stageDays', b.stage_days)
          from public.beanstalk_progress b where b.player = beanstalk_load.player);
end;
$$;

-- Finishes an open challenge with the server's replay of its taps and saves the progress, together. The count of
-- finished days only ever stays or goes up by one, and the stage moves by one at most. False if the challenge had already
-- finished or the version moved on.
drop function public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint);
create function public.beanstalk_finish(
  player uuid, seed bigint, version integer, days_done integer, last_leaf_day date, taps jsonb, mistakes integer,
  help smallint default null, good_in_row smallint default null,
  stage smallint default null, good_days smallint default null, hard_days smallint default null, stage_days smallint default null,
  help_missing smallint default null, good_in_row_missing smallint default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or help < 0 or help > 2 or good_in_row < 0 or good_in_row > 1
     or help_missing < 0 or help_missing > 2 or good_in_row_missing < 0 or good_in_row_missing > 1
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
      help_missing = coalesce(beanstalk_finish.help_missing, b.help_missing),
      good_in_row_missing = coalesce(beanstalk_finish.good_in_row_missing, b.good_in_row_missing),
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

-- ---------------------------------------------------------------------------
-- Who can call what (lock the new function as the earlier Beanstalk migrations do)
-- ---------------------------------------------------------------------------

revoke execute on function
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint)
from public, anon, authenticated;
grant execute on function
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint)
to service_role;

-- S34 Part 2: the six older games (Hop, Weka, Penguin Pairs, Pipi, Tūī, Kiwi's Beanstalk) save the kind of each go's first wrong
-- choice and show the teacher a "usual slip" (LEARNING-DESIGN rule 9, docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md),
-- the way Robin already does (20261108000100_robin.sql).
--
-- Each <game>_rounds gets a nullable `slips jsonb` column: an array with one entry per go, the kind of its first wrong tap or null
-- when the go was right first time. Rounds already saved stay null and nothing is changed or deleted.
-- Each <game>_finish gets a last argument `slips jsonb default null`, so a server function deployed before this migration (which
-- does not send it) still finishes challenges; the old signature is dropped and the new one takes its place with the same grants.
-- Each teacher_<game>_student now also returns `slip`: the commonest kind among the last ten finished challenges that saved slips,
-- only if it was seen at least 3 times and no other kind ties it (the same rule as shared/kit/slips.ts topSlip); otherwise null.
-- Depends on the Hop, Weka, Korora, Pipi, Tui and Beanstalk migrations before it. Not destructive.

alter table public.hop_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

alter table public.weka_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

alter table public.korora_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

alter table public.pipi_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

alter table public.tui_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

alter table public.beanstalk_rounds add column slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

-- ---------------------------------------------------------------------------
-- Hop
-- ---------------------------------------------------------------------------

drop function public.hop_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer);
create function public.hop_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pad_day date, reached smallint, taps jsonb, mistakes integer,
  slips jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not in (10, 5, 2, 3, 4, 200)
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
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
  update public.hop_rounds r set open = false, taps = hop_finish.taps, mistakes = hop_finish.mistakes, slips = hop_finish.slips, finished_at = now()
  where r.player = hop_finish.player and r.seed = hop_finish.seed;
  return true;
end;
$$;

create or replace function public.teacher_hop_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPadDay', to_char(h.last_pad_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.hop_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('off1', 'stay', 'far', 'step', 'way')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1))
          from public.hop_progress h where h.player = student);
end;
$$;

revoke execute on function public.hop_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.hop_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Weka
-- ---------------------------------------------------------------------------

drop function public.weka_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer);
create function public.weka_finish(
  player uuid, seed bigint, version integer, days_done integer, last_stone_day date, reached smallint, taps jsonb, mistakes integer,
  slips jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 4
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.weka_rounds r where r.player = weka_finish.player and r.seed = weka_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.weka_progress h
  set days_done = weka_finish.days_done, last_stone_day = weka_finish.last_stone_day, reached = weka_finish.reached,
      version = h.version + 1, updated_at = now()
  where h.player = weka_finish.player and h.version = weka_finish.version
    and weka_finish.days_done between h.days_done and h.days_done + 1
    and weka_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.weka_rounds r set open = false, taps = weka_finish.taps, mistakes = weka_finish.mistakes, slips = weka_finish.slips, finished_at = now()
  where r.player = weka_finish.player and r.seed = weka_finish.seed;
  return true;
end;
$$;

create or replace function public.teacher_weka_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastStoneDay', to_char(h.last_stone_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.weka_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('rock', 'double', 'part', 'off1', 'add')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'add-sub' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key in ('add:2+9', 'add:3+8', 'add:3+9', 'add:4+7', 'add:4+8', 'add:4+9', 'add:5+6',
                                              'add:5+7', 'add:5+8', 'add:5+9', 'add:6+6', 'add:6+7', 'add:6+8', 'add:6+9',
                                              'add:7+7', 'add:7+8', 'add:7+9', 'add:8+8', 'add:8+9', 'add:9+9')
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.weka_progress h where h.player = student);
end;
$$;

revoke execute on function public.weka_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.weka_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Penguin Pairs
-- ---------------------------------------------------------------------------

drop function public.korora_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer);
create function public.korora_finish(
  player uuid, seed bigint, version integer, days_done integer, last_pebble_day date, reached smallint, taps jsonb, mistakes integer,
  slips jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 5
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
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
  update public.korora_rounds r set open = false, taps = korora_finish.taps, mistakes = korora_finish.mistakes, slips = korora_finish.slips, finished_at = now()
  where r.player = korora_finish.player and r.seed = korora_finish.seed;
  return true;
end;
$$;

create or replace function public.teacher_korora_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastPebbleDay', to_char(h.last_pebble_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.korora_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('same', 'plus1', 'plus2', 'miscount', 'all', 'minus2', 'double', 'noExtra', 'bigger')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(dbl|half|oddeven):[0-9]+$'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.korora_progress h where h.player = student);
end;
$$;

revoke execute on function public.korora_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.korora_finish(uuid, bigint, integer, integer, date, smallint, jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Pipi
-- ---------------------------------------------------------------------------

drop function public.pipi_finish(uuid, bigint, integer, integer, date, smallint, integer, jsonb, integer);
create function public.pipi_finish(
  player uuid, seed bigint, version integer, days_done integer, last_shell_day date, reached smallint, played integer, taps jsonb, mistakes integer,
  slips jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(taps) is distinct from 'array' or mistakes is null or mistakes < 0 or days_done is null
     or reached is null or reached not between 1 and 3 or played is null
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.pipi_rounds r where r.player = pipi_finish.player and r.seed = pipi_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.pipi_progress h
  set days_done = pipi_finish.days_done, last_shell_day = pipi_finish.last_shell_day, reached = pipi_finish.reached,
      played = pipi_finish.played, version = h.version + 1, updated_at = now()
  where h.player = pipi_finish.player and h.version = pipi_finish.version
    and pipi_finish.days_done between h.days_done and h.days_done + 1
    and pipi_finish.played = h.played + 1
    and pipi_finish.reached >= h.reached;
  if not found then
    return false;
  end if;
  update public.pipi_rounds r set open = false, taps = pipi_finish.taps, mistakes = pipi_finish.mistakes, slips = pipi_finish.slips, finished_at = now()
  where r.player = pipi_finish.player and r.seed = pipi_finish.seed;
  return true;
end;
$$;

create or replace function public.teacher_pipi_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastShellDay', to_char(h.last_shell_day, 'YYYY-MM-DD'),
                                    'reached', h.reached, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.pipi_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('shown', 'whole', 'add', 'off1', 'part', 'before')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1))
          from public.pipi_progress h where h.player = student);
end;
$$;

revoke execute on function public.pipi_finish(uuid, bigint, integer, integer, date, smallint, integer, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.pipi_finish(uuid, bigint, integer, integer, date, smallint, integer, jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Tūī
-- ---------------------------------------------------------------------------

drop function public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb);
create function public.tui_finish(
  player uuid, seed bigint, version integer, days_done integer, last_flower_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, kind_levels jsonb,
  slips jsonb default null
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
     or jsonb_typeof(kind_levels) is distinct from 'object'
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
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
      slips = tui_finish.slips, finished_at = now()
  where r.player = tui_finish.player and r.seed = tui_finish.seed;
  return true;
end;
$$;

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
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.tui_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('reverse', 'tens', 'ones', 'off1', 'total', 'up')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^ten(and|less):[1-9]$'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.tui_progress h where h.player = student);
end;
$$;

revoke execute on function public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.tui_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Kiwi's Beanstalk
-- ---------------------------------------------------------------------------

drop function public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint);
create function public.beanstalk_finish(
  player uuid, seed bigint, version integer, days_done integer, last_leaf_day date, taps jsonb, mistakes integer,
  help smallint default null, good_in_row smallint default null,
  stage smallint default null, good_days smallint default null, hard_days smallint default null, stage_days smallint default null,
  help_missing smallint default null, good_in_row_missing smallint default null,
  slips jsonb default null
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
     or stage_days < 0 or stage_days > 100
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
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
  update public.beanstalk_rounds r set open = false, taps = beanstalk_finish.taps, mistakes = beanstalk_finish.mistakes,
      slips = beanstalk_finish.slips, finished_at = now()
  where r.player = beanstalk_finish.player and r.seed = beanstalk_finish.seed;
  return true;
end;
$$;

create or replace function public.teacher_beanstalk_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', b.days_done, 'lastLeafDay', to_char(b.last_leaf_day, 'YYYY-MM-DD'), 'help', b.help, 'stage', b.stage,
                                    'slip', (
                                      select case when y.n >= 3 and y.n > coalesce(y.next_n, 0) then y.kind end
                                      from (
                                        select s.kind, count(*) n, lead(count(*)) over (order by count(*) desc, s.kind) next_n
                                        from (select r.slips from public.beanstalk_rounds r
                                              where r.player = student and not r.open and r.slips is not null
                                              order by r.finished_at desc limit 10) l,
                                             lateral jsonb_array_elements_text(l.slips) s(kind)
                                        where s.kind in ('over', 'under', 'close', 'digit')
                                        group by s.kind) y
                                      order by y.n desc, y.kind limit 1))
          from public.beanstalk_progress b where b.player = student);
end;
$$;

revoke execute on function
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, jsonb)
from public, anon, authenticated;
grant execute on function
  public.beanstalk_finish(uuid, bigint, integer, integer, date, jsonb, integer, smallint, smallint, smallint, smallint, smallint, smallint, smallint, smallint, jsonb)
to service_role;

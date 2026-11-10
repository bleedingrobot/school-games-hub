-- S34 part 4: the kind of slip behind a child's wrong taps, kept and shown for the newer games.
--   * Pigeon: a nullable `slips jsonb` on pigeon_rounds, set at finish (a second pigeon_finish that also takes the slips, beside
--     the old one), and `slip` on teacher_pigeon_student.
--   * Parrot and Robin: their teacher_<game>_student functions now count EVERY kind of slip (Parrot counted only copy, total and
--     all; Robin left out 'near').
-- All of them give the commonest slip among the last ten finished challenges only when it shows at least three times and no
-- other kind has the same count (the kit's topSlip rule, shared/kit/slips.ts); otherwise null ("no single slip stands out yet").
-- Additive only: nothing is dropped, no row is changed, and rounds finished before this keep slips = null.

-- ---------------------------------------------------------------------------
-- Pigeon: save the slips
-- ---------------------------------------------------------------------------

alter table public.pigeon_rounds
  add column if not exists slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

-- Finishes an open challenge as pigeon_finish does, and keeps the slip behind each go's first wrong tap (a list the length of
-- the round: a kind, or null for a go right first time or a wrong place on the line). The 13-argument pigeon_finish stays as it
-- was for any caller that does not send slips.
create function public.pigeon_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, taps jsonb, mistakes integer, first_right integer, kind_levels jsonb, slips jsonb
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
     or jsonb_typeof(kind_levels) is distinct from 'object'
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.pigeon_rounds r where r.player = pigeon_finish.player and r.seed = pigeon_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.pigeon_progress h
  set days_done = pigeon_finish.days_done, last_day = pigeon_finish.last_day, step = pigeon_finish.step,
      level = pigeon_finish.level, good_in_row = pigeon_finish.good_in_row, good_at_step = pigeon_finish.good_at_step,
      kind_levels = pigeon_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = pigeon_finish.player and h.version = pigeon_finish.version
    and pigeon_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.pigeon_rounds r
  set open = false, taps = pigeon_finish.taps, mistakes = pigeon_finish.mistakes, first_right = pigeon_finish.first_right,
      slips = pigeon_finish.slips, finished_at = now()
  where r.player = pigeon_finish.player and r.seed = pigeon_finish.seed;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teacher: one line's worth for a student's page, now with the usual slip
-- ---------------------------------------------------------------------------

-- Pigeon (as 20261107000200_pigeon.sql, plus `slip`).
create or replace function public.teacher_pigeon_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when t.n >= 3 and t.next_n is distinct from t.n then t.kind end
                                      from (select c.kind, c.n, lead(c.n) over (order by c.n desc, c.kind) next_n
                                            from (select s.kind, count(*) n
                                                  from (select r.slips from public.pigeon_rounds r
                                                        where r.player = student and not r.open and r.slips is not null
                                                        order by r.finished_at desc limit 10) l,
                                                       lateral jsonb_array_elements_text(l.slips) s(kind)
                                                  where s.kind in ('reverse', 'ten', 'one', 'mirror', 'near')
                                                  group by s.kind) c
                                            order by c.n desc, c.kind limit 1) t),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(place100|read100|tens100|near10|zoom|place1000|read1000|near100):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.pigeon_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.pigeon_progress h where h.player = student);
end;
$$;

-- Parrot (as 20261107000500_parrot.sql, now counting every kind of slip).
create or replace function public.teacher_parrot_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when t.n >= 3 and t.next_n is distinct from t.n then t.kind end
                                      from (select c.kind, c.n, lead(c.n) over (order by c.n desc, c.kind) next_n
                                            from (select s.kind, count(*) n
                                                  from (select r.slips from public.parrot_rounds r
                                                        where r.player = student and not r.open and r.slips is not null
                                                        order by r.finished_at desc limit 10) l,
                                                       lateral jsonb_array_elements_text(l.slips) s(kind)
                                                  where s.kind in ('all', 'copy', 'total', 'off1', 'dbl', 'near', 'both', 'first', 'side', 'more', 'less')
                                                  group by s.kind) c
                                            order by c.n desc, c.kind limit 1) t),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.attempts >= 2 and g.box < 2
                                              and g.fact_key like 'eq%'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.parrot_progress h where h.player = student);
end;
$$;

-- Robin (as 20261108000100_robin.sql, now counting 'near' too).
create or replace function public.teacher_robin_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastDay', to_char(h.last_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'slip', (
                                      select case when t.n >= 3 and t.next_n is distinct from t.n then t.kind end
                                      from (select c.kind, c.n, lead(c.n) over (order by c.n desc, c.kind) next_n
                                            from (select s.kind, count(*) n
                                                  from (select r.slips from public.robin_rounds r
                                                        where r.player = student and not r.open and r.slips is not null
                                                        order by r.finished_at desc limit 10) l,
                                                       lateral jsonb_array_elements_text(l.slips) s(kind)
                                                  where s.kind in ('over', 'under', 'double', 'skip', 'row', 'lots', 'same', 'again', 'one', 'near')
                                                  group by s.kind) c
                                            order by c.n desc, c.kind limit 1) t),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(give|howmany|counton|across):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.robin_progress h where h.player = student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pigeon_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.pigeon_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb)
to service_role;
revoke execute on function public.teacher_pigeon_student(uuid), public.teacher_parrot_student(uuid), public.teacher_robin_student(uuid)
from public, anon;
grant execute on function public.teacher_pigeon_student(uuid), public.teacher_parrot_student(uuid), public.teacher_robin_student(uuid) to authenticated;

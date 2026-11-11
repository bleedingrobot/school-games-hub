-- P7: save and show the usual slip for Lizard and Swamp Hen, as Pigeon does (20261110001000_newer_five_slips.sql).
--   * a nullable `slips jsonb` (an array of slip kinds, one per wrong first try) on lizard_rounds and swamphen_rounds, set at finish by
--     a second <game>_finish that also takes the slips, beside the old one (which stays for any caller that does not send slips);
--   * `slip` on teacher_lizard_student / teacher_swamphen_student: the commonest slip among the last ten finished challenges, only
--     when it shows at least three times and no other kind has the same count (the kit's topSlip rule, shared/kit/slips.ts);
--     otherwise null. Swamp Hen leaves out 'near', as its page always has.
-- Additive only: nothing is dropped, no row is changed, and rounds finished before this keep slips = null.

alter table public.lizard_rounds
  add column if not exists slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');
alter table public.swamphen_rounds
  add column if not exists slips jsonb check (slips is null or jsonb_typeof(slips) = 'array');

create function public.lizard_finish(
  player uuid, seed bigint, version integer, days_done integer, last_day date, step smallint, level smallint,
  good_in_row integer, good_at_step integer, kind_levels jsonb, taps jsonb, mistakes integer, first_right integer, slips jsonb
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
      slips = lizard_finish.slips, finished_at = now()
  where r.player = lizard_finish.player and r.seed = lizard_finish.seed;
  return true;
end;
$$;

create function public.swamphen_finish(
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
     or days_done is null or step is null or step not between 1 and 6 or level is null or level not between 0 and 5
     or good_in_row is null or good_in_row < 0 or good_at_step is null or good_at_step < 0
     or jsonb_typeof(kind_levels) is distinct from 'object'
     or (slips is not null and jsonb_typeof(slips) is distinct from 'array') then
    raise exception 'That challenge is not right.' using errcode = '22023';
  end if;
  perform 1 from public.swamphen_rounds r where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed and r.open for update;
  if not found then
    return false;
  end if;
  update public.swamphen_progress h
  set days_done = swamphen_finish.days_done, last_day = swamphen_finish.last_day, step = swamphen_finish.step,
      level = swamphen_finish.level, good_in_row = swamphen_finish.good_in_row, good_at_step = swamphen_finish.good_at_step,
      kind_levels = swamphen_finish.kind_levels,
      version = h.version + 1, updated_at = now()
  where h.player = swamphen_finish.player and h.version = swamphen_finish.version
    and swamphen_finish.days_done between h.days_done and h.days_done + 1;
  if not found then
    return false;
  end if;
  update public.swamphen_rounds r
  set open = false, taps = swamphen_finish.taps, mistakes = swamphen_finish.mistakes, first_right = swamphen_finish.first_right,
      slips = swamphen_finish.slips, finished_at = now()
  where r.player = swamphen_finish.player and r.seed = swamphen_finish.seed;
  return true;
end;
$$;

-- Teacher: a student's page, now with the usual slip (as 20261107001000_lizard.sql / 20261107001100_swamphen.sql, plus `slip`).
create or replace function public.teacher_lizard_student(student uuid)
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
                                                  from (select r.slips from public.lizard_rounds r
                                                        where r.player = student and not r.open and r.slips is not null
                                                        order by r.finished_at desc limit 10) l,
                                                       lateral jsonb_array_elements_text(l.slips) s(kind)
                                                  where s.kind in ('reverse', 'face', 'zero', 'ignore', 'ones', 'way', 'join', 'near')
                                                  group by s.kind) c
                                            order by c.n desc, c.kind limit 1) t),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.lizard_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.lizard_progress h where h.player = student);
end;
$$;

create or replace function public.teacher_swamphen_student(student uuid)
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
                                                  from (select r.slips from public.swamphen_rounds r
                                                        where r.player = student and not r.open and r.slips is not null
                                                        order by r.finished_at desc limit 10) l,
                                                       lateral jsonb_array_elements_text(l.slips) s(kind)
                                                  where s.kind in ('added', 'joined', 'short', 'spare', 'forgot', 'minus', 'rows', 'turned', 'unturned', 'scatter')
                                                  group by s.kind) c
                                            order by c.n desc, c.kind limit 1) t),
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^(rows|turn|share|cut|which):'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 5) f), '[]'::jsonb),
                                    'recent', coalesce((
                                      select jsonb_agg(jsonb_build_object('round', r.round, 'taps', r.taps) order by r.finished_at desc)
                                      from (select x.round, x.taps, x.finished_at from public.swamphen_rounds x
                                            where x.player = student and not x.open order by x.finished_at desc limit 3) r), '[]'::jsonb))
          from public.swamphen_progress h where h.player = student);
end;
$$;

revoke execute on function
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, jsonb, integer, integer, jsonb),
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb),
  public.teacher_lizard_student(uuid), public.teacher_swamphen_student(uuid)
from public, anon, authenticated;
grant execute on function
  public.lizard_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, jsonb, integer, integer, jsonb),
  public.swamphen_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb, jsonb)
to service_role;
grant execute on function public.teacher_lizard_student(uuid), public.teacher_swamphen_student(uuid) to authenticated;

-- Help me on every ladder question, stage H1 (docs/plans/help-me/PLAN.md). James, 26 Nov 2026: if a pupil opens Help me,
-- that answer doesn't tick anything off, and doesn't count against them either.
--
-- How: the question box tells the database when a pupil opens Help me (maths_help_opened, the pupil's own call). Every game
-- saves each marked answer straight away through record_fact_answers, so the pupil's next answer after opening help is the
-- helped one: record_fact_answers leaves it out of the records and writes it to maths_help_uses instead (for the teacher's
-- Progress tab, stage H9).
--   * maths_help_pending: at most one waiting "help was opened" per pupil.
--   * maths_help_uses: every helped answer (kept for the teacher view).
--   * record_fact_answers: same function and arguments, body copied from 20261112000700_fact_first_seen.sql, plus the
--     helped check at the top of the loop.
-- Nothing is dropped or deleted.

create table public.maths_help_pending (
  player uuid primary key references public.profiles (id) on delete cascade,
  opened_at timestamptz not null default now(),
  kind text not null default ''
);
alter table public.maths_help_pending enable row level security;
revoke all on public.maths_help_pending from anon, authenticated;

create table public.maths_help_uses (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  pack text not null,
  fact_key text not null,
  correct boolean not null,
  kind text not null default '',
  answered_at timestamptz not null
);
create index maths_help_uses_player on public.maths_help_uses (player, answered_at desc);
alter table public.maths_help_uses enable row level security;
revoke all on public.maths_help_uses from anon, authenticated;

-- The pupil opened Help me on the question showing now. `kind` is the help shown (e.g. 'tables', 'angles'), kept short.
create or replace function public.maths_help_opened(kind text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  insert into public.maths_help_pending as h (player, opened_at, kind)
  values (me, now(), left(coalesce(maths_help_opened.kind, ''), 30))
  on conflict (player) do update set opened_at = excluded.opened_at, kind = excluded.kind;
end;
$$;

-- The box closed with no answer after Help me was opened (a skip, time ran out): forget it, so the next question counts.
create or replace function public.maths_help_cancel()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.maths_help_pending h where h.player = auth.uid();
$$;

create or replace function public.record_fact_answers(
  player uuid,
  pack text,
  batch_id uuid,
  answers jsonb,
  quick_ms integer,
  fluent_days integer,
  top_box integer,
  min_ms integer default 0
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  f public.gem_keep_facts;
  answered timestamptz;
  day date;
  added integer := 0;
  help public.maths_help_pending;
begin
  perform public.gem_keep_check_player(player);
  insert into public.fact_answer_batches (player, batch_id) values (player, batch_id) on conflict do nothing;
  if not found then
    return 0;
  end if;
  select * into help from public.maths_help_pending h where h.player = record_fact_answers.player for update;
  for a in
    select e ->> 'key' as key, (e ->> 'correct')::boolean as correct, (e ->> 'ms')::integer as ms,
           (e ->> 'at')::bigint as at, e ->> 'given' as given
    from jsonb_array_elements(answers) with ordinality as x(e, n)
    order by x.n
  loop
    answered := to_timestamp(a.at / 1000.0);
    -- Help me (H1): the first answer saved after help was opened (within 10 minutes) is the helped one. It is kept apart
    -- and changes nothing in the records. Two seconds of slack for the server's clock against the database's.
    if help.player is not null and answered >= help.opened_at - interval '2 seconds'
       and answered < help.opened_at + interval '10 minutes' then
      insert into public.maths_help_uses (player, pack, fact_key, correct, kind, answered_at)
      values (player, pack, a.key, a.correct, help.kind, answered);
      delete from public.maths_help_pending h where h.player = record_fact_answers.player;
      help := null;
      continue;
    end if;
    day := (answered at time zone 'Pacific/Auckland')::date;
    select * into f from public.gem_keep_facts g
    where g.player = record_fact_answers.player and g.pack = record_fact_answers.pack and g.fact_key = a.key
    for update;
    if not found then
      f := row(player, pack, a.key, 0, 0, 0, 0, null, '{}', now(), '[]'::jsonb, now())::public.gem_keep_facts;
    end if;
    f.attempts := f.attempts + 1;
    f.correct := f.correct + case when a.correct then 1 else 0 end;
    f.avg_ms := round(f.avg_ms + (a.ms - f.avg_ms)::numeric / f.attempts);
    f.last_seen := answered;
    if not a.correct then
      f.box := 1;
      -- P10: remember what they said, the last three wrong answers (oldest first). An old client sends no `given`.
      if a.given is not null and a.given <> '' then
        f.wrong_recent := (select coalesce(jsonb_agg(v order by n), '[]'::jsonb) from (
          select v, n from jsonb_array_elements(f.wrong_recent || to_jsonb(left(a.given, 20))) with ordinality as w(v, n)
          order by n desc limit 3) last_wrong);
      end if;
    elsif a.ms >= min_ms and a.ms <= quick_ms then
      if not day = any (f.quick_days) then
        f.quick_days := (select coalesce(array_agg(d order by n), '{}') from (
          select d, n from unnest(f.quick_days || day) with ordinality as q(d, n)
          order by n desc limit fluent_days) last_days);
      end if;
      f.box := least(f.box + 1, case when cardinality(f.quick_days) >= fluent_days then top_box else top_box - 1 end);
    end if;
    insert into public.gem_keep_facts as g (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days, wrong_recent)
    values (player, pack, a.key, f.attempts, f.correct, f.avg_ms, f.box, f.last_seen, f.quick_days, f.wrong_recent)
    on conflict on constraint gem_keep_facts_pkey do update set
      attempts = excluded.attempts, correct = excluded.correct, avg_ms = excluded.avg_ms, box = excluded.box,
      last_seen = excluded.last_seen, quick_days = excluded.quick_days, wrong_recent = excluded.wrong_recent, updated_at = now();
    added := added + 1;
  end loop;
  return added;
end;
$$;

revoke execute on function public.maths_help_opened(text) from public, anon;
grant execute on function public.maths_help_opened(text) to authenticated;
revoke execute on function public.maths_help_cancel() from public, anon;
grant execute on function public.maths_help_cancel() to authenticated;
revoke execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer) to service_role;

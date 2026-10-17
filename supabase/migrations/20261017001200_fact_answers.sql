-- Mission Control maths, stage M.1: times-table records are built from each answer.
--
-- Until now Gem Keep saved a student's records as "my totals now" and the server kept
-- whichever copy had more answers. With two games adding answers (Gem Keep and, soon,
-- Wormholes & Black Holes), a copy loaded earlier in one game could miss answers given in
-- the other. So the games now send each answer (fact, right or wrong, how long, when) and
-- the server adds it to the record here, one answer at a time, in order.
--
-- The rules are the same as shared/maths/leitner.ts `afterAnswer` (the tests check both give
-- the same records). The numbers (what counts as quick, how many days make a fact fluent, the
-- top box) are passed in by the server function from shared/maths/config.ts, so they live in
-- one place.
--
-- Each batch of answers carries an id made by the browser, so a batch sent twice (a retry
-- after a Wi-Fi drop) is only counted once. Batch ids are forgotten after 30 days.

create table public.fact_answer_batches (
  player uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  received_at timestamptz not null default now(),
  primary key (player, batch_id)
);
create index fact_answer_batches_old on public.fact_answer_batches (received_at);
alter table public.fact_answer_batches enable row level security;
revoke all on public.fact_answer_batches from anon, authenticated;

-- `answers` = [{ key, correct, ms, at (ms since 1970) }], oldest first.
-- Returns how many answers were added (0 if this batch was seen before).
create function public.record_fact_answers(
  player uuid,
  pack text,
  batch_id uuid,
  answers jsonb,
  quick_ms integer,
  fluent_days integer,
  top_box integer
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
begin
  perform public.gem_keep_check_player(player);
  insert into public.fact_answer_batches (player, batch_id) values (player, batch_id) on conflict do nothing;
  if not found then
    return 0;
  end if;
  for a in
    select e ->> 'key' as key, (e ->> 'correct')::boolean as correct, (e ->> 'ms')::integer as ms,
           (e ->> 'at')::bigint as at
    from jsonb_array_elements(answers) with ordinality as x(e, n)
    order by x.n
  loop
    answered := to_timestamp(a.at / 1000.0);
    day := (answered at time zone 'Pacific/Auckland')::date;
    select * into f from public.gem_keep_facts g
    where g.player = record_fact_answers.player and g.pack = record_fact_answers.pack and g.fact_key = a.key
    for update;
    if not found then
      f := row(player, pack, a.key, 0, 0, 0, 0, null, '{}', now())::public.gem_keep_facts;
    end if;
    f.attempts := f.attempts + 1;
    f.correct := f.correct + case when a.correct then 1 else 0 end;
    f.avg_ms := round(f.avg_ms + (a.ms - f.avg_ms)::numeric / f.attempts);
    f.last_seen := answered;
    if not a.correct then
      f.box := 1;
    elsif a.ms <= quick_ms then
      if not day = any (f.quick_days) then
        f.quick_days := (select coalesce(array_agg(d order by n), '{}') from (
          select d, n from unnest(f.quick_days || day) with ordinality as q(d, n)
          order by n desc limit fluent_days) last_days);
      end if;
      f.box := least(f.box + 1, case when cardinality(f.quick_days) >= fluent_days then top_box else top_box - 1 end);
    end if;
    insert into public.gem_keep_facts as g (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days)
    values (player, pack, a.key, f.attempts, f.correct, f.avg_ms, f.box, f.last_seen, f.quick_days)
    on conflict on constraint gem_keep_facts_pkey do update set
      attempts = excluded.attempts, correct = excluded.correct, avg_ms = excluded.avg_ms, box = excluded.box,
      last_seen = excluded.last_seen, quick_days = excluded.quick_days, updated_at = now();
    added := added + 1;
  end loop;
  return added;
end;
$$;

-- Old batch ids, every night.
select cron.schedule('forget-fact-answer-batches', '17 3 * * *',
  $$delete from public.fact_answer_batches where received_at < now() - interval '30 days'$$);

revoke execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer) to service_role;

-- A new season clears these too (the records they counted are gone).
create or replace function public.teacher_new_season(confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_count integer;
  friend_count integer;
  space_count integer;
  card_count integer;
  gem_count integer;
begin
  perform public.require_teacher();
  if confirm is distinct from 'NEW SEASON' then
    raise exception 'Type NEW SEASON to start a new season.' using errcode = '22023';
  end if;
  delete from public.achievements where true;
  delete from public.scored_games where true;
  delete from public.ratings where true;
  delete from public.bot_games where true;
  get diagnostics bot_count = row_count;
  delete from public.mp_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics friend_count = row_count;
  -- A finished game a newer one points at (a rematch) goes too; the link just empties.
  delete from public.space_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics space_count = row_count;
  delete from public.card_games where status in ('finished', 'cancelled', 'expired');
  get diagnostics card_count = row_count;
  delete from public.gem_keep_runs where true;
  get diagnostics gem_count = row_count;
  delete from public.gem_keep_progress where true;
  delete from public.gem_keep_facts where true;
  delete from public.fact_answer_batches where true;
  return jsonb_build_object('botGames', bot_count, 'friendGames', friend_count + space_count + card_count,
    'gemKeepLevels', gem_count);
end;
$$;

-- A running total of maths questions answered (James, 5 Nov 2026: "keep a running total of questions answered").
--
-- Every maths answer a student gives ends up in one of two places:
--   - gem_keep_facts: the shared record every maths game adds to (attempts and correct go up by one per answer);
--   - training_answers: Basic facts training, one row per answer (older rows of a fact are trimmed later).
-- Both get cleared or trimmed (New Season, the Dragon/Clan/Monster resets, training keeps only the newest answers), so
-- neither can be counted later. So a trigger on each adds every new answer to answer_totals the moment it is saved,
-- and nothing ever clears that table: New Season and the game resets leave it alone.
--
-- answer_totals: one row per NZ day and source. Source is the kind of maths the games saved it under (the record's
-- pack, e.g. times-tables, add-sub, early-facts), or 'training' for Basic facts training. Students only (teachers
-- trying a game are left out). The day is null for the starting numbers below.
--
-- Starting numbers (5 Nov 2026): what the records still held when this went in, per source, on a row with no day.
-- That is a minimum (about 10,280 game answers and 10,490 training answers): some earlier answers were cleared by
-- season resets or trimmed. Training answers keep their day, so those starting rows are by day.
--
-- Reading: hub_answer_totals() for any signed-in school user: the whole school's total, today's, games vs training,
-- and by kind of maths. Whole-school counts only, never who.

create table public.answer_totals (
  day date,
  source text not null check (source ~ '^[a-z0-9-]{1,30}$'),
  answered bigint not null default 0 check (answered >= 0),
  correct bigint not null default 0 check (correct >= 0),
  updated_at timestamptz not null default now(),
  constraint answer_totals_day_source unique nulls not distinct (day, source)
);

alter table public.answer_totals enable row level security;
revoke all on public.answer_totals from anon, authenticated;

-- Adds answers to today's row (NZ day). Only for students.
create function public.answer_totals_add(who uuid, from_source text, n bigint, right_n bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if n <= 0 or not exists (select 1 from public.profiles p where p.id = who and p.role = 'student') then
    return;
  end if;
  insert into public.answer_totals as t (day, source, answered, correct)
  values ((now() at time zone 'Pacific/Auckland')::date, from_source, n, greatest(least(right_n, n), 0))
  on conflict on constraint answer_totals_day_source do update set
    answered = t.answered + excluded.answered, correct = t.correct + excluded.correct, updated_at = now();
end;
$$;
revoke execute on function public.answer_totals_add(uuid, text, bigint, bigint) from public, anon, authenticated;

-- The games' shared record: each answer is attempts + 1 (a new fact is a new row with attempts 1).
create function public.answer_totals_from_facts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.answer_totals_add(new.player, new.pack, new.attempts, new.correct);
  elsif new.attempts > old.attempts then
    perform public.answer_totals_add(new.player, new.pack, new.attempts - old.attempts, new.correct - old.correct);
  end if;
  return null;
end;
$$;
revoke execute on function public.answer_totals_from_facts() from public, anon, authenticated;

create trigger answer_totals_count
after insert or update of attempts on public.gem_keep_facts
for each row execute function public.answer_totals_from_facts();

-- Basic facts training: one row per answer.
create function public.answer_totals_from_training()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.answer_totals_add(new.player, 'training', 1, case when new.correct then 1 else 0 end);
  return null;
end;
$$;
revoke execute on function public.answer_totals_from_training() from public, anon, authenticated;

create trigger answer_totals_count
after insert on public.training_answers
for each row execute function public.answer_totals_from_training();

-- Starting numbers, in the same transaction as the triggers, so nothing is missed or counted twice.
insert into public.answer_totals (day, source, answered, correct)
select null, g.pack, sum(g.attempts), sum(g.correct)
from public.gem_keep_facts g
join public.profiles p on p.id = g.player and p.role = 'student'
where g.pack ~ '^[a-z0-9-]{1,30}$'
group by g.pack
having sum(g.attempts) > 0;

insert into public.answer_totals (day, source, answered, correct)
select t.day, 'training', count(*), count(*) filter (where t.correct)
from public.training_answers t
join public.profiles p on p.id = t.player and p.role = 'student'
group by t.day;

-- The whole school's running total. Any signed-in school user (whole-school counts only).
create function public.hub_answer_totals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  perform public.require_school_user();
  return (
    select jsonb_build_object(
      'total', coalesce(sum(t.answered), 0),
      'correct', coalesce(sum(t.correct), 0),
      'today', coalesce(sum(t.answered) filter (where t.day = today), 0),
      'games', coalesce(sum(t.answered) filter (where t.source <> 'training'), 0),
      'training', coalesce(sum(t.answered) filter (where t.source = 'training'), 0),
      'bySource', coalesce((
        select jsonb_object_agg(s.source, s.n order by s.n desc)
        from (select x.source, sum(x.answered) as n from public.answer_totals x group by x.source) s
      ), '{}'::jsonb)
    )
    from public.answer_totals t
  );
end;
$$;
revoke execute on function public.hub_answer_totals() from public, anon;
grant execute on function public.hub_answer_totals() to authenticated;

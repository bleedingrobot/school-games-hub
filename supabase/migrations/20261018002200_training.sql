-- Basic facts training, stage T.2: training answers are saved to the database.
--
-- Training is a practice area, separate from the games (James, 18 Oct 2026). It has its own
-- tables, so the games never read or change a training record and training never reads or
-- changes a game's. It does not touch fact_answers, gem_keep_facts or the maths focus records.
--
-- 1. training_answers: one row per answer (fact, what was typed, right or wrong, how long the
--    answer took, how long that student takes to type that many digits, the day, when). The
--    app works out colours, known days and review dates from these with shared/training/records.ts,
--    so the speed bands stay in shared/training/config.ts and nothing about them is in here.
-- 2. training_students: one row per student for their typing check times, the auto-submit
--    setting and how many sessions they have done.
-- 3. training_answer_batches: every batch of answers carries an id made by the browser, so a
--    batch sent twice (a retry after a Wi-Fi drop) is only counted once (the same idea as
--    fact_answer_batches). Batch ids are forgotten after 30 days.
-- 4. Saving, for the server only: record_training_answers() and record_training_student().
--    The training server function checks each answer against the real facts first.
-- 5. Reading: my_training() for a student's own, teacher_training_student() for a teacher.
--    Nobody reads the tables directly. (The hub has no classes yet, so, like the other
--    teacher screens, a teacher can read any student; classes come with the maths focus plan.)
--
-- A new season does NOT clear training: it is learning data, not a competition. The numbers
-- (answers kept per fact, answers per day) are passed in by the server function from
-- shared/training/config.ts.

create table public.training_answers (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  -- The seed of the session the answer was given in (shared/training/session.ts rebuilds it).
  seed integer not null,
  fact_key text not null check (fact_key ~ '^[a-z0-9]{1,12}:[0-9a-z/+-]{1,20}$'),
  given integer not null check (given between 0 and 999999),
  correct boolean not null,
  -- Measured on the student's device: from the question being shown to the answer going in.
  answer_ms integer not null check (answer_ms between 0 and 600000),
  -- How long this student takes to type an answer that long (the typing check), used for this answer.
  typing_ms integer not null check (typing_ms between 0 and 10000),
  day date not null,
  answered_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index training_answers_by_fact on public.training_answers (player, fact_key, answered_at desc, id desc);
create index training_answers_by_day on public.training_answers (player, created_at);

create table public.training_students (
  player uuid primary key references public.profiles (id) on delete cascade,
  -- Typing check times in ms by answer length: { "1": [..], "2": [..], "3": [..] }, oldest first.
  typing jsonb not null default '{}' check (jsonb_typeof(typing) = 'object' and length(typing::text) <= 600),
  auto_submit boolean not null default true,
  sessions_done integer not null default 0 check (sessions_done between 0 and 100000),
  updated_at timestamptz not null default now()
);

create table public.training_answer_batches (
  player uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  received_at timestamptz not null default now(),
  primary key (player, batch_id)
);
create index training_answer_batches_old on public.training_answer_batches (received_at);

alter table public.training_answers enable row level security;
alter table public.training_students enable row level security;
alter table public.training_answer_batches enable row level security;
revoke all on public.training_answers, public.training_students, public.training_answer_batches
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the server function only)
-- ---------------------------------------------------------------------------

-- `answers` = [{ key, given, correct, ms, typingMs, day ("YYYY-MM-DD" on the student's device),
-- at (ms since 1970) }], oldest first. Returns how many answers were added (0 if this batch was
-- seen before). Only the newest `keep_per_fact` answers of each fact are kept. Past
-- `daily_limit` answers in a day the student is asked to take a break (54000).
create function public.record_training_answers(
  player uuid,
  batch_id uuid,
  seed integer,
  answers jsonb,
  keep_per_fact integer,
  daily_limit integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
  answered timestamptz;
  a record;
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(answers) is distinct from 'array' or jsonb_array_length(answers) > 100 then
    raise exception 'Those answers could not be read.' using errcode = '22023';
  end if;
  insert into public.training_answer_batches (player, batch_id) values (player, batch_id) on conflict do nothing;
  if not found then
    return 0;
  end if;
  if (select count(*) from public.training_answers t
      where t.player = record_training_answers.player and t.created_at > now() - interval '1 day')
      + jsonb_array_length(answers) > daily_limit then
    raise exception 'That''s a lot of practice today! Have a break and come back tomorrow.' using errcode = '54000';
  end if;
  for a in
    select e ->> 'key' as key, (e ->> 'given')::integer as given, (e ->> 'correct')::boolean as correct,
           (e ->> 'ms')::integer as ms, (e ->> 'typingMs')::integer as typing_ms, (e ->> 'day')::date as day,
           (e ->> 'at')::bigint as at
    from jsonb_array_elements(answers) with ordinality as x(e, n)
    order by x.n
  loop
    answered := to_timestamp(a.at / 1000.0);
    -- The device's day may differ from the New Zealand day by one at most (different time zone).
    if answered > now() + interval '10 minutes' or answered < now() - interval '30 days'
       or abs(a.day - (answered at time zone 'Pacific/Auckland')::date) > 1 then
      raise exception 'That answer could not be saved.' using errcode = '22023';
    end if;
    insert into public.training_answers (player, batch_id, seed, fact_key, given, correct, answer_ms, typing_ms, day, answered_at)
    values (player, batch_id, seed, a.key, a.given, a.correct, a.ms, a.typing_ms, a.day, answered);
  end loop;
  added := jsonb_array_length(answers);
  -- Keep only the newest answers of each fact that was just answered.
  delete from public.training_answers t
  using (
    select r.id from (
      select x.id, row_number() over (partition by x.fact_key order by x.answered_at desc, x.id desc) as place
      from public.training_answers x
      where x.player = record_training_answers.player
        and x.fact_key in (select distinct e ->> 'key' from jsonb_array_elements(answers) as e)
    ) r where r.place > keep_per_fact
  ) old
  where t.id = old.id;
  return added;
end;
$$;

-- A student's typing check times and settings. The sessions count only ever goes up, so an
-- older device can't wind it back.
create function public.record_training_student(
  player uuid,
  typing jsonb,
  auto_submit boolean,
  sessions_done integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  insert into public.training_students as s (player, typing, auto_submit, sessions_done)
  values (player, typing, auto_submit, sessions_done)
  on conflict on constraint training_students_pkey do update set
    typing = excluded.typing,
    auto_submit = excluded.auto_submit,
    sessions_done = greatest(s.sessions_done, excluded.sessions_done),
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- One student's saved answers (oldest first) and settings, for the page and the teacher.
create function public.training_data(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'answers', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', a.fact_key, 'correct', a.correct, 'ms', a.answer_ms, 'typingMs', a.typing_ms,
        'day', to_char(a.day, 'YYYY-MM-DD'), 'at', (extract(epoch from a.answered_at) * 1000)::bigint)
        order by a.answered_at, a.id), '[]')
      from public.training_answers a where a.player = who),
    'student', (select jsonb_build_object('typing', s.typing, 'autoSubmit', s.auto_submit, 'sessionsDone', s.sessions_done)
      from public.training_students s where s.player = who)
  )
$$;

-- A student's own training. Nothing for anyone who isn't signed in with a school account.
create function public.my_training()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.training_data(auth.uid()) where public.is_school_user()
$$;

-- A teacher reading one student's training.
create function public.teacher_training_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return public.training_data(student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Old batch ids, every night
-- ---------------------------------------------------------------------------

select cron.schedule('forget-training-answer-batches', '23 3 * * *',
  $$delete from public.training_answer_batches where received_at < now() - interval '30 days'$$);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.record_training_answers(uuid, uuid, integer, jsonb, integer, integer),
  public.record_training_student(uuid, jsonb, boolean, integer),
  public.training_data(uuid), public.my_training(), public.teacher_training_student(uuid)
from public, anon, authenticated;
grant execute on function public.my_training(), public.teacher_training_student(uuid) to authenticated;
grant execute on function
  public.record_training_answers(uuid, uuid, integer, jsonb, integer, integer),
  public.record_training_student(uuid, jsonb, boolean, integer)
to service_role;

-- Training before games (James, 22 Oct 2026): a student in a class with the switch on does one Training session, of their
-- choice, before the games open, and the games stay open for 6 hours after it. See "Training before games" in
-- docs/TRAINING-PLAN.md.
--
-- What counts (James): a whole facts session ("Today's session") or a whole Quick looks round (all 12 pictures). Stopping
-- early with "Finish for now" does not. Teachers are never locked. The lock is on the website only: no game's server
-- function reads any of this, and a game already open carries on.
--
-- 1. training_sessions: when each session was finished. One row per student, kind and session seed.
-- 2. record_training_session(): for the training server function only. It checks the student really answered that session
--    (enough answers with its seed, near the time it says it finished) before it counts.
-- 3. app_settings.training_first, per class, OFF to start; teacher_set_training_first().
-- 4. my_training_lock(): whether the lock applies to the person asking, and when they last finished a session. The website
--    works out the rest with shared/training/gate.ts, so the 6 hours are in shared/training/config.ts, not here.
--
-- Nothing else is changed. A New Season does not touch these rows (training is learning, not a competition).

create table public.training_sessions (
  player uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('facts', 'quick')),
  seed integer not null,
  answers integer not null check (answers between 0 and 1000),
  finished_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (player, kind, seed)
);
create index training_sessions_latest on public.training_sessions (player, finished_at desc);

alter table public.training_sessions enable row level security;
revoke all on public.training_sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the server function only)
-- ---------------------------------------------------------------------------

-- `at` is when the device says the session finished (ms since 1970). It can't be in the future, and a session sent more than
-- 12 hours late is refused (it couldn't open the games any more anyway). `min_answers` comes from shared/training/config.ts:
-- a facts session that ran out of time can be very short, a Quick looks round is always 12 pictures. The answers must have
-- been saved first (the website sends them ahead of this, in the same request). A session sent twice keeps the later time.
-- Returns the time it counts from.
create function public.record_training_session(
  player uuid,
  kind text,
  seed integer,
  at bigint,
  min_answers integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished timestamptz;
  answered integer;
  saved timestamptz;
begin
  perform public.gem_keep_check_player(player);
  if kind is null or kind not in ('facts', 'quick') or seed is null or at is null or min_answers is null or min_answers < 1 then
    raise exception 'That session could not be read.' using errcode = '22023';
  end if;
  finished := least(to_timestamp(at / 1000.0), now());
  if to_timestamp(at / 1000.0) > now() + interval '10 minutes' or finished < now() - interval '12 hours' then
    raise exception 'That session could not be saved.' using errcode = '22023';
  end if;
  -- The session's own answers: Quick looks keys start with sub: or gap: (subh:/gaph: when helped), facts keys don't. A session lasts minutes, so its answers are
  -- from the hour before it finished.
  select count(*) into answered
  from public.training_answers a
  where a.player = record_training_session.player
    and a.seed = record_training_session.seed
    and (a.fact_key ~ '^(sub|gap)h?:') = (record_training_session.kind = 'quick')
    and a.answered_at between finished - interval '1 hour' and finished + interval '5 minutes';
  if answered < min_answers then
    raise exception 'That session wasn''t finished.' using errcode = '22023';
  end if;
  insert into public.training_sessions as s (player, kind, seed, answers, finished_at)
  values (player, kind, seed, answered, finished)
  on conflict on constraint training_sessions_pkey do update set
    answers = greatest(s.answers, excluded.answers),
    finished_at = greatest(s.finished_at, excluded.finished_at)
  returning s.finished_at into saved;
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------

alter table public.app_settings add column training_first boolean not null default false;

create function public.teacher_set_training_first(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Training before games setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set training_first = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- For the person asking: `on` = their class has the switch on and they are not a teacher; `lastFinishedAt` = when they last
-- finished a session (null if never). Nothing for anyone who isn't signed in with a school account.
create function public.my_training_lock()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'on', coalesce((select s.training_first from public.settings_of(auth.uid()) s), false) and not public.is_teacher(),
    'lastFinishedAt', (select (extract(epoch from max(t.finished_at)) * 1000)::bigint
                       from public.training_sessions t where t.player = auth.uid()))
  where public.is_school_user()
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.record_training_session(uuid, text, integer, bigint, integer),
  public.teacher_set_training_first(boolean, uuid),
  public.my_training_lock()
from public, anon, authenticated;
grant execute on function public.teacher_set_training_first(boolean, uuid), public.my_training_lock() to authenticated;
grant execute on function public.record_training_session(uuid, text, integer, bigint, integer) to service_role;

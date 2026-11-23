-- Class Live stage 3 (docs/CLASSLIVE-PLAN.md): Mystery Mural. Pupils answer their own maths questions (way A, like
-- Class Showdown) to earn tile flips. The questions are kept here, hidden from pupils, and marked on the server; a
-- right answer is claimed once in the same transaction as the room's save.
--   classlive_questions: each pupil's kept questions for a room (no pupil or teacher may read them).
--   classlive_open_question / classlive_load_question / classlive_keep_question: the server's question store.
--   classlive_save: now takes a claim (marks the question answered, or returns 'answered' and changes nothing).

create table public.classlive_questions (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  slot integer not null check (slot >= 0),
  question jsonb not null check (jsonb_typeof(question) = 'object'),
  answered boolean not null default false,
  value numeric,
  right_answer boolean,
  made_at timestamptz not null default now(),
  primary key (room, player, slot)
);
create index classlive_questions_by_time on public.classlive_questions (made_at);
alter table public.classlive_questions enable row level security;
revoke all on public.classlive_questions from anon, authenticated;

-- The pupil's newest question not yet answered, or null.
create function public.classlive_open_question(target bigint, player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slot', q.slot, 'question', q.question, 'answered', q.answered)
  from public.classlive_questions q
  where q.room = target and q.player = classlive_open_question.player and not q.answered
  order by q.slot desc limit 1
$$;

create function public.classlive_load_question(target bigint, player uuid, slot integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slot', q.slot, 'question', q.question, 'answered', q.answered)
  from public.classlive_questions q
  where q.room = target and q.player = classlive_load_question.player and q.slot = classlive_load_question.slot
$$;

-- Keeps a new question at the pupil's next slot, unless one is still open: then that one comes back (two asks at once
-- from a re-joining iPad give the same question). Questions over a day old are cleared on the pupil's first ask.
create function public.classlive_keep_question(target bigint, player uuid, question jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_one jsonb;
  next_slot integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('classlive:' || target || ':' || player, 0));
  open_one := public.classlive_open_question(target, player);
  if open_one is not null then
    return open_one;
  end if;
  select coalesce(max(q.slot) + 1, 0) into next_slot from public.classlive_questions q
  where q.room = target and q.player = classlive_keep_question.player;
  if next_slot = 0 then
    delete from public.classlive_questions q where q.made_at < now() - interval '1 day';
  end if;
  insert into public.classlive_questions (room, player, slot, question)
  values (target, player, next_slot, question);
  return jsonb_build_object('slot', next_slot, 'question', question, 'answered', false);
end;
$$;

-- The save, now with a claim. The old one (no claim) goes, so there is one save to call.
drop function public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb);

-- One step's save: lands only if the room is still at `seen_version` ('stale' otherwise, and nothing changes); a claimed
-- answer is marked in the same transaction ('answered' if it already was, and nothing changes).
create function public.classlive_save(target bigint, seen_version integer, session jsonb, view jsonb, screen jsonb,
  started_ms bigint, players jsonb, claim jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_version integer;
begin
  select r.version into now_version from public.classlive_rooms r where r.id = target for update;
  if now_version is null then
    raise exception 'No such room' using errcode = '22023';
  end if;
  if now_version <> seen_version then
    return 'stale';
  end if;
  if claim is not null then
    update public.classlive_questions q
    set answered = true, value = (claim ->> 'value')::numeric, right_answer = (claim ->> 'right')::boolean
    where q.room = target and q.player = (claim ->> 'player')::uuid and q.slot = (claim ->> 'slot')::integer and not q.answered;
    if not found then
      return 'answered';
    end if;
  end if;
  update public.classlive_rooms r
  set version = r.version + 1, state = session ->> 'state', view = classlive_save.view,
      started_ms = classlive_save.started_ms, updated_at = now()
  where r.id = target;
  update public.classlive_state s set session = classlive_save.session where s.room = target;
  update public.classlive_screens sc set screen = classlive_save.screen, seq = coalesce((classlive_save.screen ->> 'seq')::integer, sc.seq),
    updated_at = now()
  where sc.room = target;
  insert into public.classlive_players as p (room, player, view, updated_at)
  select target, (v ->> 'player')::uuid, v, now() from jsonb_array_elements(coalesce(players, '[]'::jsonb)) v
  on conflict (room, player) do update set view = excluded.view, updated_at = now();
  return 'ok';
end;
$$;

revoke execute on function
  public.classlive_open_question(bigint, uuid), public.classlive_load_question(bigint, uuid, integer),
  public.classlive_keep_question(bigint, uuid, jsonb), public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  public.classlive_open_question(bigint, uuid), public.classlive_load_question(bigint, uuid, integer),
  public.classlive_keep_question(bigint, uuid, jsonb), public.classlive_save(bigint, integer, jsonb, jsonb, jsonb, bigint, jsonb, jsonb)
to service_role;

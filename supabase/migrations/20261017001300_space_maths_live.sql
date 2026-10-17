-- Mission Control maths, stage M.4: maths in Wormholes & Black Holes games with classmates.
--
-- The server picks and marks every question, so a student can't claim a right answer:
-- 1. space_game_questions: the question the server asked a student (the answer is in it, so
--    students can't read this table at all: only the space-game server function does).
-- 2. space_maths_context(): a student's times-table records and the teacher's question
--    settings, for the server to pick the next question from.
-- The answers themselves go into the times-table records through record_fact_answers() (stage M.1).

create table public.space_game_questions (
  game uuid not null references public.space_games (id) on delete cascade,
  seat integer not null check (seat between 0 and 3),
  -- 'moment': the wormhole or black hole question the game is waiting on.
  -- 'charge': the question after a turn, answered while the others play.
  kind text not null check (kind in ('moment', 'charge')),
  -- moment: the game version it was asked at. charge: the turns the student had finished.
  stamp integer not null,
  question jsonb not null,
  asked_at timestamptz not null default now(),
  -- A charge question counts once: once answered, no other one is given for the same turn.
  answered boolean not null default false,
  primary key (game, seat, kind)
);
alter table public.space_game_questions enable row level security;
revoke all on public.space_game_questions from anon, authenticated;

create function public.space_maths_context(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f where f.player = space_maths_context.player and f.pack = 'times-tables'),
    'settings', public.gem_keep_settings())
$$;

revoke execute on function public.space_maths_context(uuid) from public, anon, authenticated;
grant execute on function public.space_maths_context(uuid) to service_role;

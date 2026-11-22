-- Circuit Racer, Stage 3: the maths (docs/CIRCUIT-PLAN.md, section 7; way A of docs/game-guide/4-maths.md).
--
-- 1. app_settings.circuit_maths ('off' | 'choose' | 'on'), on for every class to start (James, 22 Nov 2026: recharge ports
--    and data gates), and teacher_set_circuit_maths(mode, target_class) for the teacher's Games table.
-- 2. circuit_questions: the questions the server made for one go (one per recharge port and data gate), which pupils can
--    never read (no policy, no grant), and the answers marked so far. Rows over 2 days old go.
--    circuit_store_questions(), circuit_load_questions() and circuit_claim_answer() are for the server function only.
-- The game stays hidden behind its code switch (src/games/circuit/switch.ts) until Stage 6.

alter table public.app_settings add column circuit_maths text not null default 'on'
  check (circuit_maths in ('off', 'choose', 'on'));

create function public.teacher_set_circuit_maths(mode text, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if mode is null or mode not in ('off', 'choose', 'on') then
    raise exception 'Unknown maths setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings s set circuit_maths = teacher_set_circuit_maths.mode
  where s.id in (select public.settings_to_change(target_class));
end;
$$;

-- The questions made for one go, with its answers. `answered` holds the answers marked so far,
-- { "<slot>": { "value": n, "right": true } }; a slot is marked once.
create table public.circuit_questions (
  player uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (length(seed) between 10 and 80),
  questions jsonb not null,
  answered jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (player, seed)
);
create index circuit_questions_by_age on public.circuit_questions (created_at);
alter table public.circuit_questions enable row level security;
revoke all on public.circuit_questions from anon, authenticated;

-- Keeps a go's questions. Lists older than two days are thrown away as new ones come in.
create function public.circuit_store_questions(player uuid, seed text, questions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gem_keep_check_player(player);
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) not between 1 and 40 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.circuit_questions q where q.created_at < now() - interval '2 days';
  insert into public.circuit_questions (player, seed, questions)
  values (player, seed, questions)
  on conflict do nothing;
end;
$$;

-- { questions, answered } for a go that had maths, else null (a go without maths has no row).
create function public.circuit_load_questions(player uuid, seed text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('questions', q.questions, 'answered', q.answered)
  from public.circuit_questions q where q.player = circuit_load_questions.player and q.seed = circuit_load_questions.seed
$$;

-- Marks a slot as answered, once. False if it was answered already (so an answer sent twice counts once).
create function public.circuit_claim_answer(player uuid, seed text, slot integer, value numeric, right_answer boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.circuit_questions q
  set answered = q.answered || jsonb_build_object(slot::text, jsonb_build_object('value', value, 'right', right_answer))
  where q.player = circuit_claim_answer.player and q.seed = circuit_claim_answer.seed and not (q.answered ? slot::text);
  return found;
end;
$$;

revoke execute on function
  public.teacher_set_circuit_maths(text, uuid),
  public.circuit_store_questions(uuid, text, jsonb),
  public.circuit_load_questions(uuid, text),
  public.circuit_claim_answer(uuid, text, integer, numeric, boolean)
from public, anon, authenticated;
grant execute on function public.teacher_set_circuit_maths(text, uuid) to authenticated;
grant execute on function
  public.circuit_store_questions(uuid, text, jsonb),
  public.circuit_load_questions(uuid, text),
  public.circuit_claim_answer(uuid, text, integer, numeric, boolean)
to service_role;

-- Class Live: connection numbers for the Cloudflare pilot's before-and-after (docs/plans/classlive-edge/PLAN.md). Nothing
-- is deleted. One row per device per game: how long its spot calls took, how many failed, how often fresh spots came.
-- No answers, scores or names. Only the classlive server function writes it (its own key); nobody else can read it.

create table public.classlive_netstats (
  room bigint not null references public.classlive_rooms (id) on delete cascade,
  player uuid not null references public.profiles (id) on delete cascade,
  part text not null check (part in ('pad', 'screen')),
  version text not null check (version in ('db', 'edge')),
  stats jsonb not null check (pg_column_size(stats) < 2000),
  at timestamptz not null default now(),
  primary key (room, player, part)
);
alter table public.classlive_netstats enable row level security;
revoke all on public.classlive_netstats from public, anon, authenticated;

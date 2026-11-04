-- Maths Monsters: a per-account battles-a-day override, so James can test without the 12-a-day rest.
-- Pupils keep 12. The game reads the number through my_monsters() / my_moves_left(), which call
-- monster_battle_rules() as the signed-in player. Saves (record_monster_save, run by the server key)
-- still use 12 for points, so test battles past 12 earn no points.

create table public.monster_battle_overrides (
  player uuid primary key references public.profiles (id) on delete cascade,
  battles_per_day integer not null check (battles_per_day between 1 and 2000)
);
alter table public.monster_battle_overrides enable row level security;
revoke all on public.monster_battle_overrides from public, anon, authenticated;

-- Same name, now with an optional player (the signed-in one by default). Callers pass nothing, so they are unchanged.
drop function public.monster_battle_rules();

create function public.monster_battle_rules(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('battlesPerDay', coalesce(
    (select o.battles_per_day from public.monster_battle_overrides o
     where o.player = coalesce(monster_battle_rules.player, auth.uid())),
    12))
$$;

revoke all on function public.monster_battle_rules(uuid) from public, anon, authenticated;
grant execute on function public.monster_battle_rules(uuid) to service_role;

-- James's teacher account (jamesriley@douglaspark.school.nz).
insert into public.monster_battle_overrides (player, battles_per_day)
select id, 2000 from public.profiles where id = 'e5dfc120-92de-4a09-a3fa-acc400dd4990'
on conflict (player) do update set battles_per_day = excluded.battles_per_day;

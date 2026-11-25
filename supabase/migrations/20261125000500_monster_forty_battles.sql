-- Maths Monsters: 40 battles a day instead of 20 (James, 25 Nov 2026).
--
-- Only the default changes. A pupil's own number in monster_battle_overrides still wins, and the
-- teacher's "unlimited today" is untouched. create or replace keeps the existing grants (server key only).
-- Keep BATTLES_PER_DAY in shared/monsters/world/battleCap.ts the same.
create or replace function public.monster_battle_rules(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('battlesPerDay', coalesce(
    (select o.battles_per_day from public.monster_battle_overrides o
     where o.player = coalesce(monster_battle_rules.player, auth.uid())),
    40),
    'unlimitedToday', public.unlimited_today(monster_battle_rules.player, 'monsters'))
$$;

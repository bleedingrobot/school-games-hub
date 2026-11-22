-- Goblin Storm: my_goblinstorm() also says whether runs are unlimited today for this pupil ('unlimited'), read through
-- settings_of, so a pupil's own Bonus Turns Day counts as well as the class's "Unlimited today" switch. The game screen
-- read only the class row, so a bonus day showed "come back tomorrow" though the server would have let the run start.

create or replace function public.my_goblinstorm()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'gold', coalesce(s.gold, 0), 'shop', coalesce(s.shop, '{}'::jsonb), 'heroes', to_jsonb(coalesce(s.heroes, '{}')),
    'bosses', to_jsonb(coalesce(s.bosses, '{}')), 'codex', to_jsonb(coalesce(s.codex, '{}')),
    'weapons', to_jsonb(coalesce(s.weapons, '{}')),
    'runs', coalesce(s.runs, 0), 'kills', coalesce(s.kills, 0), 'guideSeen', coalesce(s.guide_seen, false),
    'bestGold', coalesce((select max(r.gold) from public.goblinstorm_runs r where r.player = me.player), 0),
    'today', (select count(*)::integer from public.goblinstorm_runs r
              where r.player = auth.uid() and r.day = (now() at time zone 'Pacific/Auckland')::date),
    'unlimited', public.unlimited_today(me.player, 'goblinstorm'))
  from (select auth.uid() as player) me
  left join public.goblinstorm_saves s on s.player = me.player
  where me.player is not null
$$;

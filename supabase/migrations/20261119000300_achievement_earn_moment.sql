-- The achievement earn moment (docs/ACHIEVEMENTS-PLAN.md, stage 3; James, 19 Nov 2026).
--
-- 1. achievements.seen_at: when the pupil was shown it. Everything earned before today counts as seen, so nobody is
--    flooded on day one.
-- 2. my_new_achievements(): my achievements not shown yet, newest first (at most 50), with name, emoji, how, tier and
--    game. Games switched off for my class are left out (the same rules as my_progress), and stay unseen until they're on.
--    Read by a game's result screen straight after a save (AchievementPop) and by the hub pages (NewAchievementMoment).
-- 3. mark_my_achievements_seen(ids): marks those of mine as shown (all of mine when ids is null). Returns how many.
--
-- Trophies keep their own flag and moment (20261112002100_trophy_cabinet.sql); this is achievements only.

alter table public.achievements add column seen_at timestamptz;
comment on column public.achievements.seen_at is
  'When the pupil was shown this achievement (the earn moment). Null = not shown yet. Only set by mark_my_achievements_seen.';

update public.achievements set seen_at = earned_at where seen_at is null;

create index achievements_unseen on public.achievements (player) where seen_at is null;

create function public.my_new_achievements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  sw as materialized (select s.monsters_enabled, s.lord_enabled, s.clans_enabled from public.settings_of(auth.uid()) s),
  off as materialized (select public.hub_games_off() as games)
  select coalesce(jsonb_agg(x.j order by x.earned_at desc, x.sort), '[]'::jsonb)
  from (
    select jsonb_build_object('id', at.id, 'game', at.game, 'name', at.name, 'emoji', at.emoji, 'how', at.how,
             'tier', at.tier, 'earnedAt', a.earned_at) as j, a.earned_at, at.sort
    from me
    join public.achievements a on a.player = me.id and a.seen_at is null
    join public.achievement_types at on at.id = a.achievement
    where (at.game <> 'monsters' or (select sw.monsters_enabled from sw))
      and (at.game <> 'dragon-maths' or (select sw.lord_enabled from sw))
      and (at.game <> 'clan-quest' or (select sw.clans_enabled from sw))
      and at.game <> all ((select off.games from off)::text[])
    order by a.earned_at desc, at.sort
    limit 50
  ) x
$$;

create function public.mark_my_achievements_seen(ids text[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked integer;
begin
  perform public.require_school_user();
  update public.achievements a set seen_at = now()
  where a.player = auth.uid() and a.seen_at is null and (ids is null or a.achievement = any (ids));
  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke execute on function public.my_new_achievements(), public.mark_my_achievements_seen(text[]) from public, anon, authenticated;
grant execute on function public.my_new_achievements(), public.mark_my_achievements_seen(text[]) to authenticated;

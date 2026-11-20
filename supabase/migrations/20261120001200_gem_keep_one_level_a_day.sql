-- Gem Keep: one new level a day, and a 5-question Level Key (James, 20 Nov 2026).
--
-- 1. record_gem_keep_key(): a Level Key can't be passed if the player already passed another one today (New Zealand day):
--    it answers 'not-today'. The Level Key is now 5 questions, and the class's pass mark is still set out of 10 (5 to 10),
--    so it is halved and rounded up: 8 out of 10 needs 4 of 5 (shared/gem-keep/config.ts keyRightNeeded).
-- 2. my_gem_keep(): each level's progress says the New Zealand day its Level Key was passed (keyPassedOn), so the game can
--    say "come back tomorrow" before the student tries.
--
-- Both are the live functions as they were (checked 20 Nov 2026) with only those changes.

-- 1. Saving a Level Key
create or replace function public.record_gem_keep_key(player uuid, level_id text, right_answers integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.gem_keep_progress;
begin
  perform public.gem_keep_check_player(player);
  select * into was from public.gem_keep_progress g
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id
  for update;
  if not found or was.wins = 0 then
    return 'no-win';
  end if;
  if was.key_passed then
    return 'already';
  end if;
  -- Half the pass mark out of 10, rounded up (right_answers is out of 5).
  if right_answers * 2 < (select s.gem_keep_key_pass from public.settings_of(record_gem_keep_key.player) s) then
    return 'not-passed';
  end if;
  -- One new level a day.
  if exists (
    select 1 from public.gem_keep_progress g
    where g.player = record_gem_keep_key.player and g.key_passed
      and (g.key_passed_at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date
  ) then
    return 'not-today';
  end if;
  update public.gem_keep_progress g set key_passed = true, key_passed_at = now(), updated_at = now()
  where g.player = record_gem_keep_key.player and g.level_id = record_gem_keep_key.level_id;
  perform public.award_achievements(player, 'gem-keep', now());
  return 'passed';
end;
$$;

-- 2. Everything Gem Keep needs when it opens, now with the day each Level Key was passed.
create or replace function public.my_gem_keep()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'progress', (select coalesce(jsonb_agg(jsonb_build_object(
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed,
        'keyPassedOn', to_char(g.key_passed_at at time zone 'Pacific/Auckland', 'YYYY-MM-DD')) order by g.level_id), '[]')
      from public.gem_keep_progress g where g.player = me.id),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f
      where f.player = me.id and f.pack in ('times-tables', 'early-facts', 'add-sub', 'division', 'generated')),
    'settings', public.gem_keep_settings(),
    'focus', public.maths_focus_of(me.id),
    'canImport', not exists (select 1 from public.gem_keep_imports i where i.player = me.id)
      and not exists (select 1 from public.gem_keep_progress g where g.player = me.id)
  )
  from me
$$;

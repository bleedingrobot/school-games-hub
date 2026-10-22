-- Maths focus F.5: the generated skills (bonds to 100 and 1000, rounding, times with tens and hundreds, factor pairs, squares
-- and cubes, order of operations) keep a record for each QUESTION TYPE instead of each fact, for example "round:100:3digit",
-- "bond100:fives" or "bedmas:brackets-first" (docs/MATHS-FOCUS-PLAN.md section 3 and "Stage F.5 results").
--
-- They are stored in the same table as every other record (gem_keep_facts) under the pack name "generated". The key check that
-- F.3 widened ('^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$') already accepts every one of these keys, and the pack check
-- ('^[a-z0-9-]{1,30}$') accepts the pack name, so no table changes. Nothing is stored by this file.
--
-- What does change: Gem Keep and Mission Control are handed the student's records when a game opens, and they only get the
-- packs on a list. The new pack has to be on that list, or a student's generated records would never come back and auto
-- would ask the same first question types forever. The two functions below are the same as F.3's apart from that one name.

-- Everything Gem Keep needs when it opens.
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
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed) order by g.level_id), '[]')
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

-- Mission Control maths: the player's own records (all five packs), settings and focus.
create or replace function public.space_maths_context(player uuid)
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
      from public.gem_keep_facts f
      where f.player = space_maths_context.player and f.pack in ('times-tables', 'early-facts', 'add-sub', 'division', 'generated')),
    'settings', public.gem_keep_settings(player),
    'focus', public.maths_focus_of(player))
$$;

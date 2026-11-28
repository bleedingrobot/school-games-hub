-- Smash Quest (id bonkers) stage B.2, part 1: achievements and a trophy (docs/BONKERS-PLAN.md).
-- James, 28 Nov 2026: "leader board and trophies and achievements etc all done? ... yes please, push right on".
-- The achievements count on the school Leaderboard by themselves, and Smash Quest's own board on 🎮 Game boards ranks
-- them (docs/LEADERBOARD-PLAN.md). None measures maths: fights won, quests done and the hero's level.
--   1. Counts      bonkers_counts gains bonkers_quests (quests done).
--   2. Achievements 7, kept through New Season (hub_games.keep_achievements is already true).
--   3. Trophy      the Smash Quest Trophy in steps: level 4 (bronze), 7 (silver), 10 (gold), given by a trigger on
--                  bonkers_progress, so the server function's save doesn't change. A trophy that fails never stops a save.

-- ---------------------------------------------------------------------------
-- 1. Counts
-- ---------------------------------------------------------------------------

create or replace function public.bonkers_counts(who uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'bonkers_fights', coalesce((select (b.progress -> 'stats' ->> 'fightsWon')::int from public.bonkers_progress b where b.player = who), 0),
    'bonkers_level', coalesce((select (b.progress ->> 'level')::int from public.bonkers_progress b where b.player = who), 0),
    'bonkers_quests', coalesce((select (b.progress -> 'stats' ->> 'quests')::int from public.bonkers_progress b where b.player = who), 0))
$$;

insert into public.achievement_measures (measure) values ('bonkers_quests');

-- ---------------------------------------------------------------------------
-- 2. Achievements
-- ---------------------------------------------------------------------------

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('bonkers-first-smash', 'bonkers', 'First Smash', '💥', 'bonkers_fights', 1, 1, 'Win your first fight in Smash Quest.', 1),
  ('bonkers-trainer-tamer', 'bonkers', 'Trainer Tamer', '🏋️', 'bonkers_level', 2, 2, 'Beat your first trainer in Smash Quest.', 1),
  ('bonkers-smasher', 'bonkers', 'Smasher: 25 fights', '🥊', 'bonkers_fights', 25, 3, 'Win 25 fights in Smash Quest.', 2),
  ('bonkers-quest-keeper', 'bonkers', 'Quest Keeper: 10 quests', '📜', 'bonkers_quests', 10, 4, 'Finish 10 quests in Smash Quest.', 2),
  ('bonkers-halfway-hero', 'bonkers', 'Halfway Hero: level 5', '🦸', 'bonkers_level', 5, 5, 'Get your Smash Quest hero to level 5.', 2),
  ('bonkers-smash-boss', 'bonkers', 'Smash Boss: 100 fights', '👊', 'bonkers_fights', 100, 6, 'Win 100 fights in Smash Quest.', 3),
  ('bonkers-legend', 'bonkers', 'Smash Legend: level 10', '🏆', 'bonkers_level', 10, 7, 'Get your Smash Quest hero all the way to level 10.', 3);

-- ---------------------------------------------------------------------------
-- 3. Trophy
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('bonkers-hero', 'bonkers', 'Smash Quest Trophy', 'Get your Smash Quest hero to level 4, 7 or 10.', 'trophy', 'steps', null, 360);

-- What a pupil's hero has earned. Safe to call again: award_trophy adds nothing twice. Server only.
create function public.bonkers_rewards(who uuid, progress jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  level integer := coalesce((progress ->> 'level')::int, 1);
  step integer;
begin
  for step in 1..3 loop
    if level >= (array[4, 7, 10])[step] then
      perform public.award_trophy(who, 'bonkers-hero', jsonb_build_object('step', step));
    end if;
  end loop;
end;
$$;

create function public.bonkers_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.bonkers_rewards(new.player, new.progress);
  exception when others then
    raise warning 'bonkers rewards for %: %', new.player, sqlerrm;
  end;
  return null;
end;
$$;

create trigger bonkers_rewards_after_save
after insert or update of progress on public.bonkers_progress
for each row execute function public.bonkers_after_save();

revoke execute on function public.bonkers_rewards(uuid, jsonb), public.bonkers_after_save() from public, anon, authenticated;

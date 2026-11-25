-- Diamond Drop Monster Dig (docs/DIAMOND-MONSTERS-PLAN.md): an open level can be a cavern (levels 11 to 20) and can
-- carry the Monster Lure and Monster Net. The first Diamond migration only allowed levels 1 to 10 and the first four
-- boosts, so every cavern start failed ("The mine couldn't be reached just now"). Loosens two checks; no data changes.

alter table public.diamond_levels drop constraint if exists diamond_levels_level_check;
alter table public.diamond_levels add constraint diamond_levels_level_check check (level between 1 and 20);

alter table public.diamond_levels drop constraint if exists diamond_levels_boosts_check;
alter table public.diamond_levels add constraint diamond_levels_boosts_check
  check (boosts <@ array['strongWinch', 'luckyCharm', 'extraTime', 'rockBlaster', 'monsterLure', 'monsterNet']);

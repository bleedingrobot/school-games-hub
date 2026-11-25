-- Class Live: Shark Bay (docs/SHARK-PLAN.md). Nothing is deleted; only rows are added (docs/CLASSLIVE-PLAN.md section 5
-- "Adding an activity"). Shark Bay runs on Four Corners' engine, so pupils save their spots through classlive_move.
--   1. The 'shark' activity (moves, same top speed as Four Corners: 0.3 x 1.6 x 1.25).
--   2. Trophies from PupilReward.extra: shark_safe, shark_boats, shark_wins, shark_escapes.

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('shark', 'Shark Bay', true, 0.6, 'Finish on the Shark Bay podium: 2 more points.', 14);

insert into public.achievement_measures (measure)
values ('classlive_shark_safe'), ('classlive_shark_boats'), ('classlive_shark_wins'), ('classlive_shark_escapes');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-shark-dodger', 'classlive', 'Shark Dodger', '🦈', 'classlive_shark_safe', 20, 40, 'Stay safe from Chomper in 20 Shark Bay rounds.', 1),
  ('classlive-boat-hider', 'classlive', 'Boat Hider', '🚣', 'classlive_shark_boats', 5, 41, 'Hide under a boat when Chomper strikes, 5 times.', 1),
  ('classlive-bay-champion', 'classlive', 'Bay Champion', '🏆', 'classlive_shark_wins', 1, 42, 'Finish top of the Shark Bay podium.', 2),
  ('classlive-cave-escape', 'classlive', 'Cave Escape', '🌊', 'classlive_shark_escapes', 5, 43, "Answer your way out of the Shark's Cave 5 times.", 1);

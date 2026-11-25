-- Class Live: Floor is Lava (docs/LAVA-PLAN.md). Nothing is deleted; only rows are added (docs/CLASSLIVE-PLAN.md
-- section 5 "Adding an activity").
--
--   1. The 'lava' activity: pupils move (spots saved through classlive_move), clamped to MAX_SPEED in
--      shared/classlive/lava.ts (0.3 × 1.6 × 1.25 = 0.6 board units a second).
--   2. Four trophies, counted from each player's `extra` in classlive_finish: lava_rounds (rounds stayed up), lava_wins
--      (top of the podium), lava_built (tiles rebuilt with bricks), lava_rescues (friends pulled off the raft).

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('lava', 'Floor is Lava', true, 0.6, 'Finish on the Floor is Lava podium: 2 more points.', 5);

insert into public.achievement_measures (measure)
values ('classlive_lava_rounds'), ('classlive_lava_wins'), ('classlive_lava_built'), ('classlive_lava_rescues');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-lava-survivor', 'classlive', 'Lava Survivor', '🌋', 'classlive_lava_rounds', 25, 20, 'Stay up for 25 Floor is Lava rounds.', 1),
  ('classlive-lava-champion', 'classlive', 'Lava Champion', '🏆', 'classlive_lava_wins', 1, 21, 'Finish top of the Floor is Lava podium.', 2),
  ('classlive-bridge-builder', 'classlive', 'Bridge Builder', '🧱', 'classlive_lava_built', 20, 22, 'Rebuild 20 Floor is Lava tiles with bricks.', 1),
  ('classlive-lava-lifeguard', 'classlive', 'Lava Lifeguard', '🛟', 'classlive_lava_rescues', 5, 23, 'Pull 5 friends off the Floor is Lava raft.', 2);

-- Class Live: Maths Mingle (docs/MINGLE-PLAN.md). Nothing is deleted; only rows are added
-- (docs/CLASSLIVE-PLAN.md section 5 "Adding an activity").
--
--   1. The 'mingle' activity: music plays and the class mingles for real; when it stops the big screen calls a group
--      size as a sum ("groups of 24 ÷ 6"). Pupils left over answer their way back in at shared station iPads (the same
--      station rules as Real-life Four Corners). Nobody moves an avatar (moves = false).
--   2. One trophy, counted from each player's `extra` in classlive_finish: mingle_backs (times back in the game).

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('mingle', 'Maths Mingle', false, 0.6, null, 18);

insert into public.achievement_measures (measure) values ('classlive_mingle_backs');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-mingle-backs', 'classlive', 'Back in the Groove', '🕺', 'classlive_mingle_backs', 10, 48, 'Answer your way back into Maths Mingle 10 times after being left out of a group.', 1);

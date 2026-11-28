-- Class Live: Stand Up If (docs/STAND-PLAN.md). Nothing is deleted; only rows are added
-- (docs/CLASSLIVE-PLAN.md section 5 "Adding an activity").
--
--   1. The 'stand' activity: a real-life game for a class set of iPads. The big screen shows a sign ("Stand up if your
--      answer > your number"); each pupil answers their own question on their iPad, taps Stand or Sit, then everyone
--      shows it for real on "3, 2, 1". Nobody moves an avatar (moves = false).
--   2. Two trophies, counted from each player's `extra` in classlive_finish: stand_spots (rounds right) and
--      stand_streaks (games with 5 or more right in a row).

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('stand', 'Stand Up If', false, 0.6, null, 20);

insert into public.achievement_measures (measure) values ('classlive_stand_spots'), ('classlive_stand_streaks');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-stand-spots', 'classlive', 'Sign Spotter', '🐊', 'classlive_stand_spots', 25, 63, 'Get 25 rounds of Stand Up If right: the right answer, then Stand or Sit to match the sign.', 1),
  ('classlive-stand-streaks', 'classlive', 'Stand Tall', '🧍', 'classlive_stand_streaks', 1, 64, 'Get 5 rounds of Stand Up If right in a row.', 1);

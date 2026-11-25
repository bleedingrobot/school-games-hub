-- Class Live: Musical Thrones (docs/THRONES-PLAN.md). Only inserts (migration 20261125000800_classlive_activities):
-- the activity (pupils move an avatar, saved through classlive_move at Four Corners' top speed) and 4 trophies counted
-- from classlive_stats.extra (thrones_sat, thrones_crowns, thrones_steals, thrones_wins). Nothing is deleted.

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort)
values ('thrones', 'Musical Thrones', true, 0.6, 'Finish on the Musical Thrones podium: 2 more points.', 5);

insert into public.achievement_measures (measure)
values ('classlive_thrones_sat'), ('classlive_thrones_crowns'), ('classlive_thrones_steals'), ('classlive_thrones_wins');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-throne-sitter', 'classlive', 'Throne Sitter', '🪑', 'classlive_thrones_sat', 20, 20, 'Grab a throne in 20 Musical Thrones rounds.', 1),
  ('classlive-crown-hoard', 'classlive', 'Crown Hoard', '👑', 'classlive_thrones_crowns', 50, 21, 'Collect 50 crowns in Musical Thrones.', 2),
  ('classlive-throne-thief', 'classlive', 'Throne Thief', '🗡️', 'classlive_thrones_steals', 5, 22, 'Steal 5 thrones with a Crown thief.', 2),
  ('classlive-royal-champion', 'classlive', 'Royal Champion', '🏆', 'classlive_thrones_wins', 1, 23, 'Finish top of the Musical Thrones podium.', 2);

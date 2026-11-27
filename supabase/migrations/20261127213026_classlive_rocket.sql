-- Class Live: Rocket Relay (docs/ROCKET-PLAN.md). Nothing is deleted; only rows are added
-- (docs/CLASSLIVE-PLAN.md section 5 "Adding an activity").
--
--   1. The 'rocket' activity: a real running relay. The site makes teams from the class list; each team's iPad sits at
--      the far end, the runner taps "I'm here" and answers, and every right answer boosts the team's rocket on the big
--      screen. First to the Moon wins. Nobody moves an avatar (moves = false).
--   2. Two trophies, counted from each player's `extra` in classlive_finish: rocket_runs and rocket_wins.

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('rocket', 'Rocket Relay', false, 0.6, null, 19);

insert into public.achievement_measures (measure) values ('classlive_rocket_runs'), ('classlive_rocket_wins');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-rocket-runs', 'classlive', 'Relay Runner', '🏃', 'classlive_rocket_runs', 10, 49, 'Run 10 legs of Rocket Relay.', 1),
  ('classlive-rocket-wins', 'classlive', 'Moon Landing', '🚀', 'classlive_rocket_wins', 3, 50, 'Be on the team that reaches the Moon first in Rocket Relay 3 times.', 1);

-- Class Live: Toon Flap Relay (docs/RELAY-PLAN.md). Nothing is deleted; only rows are added (docs/CLASSLIVE-PLAN.md
-- section 5 "Adding an activity").
--
--   1. The 'relay' activity: pupils don't move an avatar (the flyer's flaps go through the classlive function and are
--      replayed there), so moves = false.
--   2. Three trophies, counted from each player's `extra` in classlive_finish: relay_wins (races won with your team),
--      relay_perks (perks given to your flyer), relay_troubles (troubles sent).

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('relay', 'Toon Flap Relay', false, 0.6, 'Win a Toon Flap Relay race with your team: 2 more points.', 16);

insert into public.achievement_measures (measure)
values ('classlive_relay_wins'), ('classlive_relay_perks'), ('classlive_relay_troubles');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-relay-champ', 'classlive', 'Relay Champ', '🏁', 'classlive_relay_wins', 10, 44, 'Win 10 Toon Flap Relay races with your team.', 2),
  ('classlive-team-player', 'classlive', 'Team Player', '🤝', 'classlive_relay_perks', 30, 45, 'Give your Toon Flap Relay flyers 30 perks.', 1),
  ('classlive-trouble-maker', 'classlive', 'Trouble Maker', '🌪️', 'classlive_relay_troubles', 30, 46, 'Send 30 Toon Flap Relay troubles to other teams.', 1);

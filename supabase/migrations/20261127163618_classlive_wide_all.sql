-- Class Live: every joystick map game gets Ghost Tag's widescreen board (27 Nov 2026 NZ: James asked for the other
-- Class Live games to take up as much of the screen as Ghost Tag). Nothing is deleted.
--
-- classlive_activities.width (20261126172600) is how wide a board is, in board heights; classlive_move() already
-- clamps x to it. New games of these activities are 1.6 wide (Floor is Lava 1.625: 13 x 8 tiles); a game started
-- before the change keeps its own `w` (missing = square) in the client and server rules, so only the database's
-- upper bound loosens for it.

update public.classlive_activities set width = 1.6 where id in ('corners', 'shark', 'clash', 'thrones', 'crew');
update public.classlive_activities set width = 1.625 where id = 'lava';

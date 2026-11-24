# Four Corners (Class Live activity `corners`)

**Status: plan written 25 Nov 2026 NZ. Stage 1 (rules, server, database) under way.** Migration `20261125000300_classlive_corners` (check again: `node scripts/migration-numbers.mjs`).

James's idea (25 Nov 2026 NZ): every pupil runs their own hub avatar around a square map with a joystick. A countdown gives them time to reach one of four corners; then a big dramatic dice roll picks a corner. Pupils in that corner (and anyone in no corner) go to jail: they miss the next round and answer 3 maths questions to get back. Power-ups lie on the map; map hazards change round by round.

It is the fourth Class Live activity (docs/CLASSLIVE-PLAN.md): same room, lobby codes, timers, teacher bar, music, Bella, rewards. Read that plan's section 5 for the server pattern.

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Moving | Live joystick on iPads, arrow keys / WASD on laptops |
| Kids in no corner at the end | Caught, off to jail |
| Jail | Miss the next round; 3 right answers to come back at the start of a round |
| End | The Class Live timer (2 to 15 min, or the teacher ends it); most safe rounds wins |
| Power-ups | Picked up on the map, then switched on by answering a maths question once you reach a corner |
| Extras | All of Claude's extra power-ups and map mechanics, unlocked a few at a time |
| Map | A new map each game: snowy village, jungle temple, haunted castle, space station |
| Avatars | The pupil's own hub avatar, first name under it (if names are on) |
| Dice | Big tumbling 3D dice, drumroll, Bella calls the corner |

## Rules (shared/classlive/corners.ts)

- Board is a unit square; corner zones are the four 0.26 squares in the corners. Pupils start in the middle.
- A round: **run** (countdown, 14 s shrinking to 9 s), **roll** (4.5 s dice), **show** (4.5 s: caught pupils fly to jail, shields pop). The corner is decided on the server when the round is made (hidden from pupils until the dice lands); positions are read when the run ends.
- Score: +1 a safe round (+2 with Double star). Most safe rounds wins; ties share the podium.
- Jail: caught in round n, sit out round n+1, back at the start of n+2 if 3 right answers by then, else the round after the 3rd right answer. Jail questions come every 1.5 s at most.
- Power-ups (carry one at a time, grab by running over it; switched on by a right answer while standing in a corner):
  - Shield: not caught this round. Speed boost: 1.6× speed for this round and the next 2. Jail key: frees the jailed pupil closest to getting out. Crystal ball: your pad shows one safe corner this round. Jump: tap a corner to hop there once this round. Double star: 2 points if safe this round. Ghost: walk through hazards this round and next.
- Map mechanics, unlocked by round: 2 power-ups, 3 blizzard (0.45× speed), 4 teleport pair, 5 ice (you slide), 6 fog (big screen hides avatars for the last part of the run, pads show only you), 7 rolling snowball (bumps you aside), 8 cracked ice (the middle is a hole, go round), 9 corner gate (one corner shuts 3 s before the end), 10 twist rolls (two corners, or a lucky roll where nobody is caught). From round 11 a mix of 2 to 4 of them.
- Each map renames them: snow (blizzard, ice, snowball, cracked ice), jungle (sandstorm, mud slide, rolling boulder, quicksand), castle (ghost mist, slippery moss, rolling barrel, collapsed floor), space (meteor storm, zero-g slide, rolling asteroid, black hole).

## Movement and what counts (server checks)

iPads in a class must not each hit the edge function several times a second (Realtime and function limits, docs/CLASSLIVE-PLAN.md). So:

- The pupil's device moves its avatar at once (60 fps) and sends its position about every 0.4 s to a plain database function `classlive_move(room, x, y)` (no edge function). It clamps each move to the fastest speed possible since the last one (teleports allowed), keeps it on the board, and answers with every pupil's spot (no names) so pads can draw the others.
- The projector reads `classlive_positions(room)` (its teacher only) every 0.3 s and glides avatars between updates.
- When a run ends, the server step (`view` from the projector at each deadline, or any pupil's `look` once a deadline is 1.5 s late) reads the saved positions and decides who is caught. Grabs check the saved position too. Hazards (slowing, sliding, walls) are only drawn and simulated on the device; the server's speed clamp is the guard.

## Maths

Way A from the pupil's focus (`makeQuestion`, the same as Mystery Mural), in the shared question pop-up (ready to type, 1 to 4 keys). Questions are kept and marked on the server (`classlive_questions`, claim once), recorded with `recordAnswers`.

## Rewards

1 point for joining, 3 if they were safe at least once or answered right, +2 for a podium place, at most 10. Stats: safe rounds, wins, escapes, power-ups used. Trophies: Corner Dash (first safe round... 10 safe rounds), Last One Standing (top of the podium), Great Escape (escape jail 5 times), Power Player (switch on 10 power-ups).

## Stages

1. Rules, server steps, migration, tests, pretend pupils that run about.
2. Big screen scene and pupil pad (joystick, question pop-up, dice), How to play, picker card, sounds, music tracks, Bella lines, drawn stand-in art, art plan.
3. Painted art from James's PC (docs/CORNERS-ART-PLAN.md, docs/corners-art/config.json).

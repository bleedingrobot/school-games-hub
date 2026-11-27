# Colour Clash (Class Live activity `clash`)

**Status: stages 1 and 2 (rules, server, database, big screen, pad, Bella) in PR #834, 25 Nov 2026 NZ; painted art and map music next (docs/CLASH-ART-PLAN.md).** Migration `20261125001200_classlive_clash` (numbers agreed with the other Class Live game threads: Lava 1000, Thrones 1100, Clash 1200, Ghost Tag 1300, Shark Bay 1400).

James's idea (25 Nov 2026 NZ, from the coordinator's list): kids run over tiles to paint them their team's colour; answering questions bombs an area; the biggest colour wins. Built on Four Corners (docs/CORNERS-PLAN.md): same room, joystick, hub avatars, lobby codes, timers, music, Bella, rewards.

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Teams | The teacher picks 2, 3 or 4 on the card (default 4); pupils join the smallest team |
| Length | Short rounds with a big count-up reveal; board wiped each round; most round wins takes the game |
| Bombs | A right answer splats a circle of your colour where you stand; a streak makes it bigger |
| Answering | You stand still while a question is open (pad rule) |

## Rules (shared/classlive/clash.ts)

- Board: 24 rows; new games are `CLASH_W` (1.6) wide, so 38 columns (idx = row × columns + col; see "Wide map"). Games without `w` stay 24 × 24 square. Teams 1 Red, 2 Blue, 3 Green, 4 Yellow; each starts on its own side, and every round puts everyone back there.
- Round: ready 3.5 s, paint 45/60/90 s (teacher's pick, default 60), count 7 s (reveal). Golden tiles count 3. Ties share the round. Game: most round wins, then most tiles. A timed game ends after the round that is on when time is up.
- Bomb radius (tiles): 2.2, 2.9 on a streak of 3, 3.6 on 5, Mega Bomb 5.5. One question every 1.5 s at most; only while painting.
- Power-ups (grab by running over, one at a time; a held power switches on with your next right answer, with the bomb): Big Brush (trail 3 wide, 10 s), Speed Shoes (10 s), Mega Bomb, Rainbow Cross (paints your row and column).
- Map mechanics by round: 2 power-ups, 3 golden tiles, 4 portals, 5 goo (slow), 6 slippy paint, 7 rollers, 8 fountain (middle wall, its tiles don't count), then mixes. Movement reuses Four Corners' `stepMove`.
- Maps: Paint Park, Graffiti Rooftops, Splash Beach, Space Paint Lab (MAP_WORDS).

## Wide map (27 Nov 2026 NZ)

James asked for the maps to fill the screen, as Ghost Tag does. New games are `CLASH_W` (1.6) wide and 1 high (`w` on the game and its rounds, `w` on `ClashPublic`; older games without it stay square). The paint grid covers the whole wide board: more columns, the same 24 rows, so tiles stay square (`colsOf(w)` = round(24 w) = 38 columns, 912 tiles, tile width `tileW(w)`), and painted percentages count the bigger grid. Everything that places or clamps takes the width: tileOf, tileCentre, lineTiles, bombTiles, crossTiles, inFountain (the fountain is at x = w/2), blankTiles, scoreTiles, openSpot, teleports, startSpot, golden patches, items, the pretend pupils and Clash's own `stepMove` (Four Corners' clamps to 1; the Clash copy clamps to w). A wider board gets about 1.6x the goo and slippy patches, golden patches and power-ups; still two rollers, the x one rolls the full width (`Roller.span`, period x w, same speed). The database follows in migration 20261127164215 (tile idx up to 1151, `classlive_clash_paint` and `classlive_clash_count` read `w` from the game); moves clamp to `classlive_activities.width` (20261127163618). Paintings: map-<map>-wide (docs/clash-art/config.json), the square one cropped until a wide one exists. Big screen: slimmer side panel; iPad landscape: board edge to edge with the bomb and joystick over its bottom corners.

## What counts (server checks)

- Painting is in the database: pads save their spot through `classlive_clash_paint(room, x, y, since)` about every 0.4 s. It moves them with `classlive_move` (speed clamp) and paints the line from their last saved spot in their team's colour, only inside the round's paint window (`game.zeroMs` + `round.paintFrom..paintTo`), 3 wide while `mine.brushTo`. Long jumps (portals, round starts) paint only the landing tile. It answers the spots and the tiles changed since `since`.
- Bombs: the server function marks the answer (claimed once), then `classlive_clash_bomb`. Round end: `classlive_clash_count` gives the board and tiles painted per pupil.
- The projector reads `classlive_clash_board(room, since)` (teachers only) and `classlive_positions`.
- Memory copy for tests and preview: shared/classlive/clashMemory.ts (also the pretend pupils).

## Rewards

1 point for joining, 3 if they painted or answered right, +2 if their team won (podium bonus), at most 10. `extra`: clash_tiles, clash_bombs, clash_wins, clash_games. Trophies: Paint Splasher (1000 tiles), Bomb Squad (25 bombs), Colour Champion (win 1), Rainbow Legend (win 5).

## Stages

1. Rules, server steps, migration, tests, pretend pupils.
2. Big screen (painted board, avatars, bombs, count-up reveal, standings), pupil pad (joystick, bomb button and question pop-up, own team colour), picker card (teams, paint time, map), How to play, sounds, Bella lines, drawn stand-in art, art plan; switch on.
3. Painted art and map music from James's PC (docs/CLASH-ART-PLAN.md, docs/clash-art/config.json).

## Files

`shared/classlive/clash.ts` (rules), `clashServer.ts` (steps, hooks called from server.ts), `clashMemory.ts` (memory database, pretend pupils), `clash.test.ts`, `supabase/tests/database/classlive_clash.test.sql`.

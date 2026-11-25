# Ghost Tag (Class Live activity `ghost`)

**Status: LIVE 25 Nov 2026 NZ (PR #836); painted art (36 pictures) and 8 map tracks (ghost-<map>[-hot]) added in the follow-up PR.** Weaker pictures to repaint if wanted: mansion fireplace and ship wheel sit at the top edge, pumpkin centre has a scarecrow, crow/seagull flocks on a light blob, faint snowflake on power-freeze. Migration `20261125001300_classlive_ghost` (number agreed with the other map-game threads: Lava 1000, Thrones 1100, Colour Clash 1200, Ghost Tag 1300, Shark Bay 1400).

James's idea (25 Nov 2026 NZ, from the coordinator's list after Four Corners): every pupil runs their own hub avatar around a spooky map. A few start as ghosts; anyone a ghost touches becomes a ghost too. A right answer gives a short spell of invisibility. The last one standing wins. Built on Four Corners (docs/CORNERS-PLAN.md): same room, joystick, saved spots, lobby codes, timers, music, Bella, rewards.

## Choices (question cards 25 Nov 2026 NZ; James said "Continue", so Claude's recommended picks)

| Question | Answer |
|---|---|
| Ghosts at the start of a round | 1 for every 10 pupils (`ghostCount`), at least 1, never everyone |
| Shape | Rounds until the Class Live timer ends; a round ends with the last one standing, or the survivors when its 90 s run out |
| Invisibility | 5 seconds after a right answer (`HIDE_MS`) |
| Ghosts' maths | A right answer gives a speed dash, then a lantern (in turn) that finds invisible pupils near it |
| Extras | Unlocked round by round, like Four Corners |

## Rules (shared/classlive/ghost.ts)

- Board is a unit square. The crypt (`CRYPT`) is in the middle: starting ghosts wait there for `READY_MS` (4 s) while pupils, placed round the edge, run.
- Tags: the server checks saved spots (`advance` → `tags`): a ghost within `TAG_R` (0.07, a little more than two touching avatars) of a pupil catches them. The closest ghost gets the catch. A new ghost rises for `RISE_MS` before it can catch. Frozen ghosts can't catch.
- Invisible pupils (`hideTo`) can only be caught by a ghost with its lantern lit. The big screen hides invisible pupils; ghosts' devices don't get their spots (`classlive_ghost_move`).
- Round end: `humans >= 2` at the start and at most 1 left → `last` (that pupil wins, or `all` if the last ones were caught together); a round that started with 1 pupil ends when they're caught; the round's time → `time` (every survivor wins). Winners get a crown. Then `SHOW_MS` (6.5 s) and a new round; starters are those who started fewest times.
- When the session's time is up, a round that is on ends at once (`last` flag) and the game is over after its show.
- Score: crowns (rounds won), then catches. Podium shares ties.
- Maths: way A from the pupil's focus, kept and marked on the server (`ghostServer.ts`), recorded with `recordAnswers`. One question at a time, 1.5 s after the last answer; not while invisible or frozen.
- Mechanics (`UNLOCK`): stones from round 1 (pupils bump, ghosts float through); power-ups 2 (garlic shield bounces one catch, speed boots, frost bomb freezes ghosts within 0.25 for 2.5 s; used at once, pupils only); teleports 3; sticky patches 4 (pupils only, half speed); fog 5 (the big screen hides pupils from 12 s into the hunt); bats 6 (a swarm crosses the map and knocks pupils flying). From round 7 a mix of 2 to 4.
- Map words (`MAP_WORDS`): Moonlit Graveyard, Haunted Mansion, Pumpkin Patch, Ghost Ship.

## Movement and lag (iPads check in about every 2 s)

- Devices move their avatar at once and save the spot through `classlive_ghost_move` every 0.4 s (0.25 s with someone of the other side within 0.25). It calls the shared `classlive_move` (clamped to `max_speed` 0.6) and answers every other spot with its kind (pupil, ghost, frozen ghost, lantern-lit invisible pupil), no names or ids, plus whether the caller is a ghost now (so a caught pupil's device turns at once, before its own row arrives).
- The big screen reads `classlive_positions` every 0.3 s and asks the server (`view`) every 0.5 s during a hunt, which runs the tag check. If the big screen is gone, a pupil's `look` moves the game on at each deadline (+1.5 s), as Four Corners.
- The 2 s `look` only carries the room; catches don't wait for it.

## Rewards

As Four Corners: 1 point for joining, 3 for a right answer, a crown or a catch, +2 for a podium place, at most 10. Trophies (PupilReward.extra → classlive_stats.extra): Ghost Hunter (20 catches), Last Light (win 5 rounds), Vanishing Act (25 vanishes).

## Stages

1. Rules, server steps, migration, pretend pupils, test (`shared/classlive/ghost.test.ts`).
2. Big screen (`GhostScene.tsx`), device (`GhostPad.tsx`), board (`GhostBoard.tsx`), setup card / lobby / How to play / help page (`GhostCard.tsx`), `ghost.css`, Bella lines (`ghostLines.ts`, clips in public/voice/classlive), sound kit `ghost`, music `ghost-<map>[-hot]` (falls back to the boss tracks).
3. Paintings (docs/ghost-art/config.json, 36 pictures: 4 maps, 4 backdrops, picker card, 7 effects and power-ups, 20 map pieces) and 8 tracks, made on James's PC.

## Files

`shared/classlive/ghost.ts` (rules), `ghostServer.ts` (pupil steps), `ghostBot.ts` (memory `classlive_ghost_move` and pretend pupils), hooks in `server.ts` (`mutate`, `newSession`, join, look, routing), `rewards.ts`. Try it: `npx vite --config vite.classlive-preview.config.ts` (Ghost Tag card; "Be a pupil" to run with the arrow keys, Space for a question).

# Musical Thrones (Class Live activity `thrones`)

**Status: game LIVE on drawn stand-ins (25 Nov 2026 NZ); painted art and 8 music tracks coming from James's PC (branch thrones-art-inbox).** Migration `20261125001100_classlive_thrones` (only inserts, on the base `20261125000800_classlive_activities`).

James's idea (25 Nov 2026 NZ, from the coordinator's list of map games after Four Corners): musical chairs with thrones. Fewer thrones than players; when the music stops, kids race to sit; those left standing answer questions to earn their way back. A Class Live activity like Four Corners (docs/CORNERS-PLAN.md): same room, lobby codes, timers, teacher bar, music, Bella, rewards, movement.

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Thrones each round | Fewer every round (about 90% of players in round 1, 7% fewer each round, down to 35%) |
| Kids left standing | Both: answer 3 to come back, and 3 right in a row also earns a Crown thief scroll to steal a throne |
| Winning | Crowns collected: 1 a throne, 3 a golden throne, +1 a dance tile, a steal takes 1 from the sitter |
| While the music plays | Free roam plus dance floor: lit tiles give a bonus crown if you're on one when the music stops |
| Rooms | Four royal halls, a new one each game: Castle Hall, Ice Palace, Jungle Temple, Pirate Ship |
| Tests | Class Live budget 18: 2 per new map game (scripts/test-budget.test.ts) |

## Rules (shared/classlive/thrones.ts)

- A round: **music** (round 1 9 s, then 7 to 15 s at random; the stop time is decided when the round is made; pupils' devices know it but never show it), **scramble** (4 s: sit on a throne by running onto it), **show** (4.5 s: crowns paid, those standing go to the courtyard). Then everyone stands up and is put back in the middle. **No thrones show while the music plays**: when it stops they appear at random spots, apart from each other and at least 0.16 of the hall from every pupil where there is room (`scatterThrones`), so nobody can wait on one (James, 25 Nov 2026 NZ).
- `thronesFor(n, playing, before)`: round(playing × max(0.35, 0.9 − 0.07(n − 1))), never more than last round's minus 1 (at least 2), always fewer than those playing (at least 1).
- Sitting: the pad sends `play {sit}` when the avatar is within `SIT_R` of a free throne; the server checks the saved spot (`SIT_R + SIT_SLACK`), first come first served (compare-and-swap saves). A seated pupil's device locks.
- Courtyard: standing in round n, sit out round n+1, back at the start of n+2 with 3 right answers (as Four Corners' jail). 3 right in a row there: a Crown thief scroll (held power).
- Power-ups lie on the floor from round 2; carry one; a right answer while the music plays switches it on: Crown thief (sit on a taken throne to knock its sitter off and take a crown), Royal shield (can't be stolen from), Speed boots (3 rounds), Golden ear (pad buzzes 2 s before the stop), Double crown, Royal seat (put on the nearest free throne when the music stops), Ghost (through hazards, 2 rounds).
- Hazards unlock as Four Corners' (items 2, storm 3, teleport 4, ice 5, roller 6, then a mix), moved by Four Corners' `stepMove`. Each hall names them (`HALL_WORDS`).
- Ends on the Class Live timer (the round on finishes); the teacher can end it. Podium by crowns.

## Server and data

`shared/classlive/thronesServer.ts` (views and pupil steps, given server.ts's helpers), hooks in `shared/classlive/server.ts` (rounds advance in `mutate`, at the stop the saved spots are read for dance tiles and royal seats). Pupils' view shows thrones as taken or not, never by whom. Movement and spots: `classlive_move` (moving activity, max speed 0.6).

Rewards: Class Live points (1 / 3 / +2 podium, at most 10). Trophies from `PupilReward.extra`: Throne Sitter (20 thrones), Crown Hoard (50 crowns), Throne Thief (5 steals), Royal Champion (top of the podium).

## Stages

1. Rules, server, migration, pretend pupils, 2 tests.
2. Big screen (`ThronesScene.tsx`), pad (`ThronesPad.tsx`), board (`ThronesBoard.tsx`, `thrones.css`), guide, picker card and lobby (`ThronesCard.tsx`), How to play, sounds (`stop`, `sit`, `steal` in audio.ts), Bella lines, music cut on the stop (`thronesMusic.ts`), art plan.
3. Painted art (docs/THRONES-ART-PLAN.md), hall dance tracks (`thrones-<hall>.mp3`, `-hot`) and Bella clips made on James's PC.

Try it: `npx vite --config vite.classlive-preview.config.ts` (Musical Thrones card; "Be a pupil" to run with the arrow keys).

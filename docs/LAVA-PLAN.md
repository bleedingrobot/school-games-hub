# Floor is Lava (Class Live activity `lava`)

**Status: stages 1 and 2 built 25 Nov 2026 NZ (rules, server, pretend pupils, big screen, pad, How to play, sounds, Bella clips, art plan). Stage 3 paintings not painted yet: the game draws stand-ins.** Migration `20261125001000_classlive_lava` (number agreed with the sibling Class Live threads: Thrones 1100, Clash 1200, Ghost 1300, Shark 1400; check again with `node scripts/migration-numbers.mjs`).

James's idea (25 Nov 2026 NZ, idea 1 of the Class Live shortlist): every pupil runs their hub avatar round a floor of tiles over lava. Each round some tiles glow, then crack away. Anyone left on a cracked tile falls onto the lava raft. Right answers earn bricks to rebuild the floor or rescue friends.

It is a Class Live map game built on Four Corners (docs/CORNERS-PLAN.md): same joystick, `classlive_move` positions, power-ups, big-screen drama, end stats, music and painted art. It uses the shared base from PR #832 (`classlive_activities` row, `PupilReward.extra`).

## James's answers (question cards, 25 Nov 2026 NZ)

| Question | Answer |
|---|---|
| Falling in | Out until a friend rescues you (or 5 right answers on the raft, Claude's extra so nobody waits forever) |
| Right answers | Earn bricks: 1 brick rebuilds a lava tile next to you, 2 bricks rescue a friend |
| How the floor cracks | A mix of patterns, harder each round |
| Winning | Most rounds survived |

## Rules (shared/classlive/lava.ts)

- Floor: 8 × 8 tiles over the unit square. Pupils start on solid tiles in the middle.
- A round: **ready** (4 s, first round only), **run** (the teacher picks 5 to 10 s on the card, default 7), **crack** (2.2 s), **show** (3.8 s). Glowing tiles are chosen on the server when the round is made; positions are read when the run ends.
- Glow share rises from 30% to at most 60%, always keeping at least max(20% of tiles, players / 2 + 4) solid. Cracked tiles stay lava for 2 rounds (`COOL_ROUNDS`), then come back.
- Patterns by round: 1 patches, 3 rows, 4 checker, 5 ring, 6 cross, 8 islands, 10 wave; later rounds mix.
- Mechanics by round: 2 power-ups, 3 bubbles (slow), 5 crust (slide), 7 rolling fireball (knocks you flying), 9 late tiles (more tiles glow 3 s before the end). Each map renames them (`LAVA_WORDS`).
- Lava is a wall while you run (you can't walk onto it) unless you have Fire boots.
- Score: +1 a round you stay up (+2 with Double star). Most rounds up wins; ties share the podium.
- The raft: fall in and you sit on it. A friend can rescue you (2 bricks, or a Rescue rope), or answer 5 questions right on the raft to climb back at the start of the next round.
- Bricks: one right answer = one brick, at most 3. Build: tap a lava tile within reach (0.24). Questions come every 1.5 s at most.
- Power-ups (grab by running over, switched on by a right answer): Fire boots (lava can't hurt you this round), Ice blast (cools glowing tiles near you), Speed boost (1.6× for 3 rounds), Double star, Rescue rope (frees a friend for free).
- Rewards: podium +2 points, achievements Lava Survivor (25 rounds), Lava Champion (1 win), Bridge Builder (20 tiles rebuilt), Lava Lifeguard (5 rescues). Counts go through `PupilReward.extra` (`lava_rounds`, `lava_wins`, `lava_built`, `lava_rescues`).

## Maps

Volcano Island, Dragon's Lair, Lava Forge, Lava Planet (the teacher picks, or a new one each game).

## Files

| File | What |
|---|---|
| `shared/classlive/lava.ts` | rules, rounds, moving, cracking, bricks, power-ups (pure) |
| `shared/classlive/lavaServer.ts` | server steps (grab, build, rescue, ask, answer) and the views |
| `shared/classlive/lavaPretend.ts` | pretend pupils for the preview page |
| `shared/classlive/lava.test.ts` | 1 test (rules + a pretend class of 20) |
| `src/games/classlive/LavaBoard.tsx`, `LavaScene.tsx`, `LavaPad.tsx`, `lava.css`, `lavaVoice.ts` | floor, big screen, pupil pad, look, Bella's lines |
| `supabase/migrations/20261125001000_classlive_lava.sql` | activity row, 4 measures, 4 achievements |
| `docs/LAVA-ART-PLAN.md`, `docs/lava-art/config.json` | paintings |

Small edits to shared files: server.ts, rewards.ts, pretendClass.ts, Projector.tsx, Controller.tsx, HowTo.tsx, CornersPad.tsx (exports Joystick, useKeys), voiceLines.ts, audio.ts, music.ts.

## Stages

1. Rules, server, pretend class, migration, test. Done.
2. Big screen, pad, How to play, sounds, Bella clips, music track fallback (boss). Done.
3. Paintings (docs/LAVA-ART-PLAN.md) on James's PC; own music tracks `lava-<map>` later.

## Later ideas

- Tune glow share and raft length after James tries it with a class.
- Own looping music per map (currently the boss track).

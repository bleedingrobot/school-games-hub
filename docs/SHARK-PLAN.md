# Shark Bay (Class Live activity `shark`)

**Status: ALL stages LIVE 25 Nov 2026 NZ: stage 1 (PR #835), paintings and music from James's PC (stage 2).**

James's pick (25 Nov 2026 NZ, from the coordinator's list of map games): a shark circles a pool and strikes a quarter, like Four Corners with moving zones and a hide-under-the-boat shield. Built alongside Floor is Lava, Musical Thrones, Colour Clash and Ghost Tag.

## Choices (question cards, 25 Nov 2026 NZ; built on Claude's picks until James answers)

| Question | Pick |
|---|---|
| Moving zones | Quarters spin round the bay (still in round 1, faster each round) |
| Too many under a boat | The pupils nearest the boat's middle fit, up to its seats |
| Maps | Four: Sunny Lagoon, Coral Reef, Pirate Cove, Icy Bay |
| Jail | Like Four Corners: the Shark's Cave, miss a round, 3 right answers |
| Strike | Both styles mixed: fin circles then leaps, or a spotlight sweep |
| Shark's name | Simon (James, 25 Nov 2026 NZ) |

## How it is built

Shark Bay runs on Four Corners' engine: the game is a `CornersGame` with `variant: 'shark'` and `bay` (`shared/classlive/shark.ts`). Positions, saving moves (`classlive_move`), jail questions, power-ups, grabs, warps, podium and points are Four Corners' code. Only these differ, picked in `server.ts` with `isShark(g)`: `sharkAdvance` (rounds and the strike), `sharkQuestionFor` (power-ups switch on anywhere off the jetty), `sharkJump` (Jet ski to a quarter). Pupils' devices move with `sharkMove` (stays in the water).

## Rules (shared/classlive/shark.ts)

- A round bay (radius `POOL_R`) in the unit square. Four quarters (Red, Yellow, Green, Purple) split by rope lines turn at `spinRate` (0 in round 1, then 0.1 rad/s rising to 0.32; ×1.4 in the second half, the "frenzy"). The quarters stop when the run ends.
- Start on the jetty (`DOCK_R`). At the strike: anyone on the jetty or in a struck quarter is caught, unless under a boat or with a Shark cage.
- Boats (`boatsFor`: 1 to 3, about a third of the class fits) drift round the middle. At the strike the pupils nearest each boat's middle fit, up to its seats (`seated`); they are safe and score.
- Strike: 1 quarter; from round 8 sometimes two ("Two sharks!", opposite quarters) or none ("Simon is full!"). Style per round: `leap` or `spot`.
- Hazards unlock by round (`SHARK_UNLOCK`): power-ups 2, seaweed 3, whirlpool 4, current 5, murky water 6, waves 7, twists 8. Names per bay in `BAY_WORDS`.
- Power-ups (`SHARK_POWER_WORDS`): Shark cage, Dolphin dash, Rescue ring, Periscope, Jet ski, Pearl, Ink cloud (Four Corners' seven powers).

## Rewards

Points as Four Corners (podium +2). Trophies from `PupilReward.extra` (kept out of Four Corners' totals): Shark Dodger (20 safe rounds), Boat Hider (5 boat saves), Bay Champion (top of the podium), Cave Escape (5 escapes).

## Stages

1. Rules, server, migration, test (folded into the Four Corners test: the classlive budget is full), big screen (`SharkScene`), pads (`SharkPad`), How to play, guide page, picker card, drawn stand-ins, Bella lines, art plan.
2. Painted art from James's PC (docs/SHARK-ART-PLAN.md, docs/shark-art/config.json, 46 pictures), music tracks `shark-<bay>` (ACE-Step, as Four Corners), Bella clips.

## Files

`shared/classlive/shark.ts`, `src/games/classlive/SharkBoard.tsx`, `SharkScene.tsx`, `SharkPad.tsx`, `SharkGuide.tsx`, `shark.css`. Try it: `npx vite --config vite.classlive-preview.config.ts` (Shark Bay card).

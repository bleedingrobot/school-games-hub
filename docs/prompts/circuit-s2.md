# Prompt: Circuit Racer Stage 2 (first playable)

Paste everything below the line into a new Claude Code session opened in the Games Hub folder.

---

Build Stage 2 of **Circuit Racer** (game id `circuit`, CSS prefix `.cr-`) for School Games Hub (GitHub bleedingrobot/school-games-hub): the **first playable**, live but **switched off**. Use your own worktree from `origin/main`.

**Read first**
- `docs/CIRCUIT-PLAN.md` in full: the Decisions table (all settled by James, 22 Nov 2026, don't re-ask), section 2 (physics), 4 (a go), 5 (design, play a day), 8 (server and data), and **"Stage 1 results"**.
- `docs/game-guide/README.md`, then 3-files-and-clashes.md (incl. "Full window"), 5-server-and-saving.md, 7-testing.md and 8-going-live.md.
- The Stage 1 engine you build on, all in `shared/circuit/`: `physics.ts` (`newRace`, `step`, `replay`, `readyToRestart`, events), `inputs.ts` (inputs recorded by distance: `makeRecorder`, `encodeLog`/`decodeLog`), `road.ts` (text road format, `cellAt`), `roads/motherboard.ts` (the 6 world-1 roads), `config.ts` (every tuning number), `bot.ts`, `scripts/circuit-sim.mjs`.
- Marble Rush as the pattern for a three.js game with a server replay: `src/games/marble/` (renderer, bloom, controls, quality, full window), `shared/marble/save.ts` and `supabase/functions/marble/`. Mine Runner also uses three.js. `three` is already a dependency (no new ones).

**What James already decided (don't re-ask)**
- **5 finished roads a day, then the game fully stops**: "All done for today. See you tomorrow!" with a countdown to NZ midnight. Only a finish uses one (replaying a finished road too); crashes, restarts and quitting are free. The **server** counts by `nzDate` and refuses a 6th finish; the world map shows "3 races left today". Add `circuit` to `UNLIMITED_GAMES` (`shared/unlimited.ts`) and `teacher_set_unlimited_today()`; extra races on an Unlimited day earn game rewards but no hub points.
- Worlds open at 4 of 6 roads finished (only world 1 exists yet, so just road unlocking inside it: roads open in order).
- **3D low-poly racer drawn in code, with glow**. Auto-Pilot on (dashboard light), off only in hard mode (Stage 4). Kind crashes: explode only above half speed, restart after 1.5 s. **No ghosts.**
- No maths yet (Stage 3: recharge ports just refill; `?` gates drive as trace). Painted art is Stage 5: drawn stand-ins now.

**Stage 2: what to build**
1. **Screens** in `src/games/circuit/`, full window from the first screen (`.cr-window`, copy `src/games/lord/HubButtons.tsx` for ⌂ Hub and sound): a world-1 road picker (6 roads, best time and medal, "N races left today", "All done for today" screen when used up), the race, and a finish screen (time, bronze/silver/gold from the Stage 1 suggested times, stars: no crash, battery over half), with Enter to retry or go on.
2. **The race in three.js + bloom** (lazy loaded): glowing neon circuit-board roads built from the road grid (trace, overclock arrows, amber resistors, crackling red shorts, icy gel, blue recharge rings, chips/capacitors/heat-sinks for blocks 0.5/0.75/1.0, half-pipe data cables for tunnels, a giant port at the finish), a dark computer-cosmos background, the 3D glowing racer with a spark trail, sparks for `crash`/`bonk`/`nudge`/`bounce`/`recharge` events, chase camera. The physics runs at a fixed 30 steps a second (drop time if more than 3 steps behind, as OpenRoads does) and the picture interpolates between steps.
3. **Dashboard**: speed, battery and signal meters, road progress bar, Auto-Pilot light (`autoPilotOn`), with a stand-in for Volt.
4. **Controls**: arrows/WASD to steer and speed, Space to jump, Enter to start/retry. Touch: left/right pads, a jump button, speed by sliding a thumb. Record inputs with `makeRecorder` every step.
5. **Server** `supabase/functions/circuit/` (`start`, `finish`): sign-in and school checks, the teacher switch (`settings_of`), refuse when the code or teacher switch is off. `finish` decodes the log, **replays it with `replay()`** and trusts only the replay's outcome and steps, saves best time/medal/stars, enforces the 5-a-day limit (Unlimited today lifts it), and gives points with `add_game_points`. `npm run build:functions -- circuit`; add `circuit` to the end of `FUNCTIONS`.
6. **Migration**: check the number with `git fetch && node scripts/migration-numbers.mjs` (it was `20261122000800` free on 22 Nov; take whatever is free now). Tables with RLS and no pupil access: `circuit_progress` (per pupil per road: best steps, medal, stars, finishes today + their NZ date) and `circuit_runs` (recent finished runs with their inputs). `hub_games` row with `switch_column = 'circuit_enabled'`, `app_settings.circuit_enabled boolean not null default true`, the Unlimited today list, revoke/grant. `supabase/tests/database/circuit.test.sql` on a scratch copy.
7. **Wiring**: GameDefinition (`group: 'complex-maths'`, `teacherSwitch: true`, colours, icon), `src/games/circuit/switch.ts` with the code switch **off**, append to `GAMES` in the registry behind it, `GAME_SWITCH_COLUMNS`, a preview page (`preview/circuit/` + `vite.circuit-preview.config.ts`) running the real handler against a pretend database, `.gitignore` line. Shared one-line edits only after merging `main`.
8. **Credits**: `src/games/circuit/art/CREDITS.md` with the OpenRoads MIT credit (ideas only; no SkyRoads roads, art, music or name).

**Tests** (game budget 8; Stage 1 used 3): about 2 server tests (a finish is replayed and a tampered time is ignored; a 6th finish in a NZ day is refused unless Unlimited today; another pupil's run or a switched-off class is refused) and at most 1 screen test (the race opens and Space/Enter work). Run `npx vitest run scripts/test-budget` before pushing and fold tests if needed.

**Check** at phone, iPad and laptop sizes: full window, nothing scrolls sideways, 30 steps a second holds on an iPad-class device (lower bloom/quality if not). Then typecheck, test, build, open the PR and **merge when green (pre-approved)**. After the merge: check the publish run and the live files, the function's 401 from outside, and that the tables refuse pupils. Update the plan's Status line, project memory, and write the copy-ready Stage 3 prompt (maths: recharge ports and data gates, way A, teacher maths switch) in `docs/prompts/circuit-s3.md`.

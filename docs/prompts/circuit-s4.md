# Prompt: Circuit Racer Stage 4 (worlds 2 to 5, checkpoints, hard mode, medals)

Paste everything below the line into a new Claude Code session opened in the Games Hub folder.

---

Build Stage 4 of **Circuit Racer** (game id `circuit`, CSS prefix `.cr-`) for School Games Hub (GitHub bleedingrobot/school-games-hub): **worlds 2 to 5**, live but still **switched off** (code switch stays OFF until Stage 6). Use your own git worktree from `origin/main`, on a branch named `circuit-s4`; commit and push early (a scheduled check skips work while that branch has recent commits).

**Read first**
- Project memory (`C:\Users\Giant\.claude\projects\C--Users-Giant-Games-Hub\memory\MEMORY.md`, then circuit-roads-feedback.md, circuit-s3-pr.md, live-means-published.md, games-hub-setup.md).
- `docs/CIRCUIT-PLAN.md` in full: the Decisions table (settled by James, don't re-ask), sections 2 to 5, and "Stage 1 results", "World 1 redrawn", "Stage 3 results".
- `docs/game-guide/README.md`, then 5-server-and-saving.md, 7-testing.md and 8-going-live.md.
- What you build on: `shared/circuit/` (`road.ts` with its maths-spot rules, `roads/motherboard.ts`, `roads/test.ts`, `physics.ts`, `maths.ts`, `game.ts` with `ROADS`, `roadOpen`, `MEDAL_SECONDS`, `judgeFinish`, `bot.ts`), `scripts/circuit-sim.mjs`, `supabase/functions/circuit/handler.ts`, `src/games/circuit/` (`CircuitGame.tsx` road picker, `RaceScreen.tsx`, `renderer.ts`), migrations `20261122001300_circuit.sql` and `20261123000100_circuit_maths.sql`.

**James's road rules (23 Nov 2026, after playing the demo; don't re-ask)**
- Make roads fun and harder through **jumps and narrow, zig-zag traces**: single-lane bridges, zig-zags across the board, hop rhythms of short gaps, sideways stepping stones, chips to climb onto, one-lane cables.
- **Never make a road harder by tightening the battery or signal** ("that won't be fun for kids"). A careful driver must stay well above half battery on every road, so a wrong answer at a recharge port (a half charge) never ends a run.
- **No bounce** after landing (already off: `BOUNCE_ON`). He loves the neon look: keep it.

**What James already decided (don't re-ask)**
- Worlds (6 roads each, our own layouts, nothing from SkyRoads): 2 **Graphics Card** (hot reds and orange, overclock and resistors, data gates), 3 **Memory Lanes** (blue and silver, narrow lanes, cooling gel, tunnels; heavier gravity), 4 **The Cloud** (white and cyan, long gaps; lighter gravity), 5 **Quantum Core** (purple and gold, everything; very light gravity). Gravity per world is in `config.ts`.
- **A world opens when 4 of the 6 roads before it are finished**; inside a world, roads open in order. The server checks it (`roadOpen` / `record_circuit_finish`'s `before_road` today: change both together, plus `memoryServices.ts`).
- **Data gates from world 2** (2 to 4 signed lanes, at least 8 rows from any other question, no red tiles near a gate: `parseRoad` enforces it). Recharge ports in every world.
- **Checkpoints on roads over 60 seconds** (careful bot time): crash or fall and you restart at the last checkpoint passed. They must work with the server replay: the recorded run is still one log from the start, so design how a restart at a checkpoint is recorded and replayed (e.g. a checkpoint restart as part of the physics, triggered by the crash itself), and keep a known port answer (no re-asking).
- **Hard mode** on a finished road: Auto-Pilot off (`RaceOptions.autoPilot`), a count-down clock, nothing lost by failing, 🔥 on the result; the server replays with Auto-Pilot off and saves hard finishes separately (a `hard` flag; the Firewall Free achievement in Stage 6 counts them).
- **Medals from the simulator:** extend `npm run circuit:sim` to every world and set `MEDAL_SECONDS` from it (gold about 10% slower than the wild bot, silver about 15% slower than the average bot). Also run the bots with every port at half refill and check careful drivers stay well above half battery.
- The world map / road picker shows the 5 worlds (drawn stand-ins; painted art is Stage 5, but use any paintings already in `src/games/circuit/art/` if the art session has merged them).

**Tests** (game budget 8, all 8 used): fold into the existing tests rather than adding. `roads.test.ts` should check every road of every world is finished by the average bot on its first go and replays exactly, world 1 has no gates, worlds 2 to 5 have gates. Run `npx vitest run scripts/test-budget` before pushing.

**Check** at phone, iPad and laptop sizes: the world map, a gate in world 2, a checkpoint restart, hard mode. Then typecheck, test, build (on Windows the full build fails only on Glyph's Art.ts/art.ts clash; build the preview with `vite.circuit-preview.config.ts` and let CI do the full build), re-check the migration number with `git fetch && node scripts/migration-numbers.mjs`, merge `origin/main` again, open the PR and **merge when green (pre-approved)**. After the merge: check the publish run and that the function answers 401 unsigned. Update the plan's Status line and a "Stage 4 results" section, project memory, republish James's trial artifact (https://claude.ai/artifact/2BvwLFFFC5fR7h4gTVwW1y: read it first, then publish `dist-preview-circuit/index.html` with that url and the new asset files, removing old ones), and write the copy-ready Stage 5 prompt (painted art wired in, sounds) in `docs/prompts/circuit-s5.md`. Reply to James in short plain words with the demo link.

# Prompt: Marble Rush, stages M.1 and M.2 (engine, then the game screen)

Paste this into a new chat to start the build.

---
You're starting a new game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. The live site is `main`. Marble Rush gets its **own branch `marble` and its own worktree** (`git worktree add ../school-games-hub-marble -b marble main`), like Gem Keep, Maths Monsters and Power Clash. Never commit game work straight to `main`.
- **Read first:** docs/MARBLE-PLAN.md (the approved plan; every question in section 12 is answered). Then docs/PLAN.md, shared/README.md, and the memory note school_games_hub.md. For how a finished game is shaped, look at the space game (shared/space/, src/games/space/, docs/SPACE-GAME-PLAN.md) and Gem Keep (shared/gem-keep/, src/games/gem-keep/). Don't read the Maths Monsters or Dragon Maths code.
- James's decisions (18 Oct 2026): the game is **Marble Rush**; the clock counts up with bronze/silver/gold medals, plus an arcade-style countdown **hard mode** after you've finished a course; the look is **New Zealand landscapes inspired by real places** (section 3 of the plan, including the care to take with places special to iwi); two fastest-time boards per course (with maths / without); rescue questions on by default. He asked for it to be built **alongside** Maths Monsters.
- **No maths in this prompt.** Section 7 of the plan (M.6 and M.7) waits until Maths Monsters is merged into `main`. But design the engine so maths can be added later without changing the physics: shortcut doors that are open or shut for the whole run, a "pause" input the replay understands, and the clock able to stop.

## This step: M.1 then M.2 (stop for James when done)

**M.1: the engine, `shared/marble/`.** Pure TypeScript, no outside physics library, no `Math.sin`/`cos`/etc. in the physics (add, subtract, multiply, divide and square root only), fixed 1/60-second steps. Follow section 4 of the plan. Needed:

1. Tiles and heights on a grid (flat, slopes, ramps, rails, gaps, edges), the ball (position, speed, spin for looks), gravity along slopes, rolling grip (normal, ice, mud), bumping into rails and walls, jumps and landings, falling too far or off the edge (back to the last checkpoint with a time penalty of about 3 seconds), checkpoints, the finish, and the clock.
2. Inputs: one of 9 directions per step, stored as "same input for N steps" runs. A replay function takes a course and the inputs and returns the finish time, falls and checkpoints. The server will use this later to check times, so it must be exact.
3. Both clock modes: count-up (medals) and countdown (hard mode, each checkpoint adds a few seconds, running out ends the run).
4. Two test courses (a wide easy one, and a harder one with a gap, ice and a bumper), each with a **reference run** in the tests that finishes and sets the medal times.
5. Tests: slopes, rails, ice, mud, landings, falling, checkpoints, both clock modes, the replay finishing with the same time as playing live, and **the same recorded run giving an identical result in Node and in real WebKit** via Playwright (Playwright and Chromium notes are in the earlier prompts in docs/prompts/; add WebKit if it isn't installed).
6. A little simulator script (like `npm run space:sim`) that checks a course can be finished and prints the reference time.

**M.2: the game screen, `src/games/marble/`.** Follow section 5 of the plan.

1. three.js (MIT; pin a version at least two weeks old; check its real API in `node_modules`), **lazy loaded** so the rest of the site doesn't get slower. Orthographic isometric camera following the marble, low-poly flat colours in the Douglas Park look, a shiny marble with a shadow. Cap the pixel ratio at 1.5; drop to 30 fps and simpler shading on slow devices (the physics never changes).
2. Controls: arrow keys/WASD (the engine turns "up the screen" into grid directions), hold-and-drag with mouse/trackpad, an on-screen thumb stick for touch. Pause, Restart, Sound on/off, and "less motion" from the device setting.
3. Course picker with the six NZ courses from section 3 of the plan (only the two test courses playable for now, the rest shown as "coming soon"), timer, medals at the finish, the hard-mode choice once a course is finished, and the "Did you know?" card for courses that have one.
4. **Local only, no saving yet** (saving is M.4; best times may be kept on the device for now). Add the game to the dashboard behind a development switch, as the earlier games did, so students can't see it yet.
5. **A private phone preview for James** after M.2 (the way `npm run space:preview` and the claude.ai artifact worked for the space game), so he can try it on his phone.
6. Checks: Chromebook (1366x640 is the real usable height) and tablet (768x1024) sizes with keyboard, mouse and touch using the usual Playwright scripts; a frame-rate check on a throttled CPU; axe-core accessibility (at ~/projects/maths-alignment-tool/node_modules/axe-core); everything the game needs readable without relying on colour alone.

## How to work

- Small commits on the `marble` branch, pushed, with the attribution line the system gives you. Run type check, lint and the whole test suite before each push.
- Add a short "Results" section to docs/MARBLE-PLAN.md after each stage (what was built, what was checked, what's left), and update the memory note school_games_hub.md.
- **Stop for James after M.2** with the phone preview link and a plain-words summary. Don't start M.3 until he's tried it.
- Nothing goes live in this step: no migrations applied, no server functions deployed, no merge to `main`.
- Keep changes to shared files (the dashboard, the router, the Teacher page, `save-bot-game`) tiny, and merge `main` into `marble` now and then, because Maths Monsters is being built at the same time and both games touch them.
- If something in the plan turns out to be wrong or too big, say so plainly and suggest a fix instead of quietly changing course.

# Prompt: Class Showdown Stage 7 (more arenas, one PR each)

Paste everything below the line into project chat.

---

Build Stage 7 of **Class Showdown** (game id `showdown`, School Games Hub, GitHub bleedingrobot/school-games-hub): four more arenas, **one PR each, each carried to live** before the next: **Sky Climb**, **Shrinking Island**, **King of the Hill**, **Auction House** (in that order), every one in all four modes (whole class, 2 teams, 4 teams, solo). Merging and deploying are pre-approved. Use Sonnet/Haiku helpers in parallel for routine pieces; plan and check on the main thread. Make the best call yourself and keep going (James, 23 Nov 2026); keep replies short and plain.

Read first: `docs/SHOWDOWN-PLAN.md` (Decisions, section 4 arenas, and the Stage 1 to 6 results), `docs/game-guide/README.md`, and the code in `shared/showdown/` (engine, server, bosses, `goldrush.ts` as the model for an arena) and `src/games/showdown/` (Gold Rush's arena checks in `Projector.tsx`, `Controller.tsx`, `SeamPicker.tsx`). Questions leave out the ladder's untimed skills (already in `makeQuestion`).

For each arena:
1. **Rules** in its own `shared/showdown/<arena>.ts`, pure and tested, hooked into the engine like Gold Rush (the round, modes, roles and big events stay; only what a right answer does changes). Tune with the simulator (`npm run showdown:sim`) so a round is close (about 80% won where there is a shared goal).
   - **Sky Climb:** each pupil (or team) climbs side by side; a right answer is a step, 3 in a row a jump; storms knock back anyone not answering. Highest at the end wins.
   - **Shrinking Island:** the island shrinks; right answers move you, build rafts, grab power-ups; caught by the water you wash up on a rock and keep scoring slower until you swim back. No knockouts.
   - **King of the Hill:** one crown; most points in the last 30 seconds wears it; points come from holding it, so the lead keeps swinging.
   - **Auction House:** right answers earn coins; each minute a treasure appears and everyone bids from their iPad; highest treasure value at the end wins (saving versus spending).
2. **Server:** add the arena to `ARENAS` and the `showdown_rooms` arena check (new migration: `node scripts/migration-numbers.mjs`), any pupil choice it needs, the same saves, rewards and "Again?" (`roster: false` like Gold Rush, so no boss counts).
3. **Projector, controller, teacher bar:** the arena in the Arena picker, its own painted scene (placeholders now, art plan in the PR; James paints in ComfyUI in the evening), and **flashy, immersive animation** on every screen, as James asked.

Tests: raise the showdown budget in `scripts/test-budget.test.ts` by at most 1 per arena, with a one-line reason. Screen checks at phone, iPad and laptop sizes. Done when all four are live. After each, update the plan's Status line and Stage results and project memory; at the end mark this prompt used on the Games Hub Prompts board.

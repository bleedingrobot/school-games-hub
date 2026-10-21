# Prompt: Archery Challenge Stage 1 (the engine)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery`.

---

You are continuing **Archery Challenge** (short id `archery`) for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). It's Scorched Earth with archers instead of tanks, designed by James with one of his pupils. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

James has approved the plan. **This session builds Stage 1: the rules-and-physics engine.** There are no screens, no server and no database in this stage.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ARCHERY-PLAN.md` all the way through, especially "Decisions", section 2 (the engine) and section 4 (the Armory). James's feedback from 21 Oct 2026 matters most:
   - **Hilly land like Scorched Earth.** Big jagged cliffs, peaks up to about 75% of the field's height, deep narrow valleys, and usually a real hill between the two archers, so angle and power both matter.
   - **No aiming help of any kind.** No aiming line, guide, dotted path or ghost of the last shot. Pupils experiment with angle and power.
   - **Special arrows are scarce and expensive.**
3. Work only in this worktree, on branch `archery`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push with `git push origin archery`).
4. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`).
5. Read how Mine Runner keeps its engine the same on every device: `shared/mine/config.ts` (the top comment: only + − × ÷, square root and floor while the game runs, never `Math.sin`/`cos`/`atan2`), `shared/mine/determinism.ts`, `shared/mine/determinism.test.ts` and `scripts/mine-determinism.mjs`. Copy that approach.

## What to build (all in `shared/archery/`)
Pure TypeScript functions only. The same seed and the same inputs must give exactly the same result. No `Math.random`, no clocks, no DOM. Every tuning number goes in `config.ts`.

- `config.ts`: field size (960 × 540), cell size (3 px, so 320 × 180 cells), gravity, power-to-speed, wind range and strength, time step (1/240 s), health, fall damage, blast numbers, and the land's hilliness numbers.
- `types.ts`: the land, an archer, a shot `(angle, power, arrow)`, a round, a fight, and the result of a fight.
- `random.ts`: a seeded integer random number generator (32-bit, integer maths only). Use it for land, wind and archer placement.
- `aim.ts`: a fixed table of direction vectors, one per whole degree (0–180), written into the file as numbers (generate them once with a small script and check them in), so nothing uses trig while the game runs. Add a test that the table matches `Math.cos`/`Math.sin` closely.
- `land.ts`: the land as a grid of cells.
  - Make the land by midpoint displacement from the seed: a start roughness of about 60–70% of the field's height, shrinking by about 0.58 each split, no smoothing, peaks up to about 75% of the height.
  - Place two archers on ledges or in dips, left and right.
  - **Check there's usually a hill between them.** If the archers can see each other in a straight line, remake the land from the next seed (up to a limit). Write a test that, over 1,000 seeds, the land is properly hilly and the archers can rarely see each other.
  - Carve a circle out (a blast) and add a circle of dirt.
  - Let loose dirt fall after a blast. Make an archer with nothing under them fall, with fall damage (capped, see config).
- `shot.ts`: fly one arrow with a fixed time step, gravity and wind, checking it against the land cells and each archer's box. Return where and what it hit, and its path. The path is only for drawing the flight. Stage 2 must fade it within half a second and never keep it on screen.
- `arrows.ts`: **a table of arrow kinds.** Each arrow is a small data entry (name, blast size, peak damage, price, how many per purchase, Armory level, `forSale`) plus an optional "behaviour" hook for special effects (split, roll, dig, add dirt, and so on). Adding a new arrow must mean adding one entry and, at most, one behaviour function.
  - In Stage 1, make **Plain Arrow** and **Steel Arrow** work fully.
  - List every other arrow from the plan's section 4 with its numbers, and mark their behaviours as "Stage 3".
  - **Leave a placeholder for the pupil's own arrow** (James, 21 Oct 2026). One of the pupils is inventing an arrow and will send its name and what it does later. Add an entry with id `pupil`, the name `"Pupil's Arrow"` (marked as a placeholder), `forSale: false`, and blank price and level. Its behaviour is a clearly commented `TODO` that does nothing special. Write a test that it is never sold and that bots never pick it while `forSale` is false. Don't invent its name or behaviour. It's the pupil's to decide.
- `damage.ts`: damage fades in a straight line from the blast's centre to its edge. Shields take damage first. A direct hit adds a small bonus, but **no single arrow can knock out a full-health archer** (test this for every arrow in the table). An archer at 0 health "pops" and sits out the rest of the round.
- `fight.ts`: turns, rounds and best of 3. Each round has new land and new wind from the seed. `playFight(seed, setup, shots)` gives the whole result: every shot's landing, the damage, who won each round and the fight, and which arrows each player used. The server will use exactly this in Stage 4 to count used arrows.
- `determinism.ts` + `determinism.test.ts` + `scripts/archery-determinism.mjs`: copy Mine Runner's. Build a long fight from a fixed seed, print the full state every so often, and pin the text in a test. The script compares Node with real Chromium and WebKit. If Playwright isn't available, say so plainly in the results, and don't add it as a dependency.

**Not in this stage:** drawing, art, the worlds' twists (Stage 2), bots (Stage 2), the other arrows' behaviours (Stage 3), the server, migrations and points (Stage 4 onwards).

## A quick way to try it
Make a very plain test page in `preview/archery/` (plus `vite.archery-preview.config.ts`) that draws the land as cells and the two archers as boxes. It has angle and power as **numbers** (buttons, sliders and keyboard), a wind number, a Fire button, and a "New land" button. Use plain shapes, with no art yet. Show **no aiming line**. It must never call the server. If it's easy, build it into a single file and publish it as a private Artifact so James can fire some arrows on his phone. Give him the link.

## Going quickly
James wants this to move fast. Once `config.ts` and `types.ts` are written and committed, you may use helper agents in parallel, each on its own files: for example one on `land.ts`, one on `shot.ts` and `damage.ts`, and one on `aim.ts` and the determinism script. Fit their work together and check it yourself. Helpers must not touch files outside `shared/archery/`, `preview/archery/`, `scripts/archery-*` and `vite.archery-preview.config.ts`.

## Before you say it's done
- Run `npx vitest run shared/archery` while you work. Then run `npm run typecheck`, `npm run test:all` and `npm run build`. Say plainly if anything fails, with the output.
- Write "Stage 1 results" at the bottom of `docs/ARCHERY-PLAN.md`: what you built, the numbers you chose (and why), the tests, the hilliness numbers over 1,000 seeds, what's untested, and anything for the go-live list.
- Commit, run `git push origin archery`, and **stop for James**. Don't start Stage 2 until he says so.
- Nothing goes live: no migration, no function deploy, no merge to `main`, no switching on.

When you stop, tell James in plain words what's ready, give him the test page link if there is one, and say what he needs to decide.

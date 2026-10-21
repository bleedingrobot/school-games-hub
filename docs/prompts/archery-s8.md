# Prompt: Archery Challenge Stage 8 (the target challenge)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery`.

---

You are continuing **Archery Challenge** (short id `archery`) for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). It's Scorched Earth with archers instead of tanks, designed by James with one of his pupils. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

**The game is LIVE** (since 22 Oct 2026): switched on for James's classes Everyone, Riley and Teachers, with classmate fights on. Pupils are playing it. Everything in this stage must keep the live game working, and nothing new reaches pupils until James says so. **This session builds Stage 8: the target challenge**, the pupil's own level screens. Stage 6b (joining from the hub's main Lobby) is NOT this session.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ARCHERY-PLAN.md` all the way through: "Decisions", sections 1 (what pupils see, including the target challenge line), 2 (the engine), 4 (arrows and bows), 5 (the speed round), 8 (points), 10 (graphics), 12, 13, every "Stage N results" section with **James's answers**, and **"Go-live" and "Went live"** at the bottom. What matters most:
   - **No aiming help of any kind** (no aiming line, guide, dotted path or ghost shot). **The server owns coins and gear.** **New Season wipes coins and gear; badges stay.** **Graphics top-notch but smooth on Chromebooks.**
   - The pupil's drawing of the level screens: **10 arrows, targets at 5, 10, 20, 30 and 50 m, beat your high score.** It reuses the same engine, worlds, arrows and bows.
3. Read the code you'll build on: `shared/archery/` (`fight.ts`, `shot.ts`, `land.ts`, `config.ts`, `stats.ts`, `points.ts`, `judge.ts`, `determinism.ts`), `supabase/functions/archery/` (`handler.ts`, `entry.ts`, tests), all three Archery migrations and their `supabase/tests/database/` files, `src/data/archery.ts`, `src/games/archery/` (`ArcheryGame.tsx`, `HomeScreen.tsx`, `FightScreen.tsx`, `renderer.ts`, `HowToPlay.tsx`, `trialBackend.ts`, `Accessibility.test.tsx`, `switch.ts`), `src/pages/TeacherArchery.tsx`, and `preview/archery/`.
4. **Ask James first, before building** (one short message, plain words, suggested answers he can just OK). The pupil's drawing is kept privately at `~/projects/archery-reference/`: look at it, but never put it in the repo or an Artifact.
   - **How a round works:** suggested: 10 arrows, five targets one at a time at 5, 10, 20, 30 and 50 m (2 arrows each), score by ring (bull 10, then 7, 5, 3, 1), wind like a fight, the land a gentle field per world (no hill in the way, so it's about distance, angle and power). "m" is pretend metres on the field.
   - **Which arrows and bows:** suggested: your own bow (its power and wind drift count), Plain Arrows only (special arrows don't make sense on a target and would be used up).
   - **What it earns:** suggested: no coins (coins stay speed-round only, James's rule), a small point for a new personal best (once a day per world), and one or two achievements (e.g. a bull's-eye at 50 m, a score of 70+). Best scores per world, own scores only (no class board unless he asks).
   - **Where it goes on the home screen**, and its name (the pupil's word if there is one on the drawing).
   - **A daily cap** if it earns points (suggested: points for a best once a day per world; play as much as you like).
5. Work only in this worktree, on branch `archery`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push with `git push origin archery`). Don't commit `dist-preview-archery/`.
6. `git fetch`, then merge `origin/main` into `archery` first (the game's own merge is on `main` now). Run `node scripts/migration-numbers.mjs` for the next free number and write it in the plan. All Stage 8 database changes go in **one new migration**. **The three Archery migrations are applied live: never edit them.** Replace an Archery function only with `create or replace` in the new file, and never re-create a shared function.

## What to build

### 1. The rules (`shared/archery/`)
- A target round as pure functions: the seed makes the field and wind (and the target positions), the shot list gives the result, exactly like `playFight`. Same seed + same shots = same score everywhere. Reuse `shot.ts` and the land code; no `Math.sin`/`cos` while it runs.
- Scoring, numbers in `config.ts`. Add the target runs to the determinism report and re-pin its fingerprint; Node, Chromium and WebKit must agree (`scripts/archery-determinism.mjs`).
- Tests: a ring hit scores right, a miss scores 0, wind and bows matter, 10 arrows and no more, the same shots give the same score.

### 2. The server
- `target-start` (makes and keeps the seed, stamped, no gear taken if Plain only) and `target-finish` (replays the shots, keeps a best per world, gives any points once through `add_game_points`, adds any achievement counts through `archery_note`). Everything refused while the teacher's switch is off. Copy how `fight-start` / `fight-finish` do it.
- The new migration: its own table for target runs (RLS on, no pupil access, kept a short while), the server-only functions, bests added to what `archery_state` / `my_archery` returns (with `create or replace`), New Season clearing target bests (replace `archery_season` with `create or replace`, keeping everything it already clears), "last played" counting target runs, How points work gaining a line, any new measures and achievements, and the "lock new functions" block. `archery_note`'s list of known counts must take any new count (replace it with `create or replace`).
- Handler tests and database tests (on a throw-away copy) for all of it.

### 3. The screens
- The target challenge screen: the same picture code and HUD style as a fight (angle and power as plain numbers, wind, Shoot), arrows left, the score so far, the ring each arrow hit, the target's distance, the best score. No aiming help. Keyboard and touch the same as a fight. A results screen ("New best!"), Play again, Back.
- Its button on the home screen, and How to play gains a section (numbers read from the rules).
- **Behind its own code switch** (`targetOn()` in `switch.ts`, off; `VITE_ARCHERY_TARGET_ON=true` for local work), so the branch can be merged to `main` without pupils seeing it until James says. The preview always shows it.
- Simpler graphics and the automatic switch-down work on it; measure frame times at a quarter and a sixth of full speed at 1366 × 640, as Stage 7 did (its scripts are described in the plan's Stage 7 results), and write the numbers in the plan.
- `Accessibility.test.tsx` widened to the new screen; a keyboard-only run through it in headless Chromium.

### 4. The preview
- The target challenge in the one-player preview, on the trial backend. Publish to the **same** test-page Artifact so James's link keeps working: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3 (read it first, then publish with `url`). Check it at 1366 × 640, 844 × 390 and 390 × 844 with zero network requests.

**Not in this stage:** the hub Lobby (Stage 6b); anything live (no migration applied, no function deployed, no merge to `main`, no switching on) unless James says so in words for each step.

## Before you say it's done
- Run `npx vitest run shared/archery src/games/archery src/data/archery.test.ts src/pages/TeacherArchery.test.tsx supabase/functions/archery` while you work, then `npm run typecheck`, `npm run test:all` and `npm run build`. Rebuild only this function's bundle (`npm run build:functions -- archery`). Say plainly if anything fails, with the output.
- Database tests on a throw-away copy (`scripts/scratch-db.sh`, `scripts/scratch-test.sh`, then drop it): the new migration's own file, the three Archery files, `game_hooks.test.sql`, `security.test.sql` (update its lists for any new pupil- or teacher-callable function) and `progress_access.test.sql` (its achievement count goes up by any new achievements). `clans_fights.test.sql` and `maths_focus_results.test.sql` never fully pass on a copy; that's expected.
- **Because the game is live:** check the new migration applies cleanly on top of the three live ones on the scratch copy, and that a pupil's existing coins, gear, bests and badges survive it.
- Write **"Stage 8 results"** at the bottom of `docs/ARCHERY-PLAN.md`: what you built, James's answers, the numbers you chose and why, frame times, the tests, what's untested, questions for James, and the go-live list for this stage (apply the new migration, deploy `archery` again, merge, turn `targetOn()` on), with `docs/PRIVACY-SUMMARY.md` lines for anything new stored. Add a short Stage 8 section to `docs/prompts/archery-golive.md` for those steps.
- Commit, `git push origin archery`, and **stop for James**.

When you stop, tell James in plain words what's ready, give him the test page link and how to try the target challenge, and say what he needs to decide.

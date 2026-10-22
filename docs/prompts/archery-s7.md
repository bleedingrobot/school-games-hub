# Prompt: Archery Challenge Stage 7 (hub fit and polish)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery`.

---

You are continuing **Archery Challenge** (short id `archery`) for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). It's Scorched Earth with archers instead of tanks, designed by James with one of his pupils. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

Stages 1–6 are built on branch `archery` (nothing live): the engine with every arrow, shield, helper and bow; bots; the fight screen; the server (migrations `20261021000300_archery.sql` and `20261022000100_archery_classmates.sql`, function `archery`); the whole game against bots; and fights against classmates (one round, through the server one turn at a time, with a two-player preview). **This session builds Stage 7: hub fit and polish.** Stage 6b (joining from the hub's main Lobby) and Stage 8 (the target challenge) are NOT this session.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ARCHERY-PLAN.md` all the way through: "Decisions", sections 1, 7 (switches and teacher settings), 8 (points and achievements), 10 (graphics), 12, 13, and **every "Stage N results" section** (5 and 6 most closely), with **James's answers**. What matters most:
   - **James (22 Oct 2026):** the teacher panel gets a **"Classmate fights on/off"** switch, **on by default**, beside the main on/off. Classmate fights stay one round; a fight someone leaves gives nobody points; Best scores stay bot-fight only; challenges pop up anywhere.
   - **No aiming help of any kind.** **The server owns coins and gear.** **New Season wipes coins and gear.** **Graphics top-notch but smooth on Chromebooks.**
3. Read the code you'll build on: `shared/archery/` (`points.ts`, `config.ts`, `duel.ts`), `supabase/functions/archery/` (`handler.ts`, `duels.ts`, `entry.ts`, both test files), both Archery migrations and their `supabase/tests/database/` files, `src/data/archery.ts`, and `src/games/archery/` (`index.tsx`, `switch.ts`, `ArcheryGame.tsx`, `HomeScreen.tsx`, `DuelScreen.tsx`, `FightScreen.tsx`, `renderer.ts`, `prefs.ts`, `HowToPlay.tsx`, `Accessibility.test.tsx`, `trialBackend.ts`), and `preview/archery/`.
4. Read the patterns to copy: **Mine Runner's hub fit** (`supabase/migrations/20261021000200_mine_hub.sql`: switch, `counts_fn`, achievements, measures; `supabase/tests/database/mine_hub.test.sql`; `src/pages/TeacherMine.tsx` and its test; `src/games/mine/index.tsx` with `TeacherPanels`), `TeacherMarble.tsx` (settings saved through `teacher_set_<game>()` with `require_settings_target()`), and `supabase/tests/database/game_hooks.test.sql` (the `hub_games` hooks).
5. Work only in this worktree, on branch `archery`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push with `git push origin archery`). Don't commit `dist-preview-archery/`.
6. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`), then run `node scripts/migration-numbers.mjs` for the next free migration number and write it in the plan. All Stage 7 database changes go in **one new migration**. Never edit an applied migration; check the plan whether James has applied any Archery migration live by then (if not, still use a new file).

## What to build

### 1. The teacher panel (`src/pages/TeacherArchery.tsx`)
- Copy `TeacherMine.tsx` / `TeacherMarble.tsx`: it gets the class picker's `classId`, reads through `readSettings`, saves through `teacher_set_archery(…)` and a new `teacher_set_archery_duels(enabled, target_class)` (new column `app_settings.archery_duels boolean not null default true`, added with `add column` only).
- Controls: **Archery Challenge on/off**, **Classmate fights on/off** (only meaningful while the game is on; say so).
- A small **class summary** only if it's cheap and useful (for example: pupils who played this week, fights finished, speed rounds); never coins compared between pupils on a pupil-facing screen. Ask James before adding anything bigger. A teacher function must use `require_teacher_of()` / `my_students()` so schools and classes never see each other.
- Put it in `index.tsx` as `TeacherPanels` (lazy, the Mine pattern). Optional `StudentPanel` only if James wants it.

### 2. The classmate-fights switch everywhere it matters
- `archery_here()` returns `duels: false` (and an empty list) while classmate fights are off for the pupil's class; the server refuses `duel-challenge`, `duel-answer` and `duel-pack` while it's off for either player's class (kind words, a `code` like `duels-off`). A fight already playing when it's switched off ends fairly, exactly like the main switch in Stage 6 (gear back to both, nobody gets points).
- The game hides **Challenge a classmate** (home and Pick screens) and any pop-ups while it's off. The preview gets a way to try this (a preview tool).
- Tests for all of it: handler, database, screens.

### 3. Achievements (plan section 8: "about 10")
- Through the `hub_games` hooks only (`counts_fn` returning `{ "<measure>": n }`, `achievement_measures`, `achievement_types` with `game = 'archery'`), copying Mine Runner's migration. Never re-create a shared function.
- Suggested list (propose the final list and names to James in the plan; build these unless he says otherwise): first win in each world (Forest, Desert, Snow, City); win a fight with only Plain Arrows; a perfect speed round (10 of 10 in time); own every bow; win a fight against a classmate; finish 10 classmate fights; win against Hawk (Hard).
- Every count must come from something the server saved (fights it replayed, rounds it marked, bows it sold), never from the browser. Add any columns or small tables you need to record it (for example `archery_players.stats jsonb`, updated inside the existing server-only functions or new ones). When counts change without points, call `game_progress_changed(player, 'archery')`.
- New Season: decide with the plan whether achievements stay (`keep_achievements`); say what you chose and why.

### 4. Simpler graphics and a slow-machine check
- Check the existing "Simpler graphics" setting and the automatic switch-down (plan section 10, Stage 2 results) still work in classmate fights and on the home scene.
- Measure frame times in headless Chromium with the processor slowed (a quarter and a sixth of full speed) on the bot fight **and** the classmate fight, at 1366 × 640. Write the numbers in the plan. Fix anything that drops well below 30 fps in simpler mode.

### 5. Accessibility pass
- Widen `Accessibility.test.tsx` to `TeacherArchery.tsx` and anything new. Shared buttons, focus moved to each heading, 44 px targets, contrast 4.5 : 1, reduced motion respected.
- Do a keyboard-only run through the whole game in headless Chromium (home → speed round → Armory → bot fight → classmate fight in the two-player preview → How to play) and fix anything that traps or loses focus.

### 6. The preview
- Keep both the one-player game and **Two players on this screen** working. Add a preview tool to switch classmate fights off for the pretend class. Publish to the **same** test-page Artifact so James's link keeps working: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3 (read it first, then publish with `url`). Check it in headless Chromium at 1366 × 640, 844 × 390 and 390 × 844 with zero network requests.

**Not in this stage:** the hub Lobby (Stage 6b, its own branch, after James OKs the shared changes); the target challenge (Stage 8); adding the game to `src/games/registry.ts` or anything else in the merge step; anything live.

## Before you say it's done
- Run `npx vitest run shared/archery src/games/archery src/data/archery.test.ts src/pages/TeacherArchery.test.tsx supabase/functions/archery` while you work. Then `npm run typecheck`, `npm run test:all` and `npm run build`. Rebuild only this function's bundle (`npm run build:functions -- archery`). Say plainly if anything fails, with the output (a busy-computer timeout that passes alone is fine to explain).
- Database tests on a throw-away copy (`scripts/scratch-db.sh`, `scripts/scratch-test.sh`, then drop it): the new migration's own file plus `archery.test.sql`, `archery_classmates.test.sql`, `game_hooks.test.sql`, `mine_hub.test.sql` and **`security.test.sql`** (update its lists for any new pupil- or teacher-callable function). Run it in the background if it's slow. `clans_fights.test.sql` and `maths_focus_results.test.sql` never fully pass on a copy; that's expected.
- Write **"Stage 7 results"** at the bottom of `docs/ARCHERY-PLAN.md`: what you built, the achievements list, the numbers you chose and why, frame times, the tests, what's untested, questions for James, and the go-live list (including `docs/PRIVACY-SUMMARY.md` lines for anything new stored).
- Commit, `git push origin archery`, and **stop for James**. Nothing goes live: no migration applied, no function deployed, no merge to `main`, no switching on.

When you stop, tell James in plain words what's ready, give him the test page link and how to try the new parts, and say what he needs to decide.

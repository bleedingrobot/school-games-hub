# Prompt: Sky Isles, going live (stage S.8)

Paste everything below the line into a new Claude session opened in `~/games-hub-isles` (branch `isles`).

---
You are continuing **Sky Isles** (short id `isles`, CSS prefix `.si-`), a cosy floating-island game with a maths question each turn, for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks. Ask him questions on clickable cards (AskUserQuestion), recommended option first.

## Step 0: quick check (1 minute)
Ask James on a card whether he has tried the preview (the private page in `docs/ISLES-COSY-PLAN.md`) and is happy, whether the paintings (stage C.A, `docs/prompts/isles-cosy-art.md`) are in, and which live steps he wants today. Then do **step 1 only** (pre-flight, nothing live) and stop for his word before step 2.

## Where things stand
- Built and tested on branch `isles` (pushed to `origin/isles`). Read `docs/GAME_DEVELOPMENT_GUIDE.md` sections 8 and 9, then `docs/ISLES-COSY-PLAN.md` (it wins over `docs/ISLES-PLAN.md`) and `docs/ISLES-RULES.md`.
- **Nothing is live.** Two migrations are written, tested on scratch copies, and listed in `supabase/migrations-on-hold.txt` so the live job skips them:
  - `20261102000100_isles.sql`: the tables (islands, turns, questions, races, post, news, Hall of the Skies), the server-only functions, the switches `app_settings.isles_enabled` (off) and `isles_races` (on), the hooks, 8 achievements, island names, the teacher's reports and island reset.
  - `20261103000400_isles_home_chip.sql`: an exact in-place edit of the shared `my_moves_left()` for the home page's "turns left" chip (James said yes, 3 Nov 2026). It refuses to run if the text it edits has changed on `main`.
- The `isles` function (`supabase/functions/isles/index.ts`) is built, not deployed. It deploys by itself when its `index.ts` reaches `main`.
- The **code switch** is `ON = false` in `src/games/isles/switch.ts`, and the game is **not yet in `src/games/registry.ts`**. The teacher contract (switch, Sky Races, class report, student panel, Hall of the Skies) is in `src/games/isles/index.tsx` and `src/pages/TeacherIsles.tsx`.
- It depends on `20261020000100_game_hooks.sql` (hub_games), `space_maths_context`, `record_fact_answers` (through `recordMathsAnswers`), `settings_of`, `require_settings_target`, `require_teacher_of`, `teaches_class`, `current_class_of`, `add_game_points`. Check, don't assume (step 1).
- Requests: about 25 a pupil a day (6 turns × 2, 2 races × 5, a few loads, the class sky); a class of 28 every school day is about 3,500 a week.

## Rules
- **Merging to `main` makes things live** (migrations not on hold are applied, changed functions deployed, the site published). Taking a number off the on-hold list, merging, and switching things on each need James's yes, in words, in this session. Ask once, plainly, before each, and say exactly what will happen. Approval for one step is not approval for the next.
- Never `supabase db reset` (use `scripts/scratch-db.sh`). Push only with `git push origin isles` until the merge step.
- Build only this function: `npm run build:functions -- isles`. If another function's `index.ts` changes, `git checkout` it.
- Don't commit `dist-preview-isles/`. Say plainly about any failure.

## The steps
1. **Pre-flight (nothing live).**
   - `git fetch`, merge `origin/main` into `isles`. Run `node scripts/migration-numbers.mjs`. `20261102000100` is older than many migrations on `main` now, so **rename both Sky Isles migrations to the next free numbers after everything on `main`** (the chip one must come after the isles one), and update `migrations-on-hold.txt`, the chip migration's "Depends on" line, `movesLeft.ts`'s comment, this prompt and the plans.
   - If any newer migration on `main` changed `my_moves_left()`, check the chip edit still matches (step 1's scratch copy will tell you: it stops with "did not match exactly once").
   - Update the shared database tests for Sky Isles: `security.test.sql` (add to the signed-in list: `teacher_set_isles`, `my_isles`, `isles_sky`, `teacher_isles_class`, `teacher_isles_student`, `teacher_reset_isles`, `teacher_isles_halls`) and `progress_access.test.sql`'s achievement count (+8 for Sky Isles; it was 112 on 3 Nov 2026, so 120 if nothing else changed). Both fail on a scratch copy with Sky Isles in it until then.
   - Sky Isles has 8 tests (the most a game may have): don't add more.
   - `npm run typecheck`, `npm run test:all` (folder by folder if the machine runs short of memory), `npm run build`, `npm run isles:sim -- --runs 300`.
   - Database checks on a scratch copy: `scripts/scratch-db.sh isles` then `scripts/scratch-test.sh isles` (all files; say which failures were already there on `main`). Drop it after: `docker exec supabase_db_school-games-hub psql -U postgres -c 'drop database isles'`. If the shared local copy already has an old Sky Isles migration, the copy won't re-apply it: drop the old isles objects in the scratch copy first and apply the file by hand there (never in the shared copy).
   - Ask the live database (read-only, through the Management API with the keychain token, as the memory note "Live DB queries" says): `select to_regclass('public.hub_games')`, the `to_regprocedure(...)` of each function in "depends on" (all a name), and `select to_regclass('public.isles_islands')` (null: not applied yet).
   - Tell James the results and stop.
2. **Go live, switched off** (James's yes): take both Sky Isles numbers off `supabase/migrations-on-hold.txt`, add `isles` to the end of `FUNCTIONS` in `scripts/build-functions.mjs`, add the game to the end of `GAMES` in `src/games/registry.ts` behind `islesOn()` (`...(islesOn() ? [skyIsles] : [])`), and add the merge-step lines to `docs/PRIVACY-SUMMARY.md` (what's kept: islands, turns, the questions' marks, races, gifts, news, the Hall; nothing about maths shown to classmates) and `shared/README.md`. Open a pull request and merge it once its checks pass (James has said to merge his PRs once green). The code switch stays off, so pupils see nothing.
3. **Check after the merge:** "Test and publish" went green; `isles_islands` exists and is empty; `select count(*) from public.app_settings where isles_enabled;` is 0; one `hub_games` row `isles`; 8 `isles-` achievements; `my_moves_left()` mentions `isles_islands`; an unsigned `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/isles` answers 401 "Please sign in again.", not a crash or 404.
4. **Check from outside.** As a pupil (or the anon key): `select * from public.isles_islands` refused (42501), `public.isles_load(...)` refused; `select count(*) from public.scored_games;` not smaller than before.
5. **The code switch** (James's yes, its own small PR): `ON = true` in `src/games/isles/switch.ts`, and `isles` with group `complex-maths` in `src/games/registry.test.ts`. Teachers can then open `/#/isles` and the Teacher page shows Sky Isles (off for every class).
6. **Try it live as a teacher**, then James switches it on for his class on the Teacher page (or, if he asks, every class at once with the Supabase connector: set only `isles_enabled`).
7. **The card picture,** if James has painted one: `isles.webp` and `isles-small.webp` in `src/assets/home/`, and one `ART` line in `src/components/gameCardArt.ts`.
8. **Write it down:** a "went live" note in `docs/ISLES-COSY-PLAN.md` and the Status line of `docs/ISLES-PLAN.md`, update the memory note, add Sky Isles to the players tracker's query (memory note "Players tracker"). Then stop for James's feedback.

**Turning it off again,** gentlest first: the teacher switch (the server refuses requests while it's off); the code switch `ON = false`; delete the function in the Supabase dashboard. Don't drop tables: write a new migration if something must change.

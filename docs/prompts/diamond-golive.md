# Diamond Drop: go-live

Branch `claw`, worktree `~/games-hub-claw`. Follow docs/GAME_DEVELOPMENT_GUIDE.md section 8. **Ask James on a card before each live step**; reply in plain words.

## 0. Pre-flight (nothing live)
1. `git fetch origin && git merge origin/main` (don't rebase). Fix conflicts.
2. `node scripts/migration-numbers.mjs`: if `20261102000200` is taken or anything on `main` is newer, rename `supabase/migrations/20261102000200_diamond.sql` to the next free number (and the line in `supabase/migrations-on-hold.txt`).
3. Check the live database has what the migration uses: `hub_games`, `achievement_measures`, `add_game_points`, `game_progress_changed`, `space_maths_context`, `settings_of`, `gem_keep_check_player`, `require_settings_target`, `settings_to_change`, `teaches_class`, `my_students`, `require_teacher_of`, `is_school_user`, `my_school`, `nz_day` (`select to_regproc('public.<name>')`).
4. `scripts/scratch-db.sh diamond`, `scripts/scratch-test.sh diamond supabase/tests/database/diamond.test.sql` (expect 30 ok), and `game_hooks.test.sql`; drop the copy.
5. `npm run build:functions -- diamond`, `npm run check`.

## 1. Merge-step edits (one PR)
- `src/games/registry.ts`: import `diamondDrop` and `diamondOn`, append `...(diamondOn() ? [diamondDrop] : [])` to the end of `GAMES`.
- `scripts/build-functions.mjs`: add `'diamond'` to the end of `FUNCTIONS`.
- Take `20261102000200` out of `supabase/migrations-on-hold.txt` (this is what makes the migration and function go live on merge).
- `docs/PRIVACY-SUMMARY.md`: Diamond Drop stores each pupil's progress (levels, coins, stars, Gem Book, claw upgrades), each level's seed, Drop times, questions and right/wrong marks (ended levels deleted after 30 days), and the date they found the Heart Diamond. Classmates see only display name, date and claw in the Hall. Answers recorded like other games (right/wrong, never shown to classmates).
- `shared/README.md`: a line for `shared/diamond/`. `docs/PLAN.md`: the migration note.
- Switch stays OFF (`ON = false`), id not yet in `registry.test.ts`. James chose the easy maths group for the dashboard (2 Nov 2026).

## 2. After the merge
- "Test and publish" green; the three tables exist and are empty; `diamond_enabled` false everywhere; unsigned `curl -X POST …/functions/v1/diamond` answers 401.
- As a pupil: `select * from diamond_levels` refused (42501); `select diamond_load(auth.uid())` refused.
- `select count(*) from public.scored_games;` not smaller than before.

## 3. Try it as a teacher (pupils still off)
Open `/#/diamond` on the live site with `VITE_DIAMOND_ON` builds, or once the code switch is on: play level 1 (guided first go), a Hold on! question, the shop, the Workshop, the Hall, How to play. Check the Games table row and a student's page.

## 4. Switch on (James's OK, its own small PR)
`ON = true` in `src/games/diamond/switch.ts` **and** `diamond` (group `easy-maths`) in `src/games/registry.test.ts`. Then the teacher switch on the Teacher page (or every `app_settings` row with the connector, `diamond_enabled` only, if James asks).

## 5. Write it down
"Went live" in docs/DIAMOND-PLAN.md, the memory note, and add `diamond` to the players tracker's query.

## Rollback
Teacher switch off → code switch off → delete the function. Never drop the tables.

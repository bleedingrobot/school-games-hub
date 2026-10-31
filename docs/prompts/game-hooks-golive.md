# Prompt: points hooks for new games, going live

Paste everything below the line into a new Claude session in `~/projects/school-games-hub-points-hooks` (branch `points-hooks`).

---

You are putting the **points hooks** live in James's School Games Hub (games for his Year 4–6 class). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks. Read `docs/GAME_DEVELOPMENT_GUIDE.md` sections 5 and 10 first.

## What it is
Migration `supabase/migrations/20261020000100_game_hooks.sql` lets a new game have points and achievements by **adding rows and its own functions**, instead of re-creating shared functions:
- a games list (`hub_games`) and a measures list (`achievement_measures`) replace three lists of allowed values;
- one shared points table (`game_points`, given points by `add_game_points()`), scored inside the 40-a-day cap;
- small, exact in-place edits to `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students` and `teacher_new_season`, so they call each new game's hooks. Each edit must match exactly once, or the whole migration stops and changes nothing.

No existing game changes. Until a new game registers in `hub_games`, pupils and teachers see exactly what they see today. The website part (How points work shows a new game's own sentences) is harmless before or after the migration.

## Rules
- Applying the migration and merging to `main` touch the live site. **Only do each if James says so, in words, in this session.** One step at a time.
- `points-hooks` sits on top of `guide-fixes`. Merge `guide-fixes` to `main` first (or together, if James says so).
- Never `supabase db reset`. Test on throw-away copies (`scripts/scratch-db.sh`).

## Steps
1. **Pre-flight (nothing live).** `git fetch`. Merge `origin/main` into the branch, then run `node scripts/migration-numbers.mjs` and renumber the migration if anything newer has arrived. If a newer migration re-created one of the six functions, or `scored_games_check`, check the edits still match on a copy. Run `npm run typecheck`, `npm run test:all` and `npm run build`. Then build two throw-away copies, one at main's newest migration and one with Bond Match's `20261019001000_bond_match.sql` added (the live database has it), apply this migration to each with `psql -1` (one transaction), and run `scripts/scratch-test.sh` on both. Expect only the three failures a copy always has: two Clan Quest midnight-job checks, and `maths_focus_results` check 42.
2. **Save today's live definitions** (read only), so they can be put back: for each of the six functions, `select pg_get_functiondef('public.<name>(<args>)'::regprocedure);` plus `select pg_get_constraintdef(oid) from pg_constraint where conname in ('scored_games_check', 'scored_games_game_check', 'achievement_types_game_check', 'achievement_types_measure_check');`. Keep them in the scratchpad, not in git.
3. **Apply** (James's yes): `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261020000100_game_hooks.sql`. It runs as one statement batch. If it stops with "did not match exactly once", nothing has changed: tell James and look at what the live function has.
   *Check:* `select count(*) from public.hub_games;` is at least 10; `select count(*) from public.achievement_measures;` is at least 45; as a pupil, How points work and the home page look the same as before; `select count(*) from public.scored_games;` is not smaller than before.
4. **Merge to `main`** (James's yes), then watch "Test and publish" go green.
5. **Write it down:** the number in the `migration repair` note at the bottom of `docs/PLAN.md`, a "went live" line in the guide's section 10, and the memory note.

## Undo
Put back the six function definitions and the four constraints saved in step 2 (each `CREATE OR REPLACE FUNCTION …` runs as is). Then drop the foreign keys `scored_games_game_fkey`, `achievement_types_game_fkey` and `achievement_types_measure_fkey`, and the column `scored_games.game_points`. The three new tables can stay (nothing reads them) or be dropped once no game uses them.

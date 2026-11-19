Goblin Storm stage 7: go live.

Read docs/game-guide/README.md first (especially the testing and going-live part), then docs/GOBLINSTORM-PLAN.md: the whole plan, especially "Stages", and the results sections for stages 3 to 6 (each ends with what stage 7 must also do). Stages 1 to 6 and 8 (the painted art) are merged:
- the seeded engine is in shared/goblinstorm/ (fingerprint `67a677c4`); the server is shared/goblinstorm/server.ts and supabase/functions/goblinstorm/
- the game and the no-sign-in preview are in src/games/goblinstorm/ and preview/goblinstorm/
- effects, sounds, Bella's voice (public/voice/goblinstorm/), the guided first go and the effects setting are in (stage 6)
- migration 20261119000900 is still ON HOLD, and the code switch is off

Use the worktree /Users/jriley/games-hub-goblinstorm on a fresh branch claude/goblinstorm-7 from origin/main (if the worktree is gone, make one). Never commit to main.

**PR 1: the go-live PR** (fill in docs/game-guide/templates/golive-pr.md as the PR body; every box ticked or explained):
1. Take the migration's line out of `supabase/migrations-on-hold.txt`.
2. Recopy `teacher_progress_other_games` into the migration if any migration after 20261114000300 changed it (grep supabase/migrations for it; copy the newest body and keep the Goblin Storm block).
3. Check the migration still runs last: if a newer migration has landed on main since 20261119000900, renumber ours to come after it (docs/game-guide: migration numbers).
4. Register the game on the hub, switched ON (code and every class; memory note switches-on-by-default):
   - add `goblinstorm_enabled` to `GAME_SWITCH_COLUMNS` (src/data/games.ts) and the game to `GAMES`, with its home card from the art plan's config.json
   - add `goblinstorm` to `UNLIMITED_GAMES` (shared/unlimited.ts, src/data/unlimitedTurns.ts) and to `teacher_set_unlimited_today` in the migration
   - pass `onServer` to `GoblinStormGame` on the hub
   - add the "Goblin Storm" Progress column with `useGoblinStormCells` (src/games/goblinstorm/teacher.ts)
   - the board (`GoblinStormBoard`) shows once the game is in `GAMES`: check it does
5. Add a "What's new" line to src/news/hubNews.ts (memory note whats-new-box).
6. Add Goblin Storm to the players tracker query (memory note players-tracker).
7. Database tests on a clean copy (scripts/scratch-db.sh fails on this Mac; memory note local-db-stale): a new database in supabase_db_school-games-hub with the cron stand-in, restore `pg_dump --schema-only --no-owner -N public -N cron postgres`, apply every migration without `create extension if not exists pg_cron` (run the loop in bash, not zsh), add today's `realtime.messages` partition, then `scripts/scratch-test.sh <name> supabase/tests/database/goblinstorm.test.sql supabase/tests/database/security.test.sql` plus any test that lists every game (progress_access, unlimited, game switches). Drop the copy.
8. Run typecheck, test:changed and build (the Glyph errors on this Mac are a filename-case clash, not ours), `npm run goblinstorm:determinism` (`67a677c4`) and `npm run build:functions -- goblinstorm`.
9. Open the PR and merge it when checks pass (memory note always-merge-prs). The migration goes live with the merge as the go-live steps in the game guide say; follow them exactly, and ask James on a card before applying anything to the live database by hand.

**After the merge** (the guide's after-merge checks):
- the migration is in the live history; `goblinstorm_enabled` is on for every class; the function is deployed and answers
- sign in as a test pupil only if the guide says how; otherwise check the hub with the live site: the home card shows, a run starts, a level-up question shows, the run checks out at the end, gold and the save update, Bella's clips load (no 404s for voice/goblinstorm/), the board and the teacher column show
- never save test data live

**PR 2: the code switch**: set `GOBLINSTORM_ON = true` in src/games/goblinstorm/switch.ts (after PR 1 is merged and checked live). Merge when checks pass.

Afterwards:
- update the plan's Status line and fill in "Went live"
- update the memory note goblin-storm and its MEMORY.md line (LIVE, the date, the PR numbers; "not yet in the players tracker" only if step 6 couldn't be done)
- delete the branch

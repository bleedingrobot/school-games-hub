Goblin Storm stage 5: gold shop, Weapon Codex, achievements, trophy, hall of fame, teacher column, points.

Read docs/game-guide/README.md first, then docs/GOBLINSTORM-PLAN.md: the whole plan, especially Design points 4–5, the "Lesson fit / Teacher / Rewards" paragraph, "Achievements in full", "Season", and the results sections for stages 2 to 4. Stages 1 to 4 are merged:
- the seeded engine is in shared/goblinstorm/
- the game and the no-sign-in preview are in src/games/goblinstorm/ and preview/goblinstorm/ (`?open=all` opens every hero and map)
- the server is shared/goblinstorm/server.ts and supabase/functions/goblinstorm/
- unlocks are checked on the server in `newUnlocks` and `record_goblinstorm_run`
- `my_goblinstorm()` gives the screens the pupil's own save
- the balance sim is `node scripts/goblinstorm-sim.mjs`
- migration 20261119000900 is still ON HOLD, and the code switch is off

Don't change how the engine works without a reason written in the plan. Any change to replay rules must keep `npm run goblinstorm:determinism` at `67a677c4`, or else record the new fingerprint in the plan with the reason. Install `playwright` in the scratchpad and set `PLAYWRIGHT_DIR` to check WebKit and Chromium too. The cached Chromium needs `CHROMIUM_PATH` set to the "Google Chrome for Testing" binary in ~/Library/Caches/ms-playwright/chromium-1255.

Use the worktree /Users/jriley/games-hub-goblinstorm on a fresh branch claude/goblinstorm-5 from origin/main (if the worktree is gone, make one). Never commit to main.

Build stage 5:
1. **Gold shop** between runs: Might, Armour (max 3), Speed, Max health, Magnet, Gold, each with 5 levels.
   - The costs are `SHOP_COSTS = [100, 200, 350, 550, 800]`, set by the stage 4 sim. The whole shop is 10,650 gold, and a steady player has spent about 6,100–6,650 by the time all 5 bosses are beaten.
   - Buying goes through the server: a security definer `buy_goblinstorm(item)` (authenticated, own save only, checks gold and the max level, all in one locked update), or an action on the function. Pick one and say why in the plan.
   - **Gap to fix:** `finish` replays with the save's shop *at finish time* (server.ts, `replayRun({ … shop: save.shop })`), but the browser plays with the shop it had at start. Buying between start and finish (another tab) would make a valid run fail. Keep the shop on the run row at `start` (and send it in the start reply for the browser) and replay with that. Add a server test for it.
   - Once everything is bought, show gold as "best haul" only.
   - Re-run the sim's journey with the real shop and write the numbers in the plan.
2. **Weapon Codex:** 8 weapons + 8 evolutions, filled from `goblinstorm_saves.codex`.
   - It needs every weapon seen, not just evolutions, so decide what fills it. Evolutions are already saved; weapons picked would need the summary to carry them, which is a replay change, so record the reason.
   - Each pair shows its partner passive. Show codex x/16 on the map screen.
3. **Achievements** (the plan's table): First Storm, It Evolves!, King Slayer, Hero Collector, Storm Master.
   - Copy the `hub_games` rows, `achievement_measures`, `counts_fn`, `rules_fn`, `players_fn` and `last_played_fn` from Toon Flap.
   - `season_fn = null`, `keep_achievements = true`.
   - The result screen uses `<AchievementPop>`.
4. **Trophy:** a `trophy_types` row "Goblin King's Crown" ("Beat the Goblin King in Goblin Storm"), awarded by trigger as in migration 20261112001700. It is never for maths. Use `<TrophyWonLine>` on the end screen.
5. **Hall of fame:** own school, pupils only (no teachers or hidden profiles), on the 🎮 Game boards tab. Show bosses beaten and best runs, never maths.
6. **Teacher column:** "Other games" shows bosses beaten, "zz" if not played, and last played.
7. **Points:** `add_game_points(player, 'goblinstorm', points, seed)`, 5 for a finished run and +5 for a boss win.
   - Normal turns only, within the 40-a-day cap.
   - Writes a `scored_games` row.
   - Extra (Unlimited today) turns give gold but no points.

Put every database change in the same on-hold migration 20261119000900 (it isn't live, so editing it is fine). Add checks to supabase/tests/database/goblinstorm.test.sql, and add any new pupil-callable function to the `security.test.sql` allow-list.

Still don't register the game on the hub or take the migration off hold. That's stage 7, which must also:
- add `goblinstorm_enabled` to `GAME_SWITCH_COLUMNS`
- add `goblinstorm` to `UNLIMITED_GAMES` and `teacher_set_unlimited_today`
- take the line out of `supabase/migrations-on-hold.txt`

Database tests: `scripts/scratch-db.sh` fails on this Mac. Use the clean-copy method in the memory note local-db-stale:
- make a new database in supabase_db_school-games-hub with the cron stand-in
- restore `pg_dump --schema-only --no-owner -N public -N cron postgres`
- apply every migration, leaving out `create extension if not exists pg_cron`
- run `scripts/scratch-test.sh <name> supabase/tests/database/goblinstorm.test.sql supabase/tests/database/security.test.sql`
- drop the copy

Two things to know from stage 4:
- Act as the server (`pg_temp.act_as_server()`) only for the server-only calls, and `pg_temp.reset()` before reading tables directly.
- Write text array literals as `'x'::text` when appending.

Run typecheck, test:changed and build. On this Mac the Glyph errors are a filename-case clash that isn't ours. Rebuild the function after any change to shared code it uses (`npm run build:functions -- goblinstorm`). Check the screens with Playwright from the scratchpad (`--use-angle=metal`, the dev server on its own port, `window.__goblinstorm.skip(n)` to jump ahead), not the hidden Browser pane. Open the PR and merge it when checks pass. Never apply the migration to the live database.

Afterwards:
- update the plan's Status line and add a "Stage 5 results" section
- update the memory note goblin-storm
- write the stage 6 prompt (effects pass, sounds, Bella voice, guided first go, quality settings, the 2 screen tests) in docs/prompts/goblinstorm-stage6.md

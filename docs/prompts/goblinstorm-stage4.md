Goblin Storm stage 4: hero picker and unlocks, map picker, all bosses, balance sim.

Read docs/game-guide/README.md first, then docs/GOBLINSTORM-PLAN.md (the whole plan, especially Content, the Decisions table, and "Stage 2 results" and "Stage 3 results"). Stages 1 to 3 are merged:
- the seeded engine is in shared/goblinstorm/
- the playable game and the no-sign-in preview are in src/games/goblinstorm/ and preview/goblinstorm/
- the server is shared/goblinstorm/server.ts and supabase/functions/goblinstorm/
- migration 20261119000900 is ON HOLD, and the code switch is off

Don't change how the engine works without a reason written in the plan. Any change to replay rules must keep `npm run goblinstorm:determinism` stable, or else record the new fingerprint in the plan with the reason.

Use the worktree /Users/jriley/games-hub-goblinstorm on a fresh branch claude/goblinstorm-4 from origin/main (if the worktree is gone, make one). Never commit to main.

Build stage 4 from the plan's Stages table:
1. **Hero picker.** Show all 8 heroes, each with its speed, health and starting weapon. Locked heroes show how to unlock them. Only Knight and Ranger are open at first; `heroOpen` in server.ts decides.
2. **Unlocks.** Save them in `goblinstorm_saves.heroes` through `record_goblinstorm_run`:
   - Change the function in the same on-hold migration 20261119000900. It isn't live, so editing it is fine.
   - Check the unlock rule on the server from the replay's summary, never from what the browser says.
   - Add `my_goblinstorm()` (authenticated, reads only the caller's own save) so the screens can show gold, heroes and bosses. Put it on the `security.test.sql` allow-list, and add checks to supabase/tests/database/goblinstorm.test.sql.
3. **Map picker.** Show all 5 maps. A map opens when the boss of the map before it is beaten; `mapOpen` in server.ts decides.
4. **All bosses.** Each map gets its own mini-boss and boss from config.ts, with drawn stand-ins (art is stage 8).
5. **Balance sim** `scripts/goblinstorm-sim.mjs`. It uses `botRun` with sensible steering, not standing still. Tune the map tiers, the gem curve and the wave sizes. Aim for:
   - about 15 to 25 level-ups a run (only every 3rd one asks a question: `ASK_EVERY`, about 6 to 8 questions)
   - map 1 beatable on day 1
   - later maps needing shop upgrades and better heroes
   - **A Ranger standing still fell at 0:14 in stage 2, while one who moved lasted 0:50.** That's harsh for a first go, so soften the first 30 seconds of map 1.
   - Write the sim's numbers into the plan.

Still don't register the game on the hub or take the migration off hold. That's stage 7, which must also:
- add `goblinstorm_enabled` to `GAME_SWITCH_COLUMNS`
- add `goblinstorm` to `UNLIMITED_GAMES` and `teacher_set_unlimited_today`
- take the line out of `supabase/migrations-on-hold.txt`

Database tests: `scripts/scratch-db.sh` fails on this Mac. Use the clean-copy method in the memory note local-db-stale, then `scripts/scratch-test.sh <name> supabase/tests/database/goblinstorm.test.sql supabase/tests/database/security.test.sql`, then drop the copy.

Run typecheck, test:changed and build. On this Mac the Glyph errors are a filename-case clash that isn't ours. Rebuild the function after any change to shared code it uses (`npm run build:functions -- goblinstorm`). Open the PR and merge it when checks pass. Never apply the migration to the live database.

Afterwards:
- update the plan's Status line and add a "Stage 4 results" section
- update the memory note goblin-storm
- write the stage 5 prompt (gold shop, Weapon Codex, achievements, trophy, hall of fame, teacher column, points) in docs/prompts/goblinstorm-stage5.md

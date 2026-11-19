Goblin Storm stage 6: effects pass, sounds, Bella voice, guided first go, quality settings, the 2 screen tests.

Read docs/game-guide/README.md first, then docs/GOBLINSTORM-PLAN.md: the whole plan, especially Design point 7 (the guide table and the paragraph after it), the question-modal points (Bella reads the question, the answer clock starts when she finishes), "Files", "Tests", and the results sections for stages 2 to 5. Stages 1 to 5 are merged:
- the seeded engine is in shared/goblinstorm/ (fingerprint `67a677c4`)
- the game and the no-sign-in preview are in src/games/goblinstorm/ and preview/goblinstorm/ (`?open=all` opens every hero and map, `?gold=2000` gives gold for the shop)
- the server is shared/goblinstorm/server.ts and supabase/functions/goblinstorm/
- the gold shop, Weapon Codex, points, achievements, the Crown trophy, the board and the teacher column are in (stage 5)
- all 81 pictures are painted and swapped in (stand-ins stay as fallbacks)
- migration 20261119000900 is still ON HOLD, and the code switch is off

Use the worktree /Users/jriley/games-hub-goblinstorm on a fresh branch claude/goblinstorm-6 from origin/main (if the worktree is gone, make one). Never commit to main.

Build stage 6:
1. **Effects pass:** make the attacks look amazing (the pupils asked for this most): evolution screen-wipes, hits, gem pickups, level-up glow, boss arrivals. Draw-only: never change the engine or the replay. Keep `npm run goblinstorm:determinism` at `67a677c4`. Respect reduced motion.
2. **Sounds:** use the hub's sound system (src/games/sounds, `useSound`), with the game's own sound button. Hits, pickups, level-up, evolution wipe, boss warning, win and fall. Not too loud or too many at once: cap sounds per frame.
3. **Bella voice** (memory note kokoro-voice: Kokoro af_bella clips made on the Mac): `voiceLines.ts` and the clips in public/voice/goblinstorm/. Bella reads the level-up question, and the answer clock starts when she finishes (`speak(…, 'goblinstorm', onEnd)`). She also reads the guide lines.
4. **Guided first go** on Castle Fields, as the plan's guide table says. It can be skipped and has a "Replay the guide" button. Who has seen it is kept in the server's save (a new column in the on-hold migration, set by a pupil-callable function or the function's start/finish; if it's a new pupil-callable function, add it to the `security.test.sql` allow-list and add checks to goblinstorm.test.sql). Use `FirstTimeTip` for first-time tips, and "Show me" on the next-step line. It never helps with the maths answer.
5. **Quality settings:** a low/high setting (fewer particles and glow on low) and an automatic drop when frames are slow. Kept on the device.
6. **The 2 screen tests** (the test budget is 8; 4 server tests and 3 rule tests are used, so check the count first and fold where needed): a level-up shows the question then the right number of cards (2 wrong, 3 right, 4 quick); the voice-lines test (copy another game's voiceLines.test.ts).

Every database change goes in the same on-hold migration 20261119000900. Never apply it live.

Still don't register the game on the hub or take the migration off hold. That's stage 7, which must also:
- add `goblinstorm_enabled` to `GAME_SWITCH_COLUMNS`
- add `goblinstorm` to `UNLIMITED_GAMES` and `teacher_set_unlimited_today`
- take the line out of `supabase/migrations-on-hold.txt`
- pass `onServer` to `GoblinStormGame` and add the Progress column with `useGoblinStormCells`
- recopy `teacher_progress_other_games` into the migration if another migration changed it since 20261114000300

Database tests: `scripts/scratch-db.sh` fails on this Mac. Use the clean-copy method in the memory note local-db-stale:
- make a new database in supabase_db_school-games-hub with the cron stand-in
- restore `pg_dump --schema-only --no-owner -N public -N cron postgres`
- apply every migration, leaving out `create extension if not exists pg_cron`
- add today's `realtime.messages` partition if security.test.sql says "no partition of relation messages"
- run `scripts/scratch-test.sh <name> supabase/tests/database/goblinstorm.test.sql supabase/tests/database/security.test.sql`
- drop the copy

Run typecheck, test:changed and build. On this Mac the Glyph errors are a filename-case clash that isn't ours. Rebuild the function after any change to shared code it uses (`npm run build:functions -- goblinstorm`). Check the screens with Playwright from the scratchpad, not the hidden Browser pane:
- install `playwright-core` in the scratchpad and set `CHROMIUM_PATH` to the "Google Chrome for Testing" binary in ~/Library/Caches/ms-playwright/chromium-1255; launch with `--use-angle=metal`
- run the preview on its own port (`npx vite --config vite.goblinstorm-preview.config.ts --port 5193`)
- `window.__goblinstorm.skip(n)` jumps ahead, but its 3-card picks don't match the replay, so a skipped run "doesn't check out"; for a run that must check out, skip only a few seconds and leave
- check the frame rate with effects on high, at 1366×640 and 390×844

Open the PR and merge it when checks pass.

Afterwards:
- update the plan's Status line and add a "Stage 6 results" section
- update the memory note goblin-storm
- write the stage 7 prompt (go live: `templates/golive-pr.md` ready check, take the migration off hold, the after-merge checks, then the code switch PR) in docs/prompts/goblinstorm-stage7.md

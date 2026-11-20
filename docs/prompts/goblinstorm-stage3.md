Goblin Storm stage 3: the server.

Read docs/game-guide/README.md first (then its server, maths-questions and migrations parts), then docs/GOBLINSTORM-PLAN.md (the whole plan, especially "Server, data and cost", the Decisions table, and "Stage 2 results"). Stages 1 and 2 are merged: the seeded engine is in shared/goblinstorm/, and the playable game and the no-sign-in preview are in src/games/goblinstorm/ and preview/goblinstorm/. Don't change how the engine works without a reason written in the plan.

Use the worktree /Users/jriley/games-hub-goblinstorm on a fresh branch claude/goblinstorm-3 from origin/main (if the worktree is gone, make one). Never commit to main.

Build stage 3 from the plan's Stages table:
1. **Function `supabase/functions/goblinstorm/`.** Copy the shape of an existing way A game (look at archery and diamond). It needs the same three calls as `GoblinStormBackend` in src/games/goblinstorm/backend.ts, so the screens don't change:
   - `start`: check the teacher switch and the 5-runs-a-day limit, stamp a seed, and make and store up to 40 questions from the pupil's own maths focus (way A: the server makes and marks them; the browser never sees answers).
   - `answer`: mark a slot once (the first answer counts), and say wrong, right or quick (`quickMsForPack`).
   - `finish`: decode the steering, replay with `replayRun` using the choice counts from the server's own marks (`choicesFor`), refuse runs faster than real time (95%), and save only what the replay says.
2. **Way A maths** through shared/maths/serverQuestions.ts, as the other way A games do. Record each answer the normal way, so the pupil's maths progress counts.
3. **Migration, on hold.** Tables `goblinstorm_saves`, `goblinstorm_runs` and `goblinstorm_questions`, with RLS on and no pupil grants. `goblinstorm_questions` has no policy at all. Add the functions `goblinstorm_store_questions`, `_load_questions`, `_claim_answer` and `record_goblinstorm_*`. Put every new `authenticated` function on the `security.test.sql` allow-list. Number `20261119000900`, but recheck it against origin/main first. Add the number to `supabase/migrations-on-hold.txt`. Never apply it to the live database in this stage.
4. **Real backend** in src/games/goblinstorm/ that calls the function, and a `switch.ts` with the code switch still off. The preview keeps `standInBackend`.
5. **The 3 server tests** from the plan: refusals (switch off, 6th run, too fast, another pupil's seed); a slot marked once and recorded; a test that runs every `LADDER` skill (copy shared/archery/server.test.ts). Add supabase/tests/database/goblinstorm.test.sql.
6. Add the function to `FUNCTIONS` and any other shared one-line lists the guide names for a new function.

Don't register the game on the hub yet (that's with the hero/map stage or go-live). Run typecheck, test:changed and build. On this Mac the Glyph errors are a filename-case clash that isn't ours. Open the PR and merge it when checks pass; still ask before applying any migration to the live database by hand.

Afterwards: update the plan's Status line and add a "Stage 3 results" section, update the memory note goblin-storm, and write the stage 4 prompt (hero picker and unlocks, map picker, all bosses, balance sim, including the "standing still falls at 0:14" note) in docs/prompts/goblinstorm-stage4.md.

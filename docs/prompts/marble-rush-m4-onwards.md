# Prompt: Marble Rush, pick up at M.4 (saving) and carry on to live

Paste this into a new chat to continue the build. Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

---
You're continuing Marble Rush, a game for James's School Games Hub (Year 4-6 class, Douglas Park School). An earlier session built stages M.1 to M.3 and stopped part-way into M.4 when James said "pause".

## Where things are

- Code: worktree `~/projects/school-games-hub-marble`, branch `marble`, pushed to origin. Work only there. Other sessions use the main checkout and other worktrees: don't touch them, never use bare `git stash`, careful with `pkill -f`. `main` has had no Marble code merged yet.
- **Read first:** docs/MARBLE-PLAN.md (approved plan; the maths section 7 has an "Update, 18 Oct 2026 (evening)" box saying every question comes from the shared maths focus system), then docs/MATHS-FOCUS-PLAN.md, shared/README.md and the memory notes school_games_hub.md, maths_focus_plan.md.
- **Done and pushed:**
  - M.1 engine in `shared/marble/` (physics, replay, inputs codec, clock modes, timed hazards, reference bot, six NZ courses drawn by `scripts/marble-courses.py`, medal times in `scripts/marble-medals.json`). Same run gives identical results in Node, Chromium and WebKit (`npm run marble:determinism`; set `PLAYWRIGHT_DIR` to a folder with playwright installed; WebKit and its system libraries are already installed on this server).
  - M.2/M.3 screens in `src/games/marble/` (three.js, lazy loaded, picker, run screen, touch stick, per-course colours). The game is behind `marbleOn()` in `src/games/marble/switch.ts`, currently **false**, so it has no dashboard card or page. `npm run marble:preview` builds a stand-alone page; `npm run marble:sim` prints reference times.
  - Tests: engine, courses, determinism, controls, bests, picker and run screen all pass. The whole suite passed (135 files) before M.3; re-run it.
- **Not done:** saving (M.4), ghosts and boards (M.5), maths (M.6, M.7), How to play and accessibility pass and go live (M.8). No migration written, no server function written.

## Decisions already made (keep them unless James says otherwise)

- **Stand-alone saving.** Don't rewrite shared scoring code (`score_bot_game`, `progress_counts`, `progress_rules`, `my_progress`): other games and the maths-focus branch also change those, and a merge would be risky. Marble gets its own tables, its own database functions and its **own edge function called `marble`** (not a branch of `save-bot-game`). **No points and no achievements in the first live version**; say so plainly to James and note it in the plan.
- Migration number: `20261018002800_marble.sql` or later (F.3's is 002700 on branch `maths-focus`, not on main).
- Plan for M.4, copying the Training pattern (`supabase/migrations/20261018002200_training.sql`, `supabase/functions/training/`):
  - Tables `marble_runs` (stats per run, no inputs) and `marble_bests` (one best per student, course, mode and maths flag, **with the inputs** so it can be a ghost), both closed to the website (row security on, `revoke all` from anon and authenticated).
  - `record_marble_run(...)` for the server only: school user check, a seed saves once, daily cap (54000 error), keeps the best.
  - Read functions for students: `my_marble()`, `marble_board(course, mode, maths)` (top 10 plus you, own school only, hidden profiles excluded), `marble_ghost(course, mode, maths, which)` (`mine`, `next` = the classmate just faster than me, `top`).
  - Edge function `marble`: `start` hands out a stamped seed (use `shared/space/seed.ts` helpers with its own stamp text, e.g. `marble-run:v1:player:course:mode:seed`); `save` checks the stamp and seed age, decodes the inputs (`decodeInputs`), **replays them with `replay()` itself**, requires a finish, refuses a time faster than the time since the stamp, then saves. Never trust a time the browser sends. Add it to `FUNCTIONS` in `scripts/build-functions.mjs`, to `supabase/config.toml` (`verify_jwt = false`) and to the README's function list. Write handler tests like `supabase/functions/training/handler.test.ts` (edited inputs, faked time, saved twice, bad stamp, other student's stamp).
  - DB tests like `supabase/tests/database/training.test.sql`, run on a scratch database with `scripts/scratch-db.sh` (the local Supabase containers are already running; read the script header; use `SCRATCH_BASE` as the F.2 notes say). Never run tests against, or apply anything to, the live project by accident.
- M.5: ghost race (a see-through marble replaying a recorded run, so no live connection), two boards per course (with maths / without, only "without" exists until M.6), and two players on one keyboard (not saved).
- M.6 and M.7 (maths): needs the maths focus F.3 work, which is on branch `maths-focus` (worktree `~/projects/school-games-hub-focus`) and **not on main yet**. Either wait for it to be merged and then merge `main` into `marble`, or merge `maths-focus` into `marble` only (never into main from here), and say which. Use `makeFocusPack(facts, focus, settings)` from `shared/maths/focus.ts`, the server holding the question list like Mission Control's `space_game_questions`, answers marked by `isFocusKey`/`solveParts` and recorded under each question's own key. Tunnels of an answer gate are the question's choices (fractions use `choiceLabels`). Gates use the engine's shortcut doors (open or shut for the whole run), pauses use the `HOLD` input and a right rescue answer uses `REFUND`; the engine already supports both. Coordinate gates are parked; "guess your time" is never recorded.
- Hazard timing in the engine is worked out from the step number only (no randomness). If you change any physics or course number, re-run `npm run marble:sim`, update `scripts/marble-medals.json` if times moved, re-run `python3 scripts/marble-courses.py`, update the pinned fingerprint in `shared/marble/determinism.test.ts`, and re-run `npm run marble:determinism`.

## Going live

James said (late 18 Oct 2026) "see if you can get it right through to deployed". He is not watching, so **before any live step re-check the current state, and stop and ask if anything looks off**. Live steps, in this order, only when tests and the scratch database checks are all green:

1. Apply the marble migration to the live database: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>.sql` (the access token is at `~/.supabase/access-token`). Check afterwards from outside: counts of other tables unchanged (202 scored games, 36 profiles at last check).
2. `npm run build:functions`, then deploy only the `marble` function: `npx supabase functions deploy marble --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Check it answers 401 when signed out.
3. Merge `marble` into `main` (check `main` first: other sessions may have pushed; merge `main` into `marble`, re-run everything, then fast-forward), flip `MARBLE_ON` to true, push, and watch the Pages run go green.
4. Update docs/MARBLE-PLAN.md (a "Results" section after each stage, and what went live), the README, docs/PRIVACY-SUMMARY.md (best times and replays are stored; boards show only word-names) and the memory note school_games_hub.md.

## How to work

- Small commits on `marble`, pushed, with the attribution line the system gives you. Run `npx tsc --noEmit`, the whole test suite (`npm test`; known flaky ones are listed in docs/MATHS-FOCUS-PLAN.md) and `npm run build:functions` before each push.
- Add a short Results section to docs/MARBLE-PLAN.md after each stage.
- Before M.8: an accessibility pass (axe-core is at `~/projects/maths-alignment-tool/node_modules/axe-core`; Chromium is at `~/.cache/ms-playwright/chromium-1243`, run it with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), a How to play screen, and check 1366x640 and 768x1024.
- James still has not tried the game himself. A private phone preview for him (a single-file build like `npm run monsters:single`, published as a private claude.ai artifact) is still owed from M.2; do it if time allows and tell him the link.
- If anything in the plan turns out wrong or too big, say so plainly and suggest a fix instead of quietly changing course.

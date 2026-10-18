# Prompt: Marble Rush, pick up at M.6 (maths) and carry on to live

Paste this into a new chat to continue the build. Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

---
You're continuing Marble Rush, a game for James's School Games Hub (Year 4-6 class, Douglas Park School). Earlier sessions built stages M.1 to M.5. Next is M.6 (maths 1), then M.7 (maths 2), then M.8 (How to play, accessibility, go live).

## Where things are

- Code: worktree `~/projects/school-games-hub-marble`, branch `marble`, pushed to origin (last commit "Marble Rush M.5"). Work only there. Other sessions use the main checkout and other worktrees: don't touch them, never use bare `git stash`, careful with `pkill -f`.
- **First step:** `git fetch`, then merge `origin/main` into `marble`. Main now has the maths focus work through F.3 (`shared/maths/focus.ts`, `makeFocusPack`, `isFocusKey`, `solveParts`, the Set focus screen, groups and class names). Marble has no Marble code on main yet. Re-run `npx tsc --noEmit`, the whole suite and `npm run marble:determinism` after the merge. Watch for migration number clashes (Marble's is `20261018002800_marble.sql`; rename later ones if main now has newer numbers, and only if Marble's has not been applied live, which it has not).
- **Read first:** docs/MARBLE-PLAN.md (section 7 and its "Update, 18 Oct 2026 (evening)" box, the Results for M.4 and M.5), docs/MATHS-FOCUS-PLAN.md (and its F.3 results), shared/README.md, docs/prompts/marble-rush-m4-onwards.md (still the best description of the stand-alone saving design and the going-live steps), and memory notes school_games_hub.md and maths_focus_plan.md.
- **Done and pushed:**
  - M.1 engine `shared/marble/` (fixed-step physics, replay, input codec, clock modes, timed hazards, shortcut doors, `HOLD` and `REFUND` inputs, reference bot, six NZ courses, medal times, determinism checks in Node, Chromium and WebKit).
  - M.2/M.3 screens `src/games/marble/` (three.js, picker, run screen, touch stick, six courses).
  - M.4 saving: own tables, `marble` edge function (start/save, server replays the inputs), `my_marble`, `marble_board`, `marble_ghost`, browser queue. **No points and no achievements in the first live version.**
  - M.5: ghost races (`loadGhost`), class boards (`loadBoard`, "without maths" only), two players on one keyboard (not saved).
  - The game is behind `marbleOn()` in `src/games/marble/switch.ts` (false), so it has no dashboard card. Nothing of Marble is live yet: the migration is not applied and the `marble` function is not deployed.

## M.6: maths 1 (what to build)

Follow section 7 of the plan, with the focus system as the only source of questions:

- **Teacher switch** on the Teacher page (Off / Students choose / On for everyone, default Students choose) plus a separate **Rescue questions** switch (default On). The server checks the switch at the start of every run. Student chip "Maths: on/off" on the picker when students choose, remembered on the device. A **Read time** setting next to it.
- **Server question list.** At run start the `marble` function hands out the stamped seed **and** about 10 questions made with `makeFocusPack(facts, focus, settings)` for that student, kept on the server (like Mission Control's `space_game_questions`, in a table students can't read). The browser never gets to pick its own question.
- **Answer gates.** Tunnels are the question's choices (fractions use `choiceLabels`). The engine's shortcut doors are open or shut for the whole run, decided from the question list and the seed. Maths off: gate signs show an arrow and the shortcut is open for everyone.
- **Pit stops** use the `HOLD` input (clock and marble stop while the student answers). Read time pauses use `HOLD` too.
- **Saving.** The server replays the inputs with the right open doors, checks every tunnel choice and typed answer against its own list, then records the answers in the student's maths records under each question's own key (sent twice, counted once; if the records can't be updated the run is still saved). Two-player and gem rolls add nothing to the records.
- **Boards.** With-maths and without-maths are separate boards (the database already has the `maths` flag; add the board tab and the ghost choice).
- Engine/course changes: if you change any physics or course number, re-run `npm run marble:sim`, update `scripts/marble-medals.json` if times moved, re-run `python3 scripts/marble-courses.py`, update the pinned fingerprint in `shared/marble/determinism.test.ts`, and re-run `npm run marble:determinism`. Medal times with maths on: gold needs most shortcuts, silver is reachable with none.

## M.7: maths 2

Rescue questions (a right answer after a fall refunds the fall time via `REFUND`; own switch), number gems (a question from the list, never recorded), guess your time (never recorded), with-maths / without-maths boards finished, and maths achievements only if James wants points (the plan postpones points and achievements; ask him first, don't just add them). Coordinate gates stay parked.

## M.8: finish and go live

How to play screen (with maths), accessibility pass (axe-core at `~/projects/maths-alignment-tool/node_modules/axe-core`; Chromium at `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, run with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`; the playwright package is in an old scratchpad such as `/tmp/claude-1000/-home-james/5d209d94-b1c1-4a60-8e2f-263cb31bf73f/scratchpad/pw`), check 1366x640 and 768x1024, privacy summary (best times and replays are stored; boards show word-names only; marble runs add to the maths records), docs, README.

## Going live

James said (18 Oct 2026) "see if you can get it right through to deployed" but he isn't watching, so **before any live step re-check the current state, and stop and ask if anything looks off**. Steps, in this order, only when all tests and the scratch-database checks are green:

1. Apply the marble migrations to the live database: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>.sql` (access token at `~/.supabase/access-token`). Afterwards check from outside that other tables' counts are unchanged.
2. `npm run build:functions`, then deploy only the `marble` function: `npx supabase functions deploy marble --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Check it answers 401 when signed out. If M.6 changed other functions (Teacher page switches), deploy those too, one at a time.
3. Merge `marble` into `main` (check `main` first: merge it into `marble`, re-run everything, then fast-forward), flip `MARBLE_ON` to true, push, and watch the Pages run go green.
4. Update docs/MARBLE-PLAN.md (a Results section per stage and what went live), the README, docs/PRIVACY-SUMMARY.md and the memory note school_games_hub.md.

DB tests run on a scratch database with `scripts/scratch-db.sh` (read its header; use `SCRATCH_BASE`). Never run tests against, or apply anything to, the live project by accident.

## How to work

- Small commits on `marble`, pushed, with the attribution line the system gives you. Before each push run `npx tsc --noEmit`, the whole suite (`npm test`, takes several minutes: run it in the background and wait for it) and `npm run build:functions`. Known flaky tests are listed in docs/MATHS-FOCUS-PLAN.md.
- Add a short Results section to docs/MARBLE-PLAN.md after each stage.
- James still has not tried the game himself. A private phone preview (single-file build like `npm run monsters:single`, published as a private claude.ai artifact) is still owed; do it if time allows and tell him the link. Note `npm run marble:preview` works again (it now has a "nobody signed in" provider).
- If anything in the plan turns out wrong or too big, say so plainly and suggest a fix instead of quietly changing course.

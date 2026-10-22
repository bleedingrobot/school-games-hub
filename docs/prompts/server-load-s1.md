Server load S.1: the game switches are read once and remembered for 5 minutes. Read docs/SERVER-LOAD-PLAN.md fully first (sections 1, 3, 4 "S.1", 5 and 7). Do S.1 only, then stop.

Where things are:
- School Games Hub. Make a new branch `server-load` from an up-to-date `main` (run `git fetch` first; if `main` is behind `origin/main`, fast-forward it) in a new worktree at ~/projects/school-games-hub-server-load. Never commit this work to `main`. Other sessions use the main checkout and other worktrees: don't touch them, never use bare `git stash`, careful with `pkill -f` (find processes by port instead).
- Every switch read on the website goes through `readSettings` in src/data/classSettings.ts, except one direct read of `monsters_enabled` in src/data/monsters.ts. The readers are in src/data (lord, spaceGames, monsters, gemKeep, multiplayer, clans, classSettings) and the hooks in src/games/*/switch.ts and src/games/space/mathsMode.ts.
- The live database's request counts (read only) are in `extensions.pg_stat_statements`, through `npx supabase db query --linked`. Reading them is fine. Don't clear them in this stage.

What to build:
1. When there is no class picked (`classId` empty), `readSettings` reads the pupil's whole settings row once and remembers it for 5 minutes. Every caller takes its columns from that one row. Callers asking at the same moment share the one request. A failed read is not remembered.
   - First check which columns of `app_settings` a signed-in pupil may read. If some can't be read, ask for every column they can read, and say which ones are left out.
   - Send the `monsters.ts` direct read through the same helper.
2. Forget the remembered row: on sign-out (and when someone else signs in on the same device); when the tab comes back after being hidden for more than 5 minutes; and straight after any teacher change to a setting from this device (every `teacher_set_*` save that goes through the no-class path).
3. When a teacher has picked a class on the Teacher page (`classId` given), read that class's settings fresh every time, as now.
4. Check that every server function still refuses to start or save a game that is switched off, whatever the screen thinks. List each game and where the server checks it. If any game relies only on the screen, stop and tell me before going further; don't fix it on your own.

Rules:
- **Nothing live.** No merging to `main`, no pushing `main`, no deploying, no database changes. This stage shouldn't need a database change; if it does, stop and ask.
- Pupils must see nothing new, apart from the one thing the plan allows: a switch change can take up to 5 minutes (or a page reload) to reach their screen.
- Plain words in anything a pupil or teacher sees. Match the surrounding code style (single quotes, wide lines, the same comment style).
- Run the quick tests (`npm test`) once before you change anything and say which ones failed, if any. Known flaky: a few load-timing tests (`TrainingPage`, `SetFocus`); re-run them alone. Other sessions may be running tests too, so it can be slow: don't put a short time limit on it.
- Commit as you go. Push the `server-load` branch only (never a bare `git push`).

Tests:
- The three switch checks on the home page, together, send one request.
- Two pages or hooks asking at the same moment share one request.
- The remembered row is used within 5 minutes and read again after.
- Sign-out, a different pupil signing in, coming back to the tab after more than 5 minutes, and a teacher's save each make the next read fresh.
- A failed read is not remembered: the next caller tries again.
- The teacher class picker still reads fresh every time.
- Each existing switch test still passes, unchanged where possible.
- Count the requests sent by the home page and the lobby before and after this change (with the test mock), and write both numbers down.

At the end:
- Write "Stage S.1 results" at the end of the plan: what you built, the request counts before and after, the server checks from step 4 (game by game), anything untested, and the exact go-live steps (merge `server-load` into `main` and push, which deploys the site; no functions or database changes).
- Run the whole suite (`TESTS=all`), the type check and the build.
- Stop and tell me in plain words what changed, what a pupil might notice, and what I need to do to put it live. Don't start S.2.

Server load: a go-live rehearsal for S.1 to S.3, then S.4 (the lobby asks once). Read docs/SERVER-LOAD-PLAN.md fully first (sections 1, 3, 4 "S.4", 5 and 7, and the "Stage S.1/S.2/S.3 results" sections at the end). Do part A, then part B, then stop.

Where things are (19 Oct 2026):
- School Games Hub. S.1 and S.2 are on branch `server-load` (worktree ~/projects/school-games-hub-server-load). S.3 is on branch `server-load-s3` (worktree ~/projects/school-games-hub-server-load-s3), which starts from the end of S.2. Both are pushed; **none of it is live**. This prompt is on `server-load-s3`.
- Going live is waiting on one step: applying `supabase/migrations/20261019000700_my_home_page.sql` to the live database. The Claude Code safety check refused it twice while James was away from his computer. **Don't try to apply it, and don't look for another way round the check.** James will paste it into the Supabase SQL Editor himself, or approve it at his computer later.
- Run `git fetch` first and look at what has arrived on `main` since 19 Oct. Never commit this work to `main`. Other sessions use the main checkout and other worktrees: don't touch them, never use bare `git stash`, careful with `pkill -f` (find processes by port instead). The S.3 worktree's `node_modules` is a symlink to the S.2 worktree's; do the same for any new worktree.
- The live database's request records (read only) are in `extensions.pg_stat_statements`, through `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi`. Reading them, or timing read-only queries as a pupil inside a transaction that is rolled back (or ends in a deliberate error), is fine. Never change anything live, and don't clear the counts.

## Part A: go-live rehearsal (nothing live)

1. Make a throwaway branch from today's `origin/main` in a throwaway worktree. Merge `server-load`, then `server-load-s3`, the same way the real go-live will. Say if anything clashes and how you'd settle it.
2. In the throwaway copy: the type check, the whole suite (`TESTS=all`) and the build. Then the database side on the local database, in a rolled-back transaction: check which migrations the local copy has, pipe in the missing ones from `main` and the branches, then `20261019000700_my_home_page.sql`, then `home_page.test.sql`; then the security test on its own (two pgTAP plans can't share a transaction). Do NOT `supabase db reset`: other sessions share the local database.
3. Read only, on the live database: check that every job and table column `my_home_page` uses is still there as it was (anything that changed on `main` since 19 Oct, e.g. a new `my_progress`, matters most). Time the job's query against the separate ones again for the busiest pupil, as in "Stage S.2 results".
4. Write the exact go-live steps for James in plain words, in order, short enough to follow on a phone:
   - Paste the whole of `20261019000700_my_home_page.sql` into the Supabase SQL Editor and press Run. What he should see if it worked. Then tell Claude "done", and Claude checks it (read only) before going on.
   - Merge `server-load` into `main` and push (S.1 and S.2 go live). How James can do it on GitHub from his phone if Claude can't.
   - Later, merge `server-load-s3` into `main` and push (S.3).
   - What to check afterwards, and how to undo each step if something looks wrong.
   Put them in the plan as "Go-live rehearsal (date)", and commit that to `server-load-s3`. Then delete the throwaway worktree and branch, and don't push them.

## Part B: S.4, the lobby asks once

Build on a new branch `server-load-s4` from `server-load-s3`, in its own worktree.

**Now:** each lobby refresh (every 20 seconds while the tab is shown, and straight away when the tab comes back) sends about 9 requests: the playing-friends switch (S.1's remembered read), the four open-game lists (`lobby_games`, `space_lobby_games`, `card_lobby_games`, `power_lobby_games`), my own open games of each kind (tables `mp_games`, `space_games`, `card_game_seats`, `power_games`), then the names and avatars of the other players in my games. The code is `refresh` in src/pages/Lobby.tsx (about line 101), with the fetchers in src/data/multiplayer.ts, spaceGames.ts, cardGames.ts and powerGames.ts. Note that S.2 already made `my_home_page` read my own open games with the same columns, order and limits: reuse that approach.

What to build:
1. One new database job, `lobby`, that returns the four open-game lists, my own open games of each kind and the names and avatars, in one answer. It runs as the pupil (`security invoker`), so the existing row rules still apply. It calls the four existing lobby jobs rather than copying them. For the direct table reads, it gives exactly the same rows, order and limits the page asks for now.
   - The migration takes the next free number across **all** branches and worktrees, local and on GitHub (fetch every branch: `git fetch origin 'refs/heads/*:refs/remotes/origin/*'`). The highest on 19 Oct was `20261019000700`, so probably `20261019000800`, but check again.
   - Grant it only to signed-in users, like the other jobs, and add it to `supabase/tests/database/security.test.sql`'s function list.
2. The lobby takes everything from that one answer. The switch stays with S.1's remembered read. Still every 20 seconds, still straight away when the tab comes back, and creating or joining a game still never waits for it.
3. If the one request fails, the lobby shows exactly what it shows now when everything fails, with the same messages. Today the space, 101 and Power Clash parts can fail on their own while chess and checkers still show. Say plainly in the results what changes there.
4. Before writing the screen side, time the new job against the separate ones on the live database for a busy pupil, read only, as in S.2. If the one job is slower than all the separate ones added together, stop and tell James.

Rules:
- **Nothing live.** No merging to `main`, no pushing `main`, no deploying, and the migration is not applied to the live database. Test it in a rolled-back transaction on the local database, as in part A.
- Pupils must see nothing new: the same games listed in the same order, the same names and buttons, the same messages.
- Plain words in anything a pupil or teacher sees. Match the surrounding code style (single quotes, wide lines, the same comment style).
- Run the quick tests (`npm test`) once before you change anything and say which ones failed, if any. Known flaky: a few load-timing tests (`TrainingPage`, `SetFocus`); re-run them alone. Other sessions may be running tests too, so it can be slow: don't put a short time limit on it, and don't edit files while that first run is going.
- Commit as you go. Push `server-load-s4` only (never a bare `git push`). The throwaway branch from part A is never pushed.

Tests:
- Database (rolled-back transaction): the new job gives the same answer as the separate jobs and table reads for a pupil with open games of every kind, a pupil with none, a teacher, a hidden player (left out of the names and of other pupils' lists, as now), expired and finished games (left out, as now), a pupil at another school, and with playing friends switched off. A pupil never sees another pupil's private rows through it (for example someone else's 101 seat).
- Screen: one request per refresh (plus at most S.1's switch read, which is remembered); the same games in the same order as before; a failure shows the old message; still refreshes every 20 seconds and on coming back to the tab; creating and joining still work. Lobby.test.tsx and LobbyPower.test.tsx still pass, unchanged where possible.
- A trick that worked well for S.2: for the duration of the build only, keep a copy of the old Lobby.tsx and draw the old and new lobby side by side from the same made-up data (open games of every kind, a hidden player, a failure), checking the HTML comes out identical. Then delete the copy. src/pages/homePageFake.ts shows how to fake Supabase so it answers both the old requests and the new one.
- Update RequestCount.test.tsx (the lobby part) and write down the lobby's count before and after.

At the end:
- Write "Stage S.4 results" at the end of the plan: what you built, the request counts before and after, the live timing, anything untested, and the exact go-live steps. S.4 needs S.1 to S.3 to go first (its branch contains them), then its own migration applied before its merge. Say why that order, and what happens to pupils whose lobby is open in between.
- Run the whole suite (`TESTS=all`), the type check and the build.
- Stop and tell James in plain words what changed, what a pupil might notice, and what he needs to do to put it live. Don't start S.5 or S.6.

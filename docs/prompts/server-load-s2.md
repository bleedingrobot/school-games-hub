Server load S.2: the home page asks once. Read docs/SERVER-LOAD-PLAN.md fully first (sections 1, 3, 4 "S.2", 5 and 7, and "Stage S.1 results" at the end). Do S.2 only, then stop.

Where things are:
- School Games Hub, worktree ~/projects/school-games-hub-server-load, branch `server-load`. S.1 is already on this branch. Run `git fetch` first; if S.1 has gone live in the meantime (`server-load` merged into `main`), merge `origin/main` into `server-load` before starting. Never commit this work to `main`. Other sessions use the main checkout and other worktrees: don't touch them, never use bare `git stash`, careful with `pkill -f` (find processes by port instead).
- The home page is src/pages/Dashboard.tsx, with its cards src/components/ClassWarpCard.tsx (`fetchMyClass`), MathsFocusCard.tsx (`fetchMyFocus`) and MathsPathCard.tsx (`fetchMyLadder`). src/pages/RequestCount.test.tsx (from S.1) counts its requests: 18 with the test mock today, plus the names lookup and the two maths cards when there are games and a focus. The requests it sends: `my_progress`, `my_bot_game_stats`, `my_friend_game_stats`, `my_space_game_stats`, `my_card_game_stats`, `my_power_game_stats`, `my_moves_left`, `my_class`, the recent and open games of each kind (tables `bot_games`, `mp_games`, `space_games`, `card_game_seats`, `power_games`), players' names and avatars, `my_maths_focus` and the maths path. The switches stay with S.1's remembered read; don't add them to the new job.
- The live database's request records (read only) are in `extensions.pg_stat_statements`, through `npx supabase db query --linked`. Reading them is fine; don't clear them.

What to build:
1. One new database job, `my_home_page`, that returns everything the home page and its three cards need in one answer. It runs as the pupil (`security invoker`), so the existing rules about who can see what still apply. Where a job already exists, it calls it rather than copying it, so the numbers can't drift apart. For the direct table reads, give exactly the same rows, order and limits the page asks for now.
   - The migration takes the next free number across **all** branches and worktrees (check every branch, local and on GitHub; the highest I can see is `20261019000600`, so probably `20261019000700`, but check again).
   - Grant it only to signed-in users, like the other `my_` jobs, and add it to `supabase/tests/database/security.test.sql`'s function list.
2. The home page and its three cards take their parts from that one answer. The cards keep their own request as a fallback, for when they are shown somewhere else or the home page's answer is missing their part.
3. **Not remembered between visits:** points, recent games and moves left must be up to date straight after a game, so the home page still asks every time it opens. It just asks once.
4. If the one request fails, the page shows exactly what it shows now when everything fails, with the same messages.
5. Before writing the screen side, time the new job against the separate ones for the busiest pupil on the live database, read only (`explain analyze` inside a transaction that is rolled back, or just timing the selects, never changing anything). If the one job is slower than all the separate ones added together, stop and tell me.

Rules:
- **Nothing live.** No merging to `main`, no pushing `main`, no deploying, and **the migration is not applied to the live database**. Test it in a rolled-back transaction on the local database (do NOT `supabase db reset`: other sessions share it; recipe: pipe `begin;` plus any migrations the local database is missing plus the new one plus the pgTAP file, ending in `rollback;`, into `docker exec -i supabase_db_school-games-hub psql -U postgres`). Check first which migrations the local database has.
- Pupils must see nothing new: same cards, same numbers, same order, same messages. The page may fill in all at once instead of bit by bit; that's the only allowed difference.
- Plain words in anything a pupil or teacher sees. Match the surrounding code style (single quotes, wide lines, the same comment style).
- Run the quick tests (`npm test`) once before you change anything and say which ones failed, if any. Known flaky: a few load-timing tests (`TrainingPage`, `SetFocus`); re-run them alone. Other sessions may be running tests too, so it can be slow: don't put a short time limit on it, and don't edit files while that first run is going.
- Commit as you go. Push the `server-load` branch only (never a bare `git push`).

Tests:
- Database (rolled-back transaction): the new job gives the same answer as the separate jobs and table reads for a pupil with lots of games of every kind, a brand-new pupil, a teacher, a hidden pupil, a pupil in a class with a focus and one without, and with each game switched off. A pupil never sees another pupil's private rows through it.
- Screen: one request on opening (plus at most S.1's switch read); the same cards and numbers as before for a pupil with games and a new pupil; a failure shows the old message; each card still works on its own when shown without the home page's answer; coming back from a game asks again.
- Each existing Dashboard and card test still passes, unchanged where possible.
- Update RequestCount.test.tsx and write down the home page's count before and after.

At the end:
- Write "Stage S.2 results" at the end of the plan: what you built, the request counts before and after, the live timing from step 5, anything untested, and the exact go-live steps (apply the one migration to the live database, then merge `server-load` into `main` and push, which deploys the site; say which order and why, and what happens to pupils whose page is open in between).
- Run the whole suite (`TESTS=all`), the type check and the build.
- Stop and tell me in plain words what changed, what a pupil might notice, and what I need to do to put it live. Don't start S.3.

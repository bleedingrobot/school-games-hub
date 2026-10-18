Bond Match stage M.4: saving. M.1 (engine), M.2 (screens) and M.3 (teaching touches) are done and pushed. James has played it and said go for M.4, including applying the migration and deploying the function. Nothing is merged to main and the game is NOT switched on (that is M.7).

Where things are:
- School Games Hub repo. Work in the worktree ~/projects/school-games-hub-bond-match on branch `bond-match`. Run `git status` and `git branch` first. Never a bare `git push`: use `git push origin bond-match`. Don't merge to main.
- Read docs/BOND-MATCH-PLAN.md (sections 4, 6, 9, 10, 11), shared/bond-match/save.ts (the replay already exists), and copy the pattern of Gem Keep's saving: shared/gem-keep/save.ts, supabase/functions/gem-keep/ (entry.ts, handler.ts, handler.test.ts), migration 20261017001100_gem_keep.sql, and how its queue re-sends and saves once per run id.
- James's rules (plan section 11): Bond Match writes NOTHING to a student's fact records. It saves only stars, bests and points. Points are small, taking-part points per finished game, capped per day like the space game and Gem Keep. No leaderboards across kids. No class is ever blocked: if the server is down the game still works and the save is queued.
- The picker, board, finish screen and bests in the browser stay as they are. Don't change shared/bond-match/ engine, deck or score rules unless you find a real bug; if you do, say so clearly. Don't touch shared/maths/ or the registry.

Build:
1. Migration (next free number after 20261019000100): a table for finished games (student, run id unique per student, bond id, board size, seed, flips list, flips, seconds, stars, created_at) and a per-student per-bond-per-size best table (fewest flips, fastest time, best stars, games played). Row level security like Gem Keep: a student reads only their own; teachers read their own class's students through the same helper the other games use. Add SQL tests in the existing style and run them in a rolled-back transaction.
2. Server function `supabase/functions/bond-match/`: takes a BondMatchSave plus a run id; checks the student is signed in; rebuilds the game with `replay()` and ignores any stars or flips count the browser claims; rejects a game faster than a human can flip (set the floor in one config constant, e.g. about 0.6 seconds per flip, and say what you chose); saves once per run id (a re-send returns the same answer); updates the bests; awards the capped daily points the same way Gem Keep does (pick a small number, put it in one config constant, say what you chose). Returns the stars, the bests and the points earned. Handler tests: good game, tampered flips, wrong seed, too fast, duplicate run id, signed out, over the daily cap, unknown bond.
3. Browser: on finish, send the save with a run id; if it fails (offline, server down), keep it in a queue in localStorage (try/catch) and re-send later, once per run id, the way Gem Keep does. The finish screen shows "Saved" or "Will save when you are back online" in plain words, and the points line. Local bests still work with no server. Make the sending code take the server call as a prop so the preview and tests use a fake one.
4. Student page: stars per bond set (best stars on each board size). Teacher view: per student, stars per bond. Reuse the existing student and teacher pages' patterns. Anything student-facing is plain, short wording for a 9 year old. If this would touch a page that is live, keep it behind the same Bond Match switch (nothing visible while the game is off).
5. Preview: add a fake server so James can see "Saved", "Will save later" (offline) and points, and rescreenshot at phone and desktop width into ~/bond-match-screenshots/m4/ (tell me the path).
6. Tests for each new thing, then `npm run test:all`, the type check and `npm run build`. If a test fails, run it alone before deciding if it is a real failure; some other tests time out when the machine is busy (a Space and a Training test did). Say which.

Don't build: the bot, two-player, hints, points shop or anything spendable, Mixed or Auto, focus or ladder changes, or anything in shared/maths/. Don't turn the game on or add it to src/games/registry.ts.

Apply and deploy, in this order, stopping at the first thing that goes wrong:
a. Check which migrations are live with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi` (the Supabase CLI works from the worktree). Make sure the migrations this one depends on are live first.
b. Run the SQL tests in a rolled-back transaction on the local database.
c. Show James the migration and the function's daily cap, taking-part points and speed floor in plain words, then apply it to the live database. Look at what exists before applying; never drop or overwrite anything.
d. Build and deploy only the `bond-match` function (write a build script like scripts/build-lord.mjs; don't run `npm run build:functions`, it rewrites the stale monster/index.ts, which must be left alone).
e. Check it live without a real student: a signed-out call is refused, and a test save from a throwaway or existing test account saves once, a re-send saves nothing new, and tidy up any test rows you made.
f. Do NOT merge to main, push main, or switch anything on.

Commit as you go with clear messages and push `bond-match`. Put a "Stage M.4 results" section at the end of docs/BOND-MATCH-PLAN.md (what was built, the numbers chosen, what was applied and deployed, what is still off) and update the plan's status line.

When done, stop and report in plain, simple words: what you built, what is now live in the database and functions, where the screenshots are, anything awkward, and decisions you need from me. Then wait for my go-ahead before M.5 (it changes other games, so it needs my yes).

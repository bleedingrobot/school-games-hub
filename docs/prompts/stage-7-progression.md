We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/. Stages 1–6 are done.

**Before doing anything, read these files:**
- `docs/BRIEF.md` is my full original brief. Section 7 covers points, achievements and leaderboards, section 8 covers safety, section 12 sets how I want you to work, and section 13 says what "done" means.
- `docs/PLAN.md` is the agreed architecture, the decisions we've made, the Stage 6 design and the setup notes. Where it disagrees with the brief, PLAN.md wins. Its "Decisions made" section has the leaderboard and teacher decisions this stage builds on.
- `README.md` explains how the project runs, is tested and is published, how playing a friend works, and the teacher's off switch.
- `supabase/migrations/`, `supabase/tests/` and `supabase/functions/` hold the database setup, its tests and the server functions.
- The code Stage 7 builds on:
  - results: the `bot_games` and `mp_games` tables, and the `save-bot-game` and `multiplayer` server functions
  - the dashboard: `src/pages/Dashboard.tsx`, with made-up numbers in `src/dev/sampleData.ts`
  - the placeholder pages: `src/pages/Leaderboard.tsx` ("Coming soon") and `src/pages/Profile.tsx`
  - the teacher functions already in the database: `teacher_set_hidden()`, `teacher_reset_name()`, `teacher_set_role()`, `teacher_delete_student()`, `teacher_set_multiplayer()`

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Where things stand

- **Website:** React + TypeScript + Vite with hash routes, published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
- **Sign-in:** Google through Supabase. Only @douglaspark.school.nz accounts get in. Profiles hold a random ID, a word-list player name, an avatar, a role (`student` or `teacher`) and `hidden`.
- **Bot games (Stages 4–5):** saved in `bot_games` by `save-bot-game`, which replays every move first. Each row has the player, game, bot level, side, moves, result (`won`/`lost`/`drawn`), reason and `counts_for_points`. Games with fewer than 10 student moves, and abandoned games, have `counts_for_points = false`. A student can save at most 300 bot games a day.
- **Games against friends (Stage 6):** saved in `mp_games`, written only by the `multiplayer` server function. Finished rows have `first_player`, `second_player`, `winner` (`first`, `second`, or null for a draw), `reason`, `counts_for_points` and `finished_at`. A game counts only if each player made at least 10 moves and nobody abandoned it. If a student is deleted, their player column becomes null and the row stays for the opponent. Students can read only the games they played in; teachers can't read other students' games yet.
- **Dashboard:** real recent games and separate "Against bots" / "Against friends" stats. The rank badge, level, points, "points to next level" and achievements are made up and carry a SAMPLE DATA badge.
- **Teacher's multiplayer switch:** works on the server, but there's no button. The README tells me to use the SQL Editor for now.
- **Supabase project:** `zqzhetlzvtptnkmeiumi` (Sydney, free plan). Real chess games are saved on it; check what's there before relying on anything.

## Before you start

- **The Stage 6 two-device test.** I was asked to test playing a friend with two real school accounts. If I've given you notes from it, or from the student trial, **fix those first**, in their own small commits, before starting Stage 7. If I haven't, ask me once whether either has happened. Don't hold up the work waiting for an answer.
- **Look at the live data** (read-only) so you know how many students, bot games and friend games exist. Anything you calculate must work for the games already saved, not just new ones.

## Things to know

- **You can change Supabase yourself.**
  - A Supabase access token is saved in `~/.supabase/access-token`. Never print it, copy it, or put it in the repo.
  - Two commands are pre-approved in `.claude/settings.local.json`:
    - live SQL: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>` (multi-statement files work against the live project)
    - server functions: `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`
  - Look before you change anything live: run a read-only query first.
  - Check with me before anything that deletes data or changes sign-in. That includes testing the teacher "delete a student" button on the live site.
  - The migrations were applied by hand, not with `supabase db push`. See the PLAN.md note about `supabase migration repair` before ever using `db push`, and add your migration to that note.
- **Server functions:**
  - Edit `handler.ts`, then run `npm run build:functions` to rebuild the generated `index.ts`. That's the single file that gets deployed.
  - A new function must be added to the `FUNCTIONS` list in `scripts/build-functions.mjs`.
  - A test fails if you forget to rebuild.
  - Keep each function's logic in a `handler.ts` with its Supabase calls passed in, so it can be tested without Supabase, the way `multiplayer` does it. Shared code for functions lives in `supabase/functions/_shared/`.
- **Testing on this machine:**
  - The local Supabase copy needs Docker: `npx supabase start`, then `npm run test:db`.
  - `npx supabase db query --local -f` refuses files with more than one statement. For ad-hoc local SQL use `docker exec -i supabase_db_school-games-hub psql -U postgres`.
  - After editing `supabase/config.toml`, restart it with `npx supabase stop` and `npx supabase start`.
  - `[auth.email] enable_signup = false` blocks email *logins* too. For local browser tests with password test users, switch it on briefly, then switch it back.
  - Run `npx supabase db reset` afterwards, or leftover test accounts make the profile tests fail.
  - `npm run functions:serve` runs the server functions locally. `.env.local` already points the dev site at the local Supabase copy.
  - Don't use `pkill -f <pattern>` to stop the dev servers: it matches its own command and kills the shell. Find the process IDs with `ps` and kill those.
  - One older test, "medium beats easy" in `src/games/chess/bot.test.ts`, fails about once in seven full runs (Stockfish's low skill levels add randomness). Re-run before assuming you broke it, and mention it if you see it.
- **Screenshots and browser games:**
  - Playwright is installed at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`. Pass the cached Chromium as `executablePath`: `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`.
  - Make local test users with the Supabase admin API (`admin.auth.admin.createUser` with the local secret key from `npx supabase status -o env`), sign them in with supabase-js, and put the session in `localStorage` (key `sb-127-auth-token`) before the page loads.
  - For two players, use **two separate browser contexts**. To make a teacher, set `role = 'teacher'` on their profile in the local database.
  - Bundle the shared rules with `rolldown` into a single `.mjs` in the scratchpad, so a Node script can pick legal moves and click squares by their accessible names (chess: `e2`; checkers: `Square 11`).
  - The big yellow Play/Start buttons animate, so Playwright needs `click({ force: true })` on them.
  - A checkers multi-jump sends itself once there's only one way to go; stop tapping when the squares become `aria-disabled`.
  - To test the 2-minute claim without waiting, wind back `turn_started_at` on the game row.
  - Wait about a second before taking screenshots, or you'll catch the pop-in animations half-way.
- **Library versions:** these are newer than you may know (React 19, react-router 8, TypeScript 7, Vite 8, Vitest 5, supabase-js 2.117). Check their real APIs in `node_modules` before using them.

## Your task: Stage 7 — points, badges, ratings, leaderboards and the teacher view

Results are already trustworthy: the server checks every game. This stage turns them into progress students can see, and gives teachers the controls they need.

1. **Plan first, briefly.**
   - Before building, write a short design section in `docs/PLAN.md`:
     - the points rules, levels and badges, with the numbers
     - how ratings work, in words a 9-year-old could follow
     - the tables and database functions, and when the numbers get worked out (for example when a game is saved, or by a scheduled job)
     - how it stays fair, and can't be farmed or faked
     - what it costs against the free-tier limits in PLAN.md
   - Then carry on; don't wait for my approval unless there's a real choice only I can make.
2. **Points and levels:**
   - Reward taking part and getting better, not just winning.
   - Bot games earn **small, capped** points per day. Games with `counts_for_points = false` earn nothing.
   - Make the rules easy to explain, and show them to students on a "How points work" page or panel.
   - Work out the points for games already saved too.
3. **Ratings (Elo-style):**
   - Only games against friends that count affect ratings. Bot games never do.
   - Keep chess and checkers ratings separate.
   - Ratings are calculated on the server, never in the browser.
   - New players start at a sensible rating, and rating changes should be gentle enough that a few games don't swing things wildly.
   - Show ratings as the badge ranks from PLAN.md (Bronze → Silver → Gold → Champion) rather than raw numbers. Pick the cut-offs and explain them.
4. **Achievements and badges:**
   - A small, friendly set for both games (first win, games played, kings crowned, beating each bot level, and so on).
   - Earned on the server from saved games, so they can't be faked.
   - Replace the sample achievements on the dashboard.
5. **Leaderboards (PLAN.md decisions):**
   - Whole school. Students see the **top 10 plus their own position**.
   - Per game (chess, checkers), weekly and all-time. Weeks run on **New Zealand time**.
   - A **"most improved this week"** list.
   - Only player names and avatars: no emails, IDs, real names or classes.
   - Hidden students never appear. Deleted students' games still count for their opponents without showing them.
   - Boards stay fair as more students and games are added (for example, a minimum number of games to appear).
   - Replace "Coming soon" on `/leaderboard`.
6. **Dashboard and profile:**
   - Replace every SAMPLE DATA number with real data, then delete `src/dev/sampleData.ts` and the SAMPLE DATA badge component if nothing uses them.
   - Show the student's points, level, rank badges, recent progress and achievements.
7. **Teacher view (PLAN.md decisions):**
   - Only for profiles with `role = 'teacher'`, checked on the server. Students must not be able to open it or call its functions.
   - A list of students with their player name, avatar and games played.
   - **Rename** (give a new random name), **hide/unhide**, and **remove a student and delete their data**, with a clear confirm step for anything that can't be undone.
   - **Make another staff member a teacher**, or take it away (not yourself).
   - **Switch games against friends off and on**, replacing the SQL Editor instructions in the README.
   - **End-of-year cleanup:** decide with a short explanation what it does (for example, reset points and boards while keeping accounts), and make it hard to press by accident.
   - Teachers may need to read students' games and stats for this. Give them only what the screens need, through teacher-only database functions or policies, and test it.
   - Keep checking the existing teacher functions before relying on them, and fix anything that's missing (for example, the multiplayer switch currently can't be used from the SQL Editor because it needs a signed-in teacher).
8. **Safety:**
   - no emails or real names anywhere students can see
   - students can't change points, ratings, badges or anyone else's data
   - logs say what went wrong, never who
   - friendly error messages that reveal nothing technical
   - flag anything that affects privacy, security or cost
9. **Tests:**
   - **Scoring:** points rules and the daily bot cap, levels, rating changes (including draws, new players and deleted opponents), badge cut-offs, achievements, NZ-time week boundaries, and that `counts_for_points = false` games earn nothing.
   - **pgTAP:** students can't write points, ratings or achievements; leaderboards show only names and avatars and leave out hidden students; teacher-only functions refuse students and outsiders; teachers can do each teacher action.
   - **Interface:** leaderboard (including "you" outside the top 10), dashboard numbers, the "How points work" explanation, and each teacher screen with its confirm steps.
10. **Check your work:**
    - Run the type check, tests, database tests and production build.
    - In a real browser with local accounts: play a few bot games and friend games, and check points, ratings, badges, achievements and the boards update correctly. Sign in as a local teacher and use every teacher action, including deleting a test student.
    - Take screenshots at Chromebook (1366×768) and tablet (768×1024) sizes.
    - Make sure bot games and friend games still play and save.
    - Tell me plainly what's tested and what isn't.
11. **Finish up:**
    - Apply the migration and deploy any changed server functions to the live project yourself, then check them from outside.
    - Work out points, ratings and achievements for the games already saved on the live project, and check the numbers look right.
    - Record the migration in the PLAN.md note about `supabase migration repair`.
    - Update `docs/PLAN.md` (mark Stage 7 done) and the README: how points, ratings and badges work, the teacher view, and the end-of-year cleanup.
    - Commit with clear messages on a branch.
    - Only merge to `main` once everything passes and the live database and server functions are ready.
12. **The live teacher test.** Only I can sign in as a real teacher. Give me one short set of steps to try the teacher view on the live site (without deleting a real student), then check what changed in the live database and tell me what you found.

**Don't do these yet:** the Stage 8 privacy summary, school sign-off, or the final student test checklist. No chat, no free text, no new outside services.

When you're done, give me a short plain-English summary covering:
- what was built, including the points rules in a few lines I could explain to a class
- anything I need to click, one clear set of steps at a time
- what to try on the live site, as a student and as a teacher
- anything about cost, free-tier limits, privacy or licences I should know

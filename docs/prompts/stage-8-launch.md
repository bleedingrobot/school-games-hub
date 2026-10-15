We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/. Stages 1–7 are done.

**Before doing anything, read these files:**
- `docs/BRIEF.md` is my full original brief. Section 8 covers safety and privacy, section 12 sets how I want you to work, and section 13 is the definition of done this stage has to prove.
- `docs/PLAN.md` is the agreed architecture, the decisions we've made, the Stage 6 and Stage 7 designs and the setup notes. Where it disagrees with the brief, PLAN.md wins. Its "Privacy (New Zealand)" section promises a one-page privacy summary before this stage, and its "Definition of done — additions" adds two more things to check.
- `README.md` explains how the project runs, is tested and is published, playing a friend, points and badges, the teacher view and what to do after the holidays.
- `docs/STUDENT-TRIAL.md` is the small-trial checklist from Stage 5. It only covers sign-in and bot games.
- `supabase/migrations/`, `supabase/tests/` and `supabase/functions/` hold the database setup, its tests and the server functions.
- Don't read `docs/prompts/space-game.md` beyond its first lines. That's Stage 9, a separate game, and it's not part of this stage.

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Where things stand

- **Website:** React + TypeScript + Vite with hash routes, published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main` (type check, tests and build run first).
- **Sign-in:** Google through Supabase, Google Cloud consent screen set to **Internal** inside the school's Google organisation. Only @douglaspark.school.nz accounts get in (a sign-up check in the database plus database rules). Real students have signed in fine.
- **Bot games (Stages 4–5):** saved in `bot_games` by `save-bot-game`, which replays every move first.
- **Games against friends (Stage 6):** `mp_games` and the `multiplayer` server function. Students played friend games on the live site on 15 Oct 2026.
- **Points, ratings, badges, leaderboards and the teacher view (Stage 7):** worked out inside the database by triggers. Teacher page at `/#/teacher`, including the switch for games against friends and the end-of-year "new season" cleanup.
- **Supabase project:** `zqzhetlzvtptnkmeiumi` (Sydney, free plan). Real students and real games are on it. Check what's there before relying on anything, and treat it as real children's data.

## Before you start

- **Open items from earlier stages.** I was asked to do a live teacher test (Stage 7) and a two-device friend test (Stage 6), and the small student trial in `STUDENT-TRIAL.md`. If I've given you notes from any of them, **fix those first**, in their own small commits. If I haven't, ask me once which have happened. Don't hold up the work waiting for an answer: check the live database (read-only) for signs of them instead, e.g. teacher actions, friend games between real accounts, checkers bot games.
- **Look at the live data** (read-only): how many students, teachers, bot games, friend games, scored games and achievements, and whether anything looks wrong (games stuck "in progress", scores missing for finished games, odd ratings). Report what you find.

## Things to know

- **You can change Supabase yourself.**
  - A Supabase access token is saved in `~/.supabase/access-token`. Never print it, copy it, or put it in the repo.
  - Two commands are pre-approved in `.claude/settings.local.json`:
    - live SQL: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`
    - server functions: `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`
  - Look before you change anything live: run a read-only query first.
  - Check with me before anything that deletes data or changes sign-in, and **never** delete or change a real student's account or games to test something. Make test accounts only on the local copy.
  - The migrations were applied by hand. See the PLAN.md note about `supabase migration repair` before ever using `db push`, and add any new migration to that note.
- **Server functions:** edit `handler.ts`, then run `npm run build:functions` to rebuild `index.ts` (the file that gets deployed). A test fails if you forget.
- **Testing on this machine:**
  - Local Supabase needs Docker: `npx supabase start`, then `npm run test:db`. Run `npx supabase db reset` afterwards, or leftover test accounts make the profile tests fail.
  - `[auth.email] enable_signup = false` blocks email *logins* too. For local browser tests with password test users, switch it on briefly, then switch it back (and restart Supabase after editing `config.toml`).
  - Don't use `pkill -f <pattern>`: it kills its own shell. Find process IDs with `ps` and kill those.
  - "medium beats easy" in `src/games/chess/bot.test.ts` fails about once in seven runs. Re-run before assuming you broke it.
- **Screenshots and browser games:** Playwright is at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`, with Chromium at `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`. The earlier stage prompts in `docs/prompts/` describe the local test-user and two-browser setup; reuse it. Importing Stockfish in Node replaces the global `fetch`, so save and restore it.
- **Library versions:** newer than you may know (React 19, react-router 8, TypeScript 7, Vite 8, Vitest 5, supabase-js 2.117). Check their real APIs in `node_modules`.

## Your task: Stage 8 — ready for a real class

Everything is built. This stage proves it's safe and solid enough for a whole class, and gives me and the school what we need to say yes.

1. **Security review.** Go through the whole project as if you were trying to break it, as a curious Year 6 student with a Chromebook and the browser's developer tools:
   - Every table, view and database function: who can read, write or call it? Check the live project matches the migrations (policies, grants, `security definer` functions with a fixed `search_path`, nothing exposed to `anon` that shouldn't be). Use Supabase's own security and performance advisors on the live project and fix or explain every warning.
   - Both server functions: forged requests, someone else's game, replayed or doubled requests, huge or strange inputs, rate limits.
   - Realtime: can a student listen in on games they're not in?
   - Sign-in: a non-school Google account, a school account on a different domain spelling, an expired session.
   - The public repo and the published site: no secrets, no service keys, no personal data, no source maps you didn't mean to publish.
   - Write any missing tests (pgTAP for database rules, unit tests for functions) for what you check, so it stays checked. Fix what you find in small commits and tell me plainly how serious each one was.
2. **Definition of done check.** Go through BRIEF.md section 13 and PLAN.md's additions one line at a time. For each, say how it's proven (a test, a browser check, live data) or what's missing, and close any gaps. Put the finished list in PLAN.md.
3. **Classroom load.** A whole class (up to ~30 students) will sign in and play at the same time. Check, and test locally where you can:
   - Many students joining the lobby and starting friend games at once.
   - Slow or patchy school Wi-Fi: reloads, dropped connections, a Chromebook lid closed mid-game.
   - The free-tier limits in PLAN.md for a realistic week of class use (function calls, Realtime connections and messages, database size). Re-check the current numbers on supabase.com/pricing, since they change.
   - Fix anything that would go wrong in a real lesson.
4. **Privacy summary for the school.** Write `docs/PRIVACY-SUMMARY.md`: one page my principal or board can read, in plain language, covering:
   - what's stored about each student, where (Sydney, overseas: Privacy Principle 12), and why
   - what Supabase and Google keep on their side (including the Google name and email in Supabase's sign-in records)
   - who can see what (students, teachers, me as admin)
   - how to delete one student, and how the end-of-year cleanup works
   - what's deliberately not there: no ads, tracking, analytics, chat, free typing or photos
   - the honest limits of the free services (no uptime promise, pausing after a week, no official support)
   - what the school needs to do or approve
   Check every claim against the code and the live database, not against earlier docs.
5. **Class launch checklist.** Write `docs/CLASS-LAUNCH.md` for running the first whole-class lesson (replacing or extending `STUDENT-TRIAL.md` so it now covers friends, points, leaderboards and the teacher view):
   - the day before: wake the database, sign in, play a test game, check the friends switch
   - a simple lesson flow for 30–45 minutes
   - what to watch for, and what to do if something goes wrong in class (friends switch off, which error words mean what)
   - the paper problem slip, no typing and nothing personal, as before
   - how to look up a reported problem afterwards from a player name and a time
6. **Maintenance and redeploy guide.** Make sure the README has a short, clear section for someone who isn't me:
   - how to wake the site after the holidays
   - how a change gets published, and how to undo a bad one
   - how to redeploy a server function and apply a database change
   - start-of-year and end-of-year jobs (new season, removing students who have left, adding a new teacher)
   - what to do if Supabase or Google changes something (keys, limits, consent screen)
   - where the accounts live and who owns them
7. **Polish from real use.** Look at the live data for anything students have actually run into (games that failed to save, games abandoned a lot at the same point, friend games stuck waiting). Fix what's clearly a bug, and list anything else for me to decide.
8. **Check your work:**
   - Run the type check, tests, database tests, `npm run build:functions` and the production build.
   - In a real browser with local accounts, play one full game of each kind (chess and checkers, vs bots and vs a friend) and use every teacher action, at Chromebook (1366×768) and tablet (768×1024) sizes, with mouse, touch and keyboard.
   - Tell me plainly what's tested and what isn't.
9. **Finish up:**
   - Apply any migration and deploy any changed server function to the live project yourself, then check them from outside.
   - Update `docs/PLAN.md` (mark Stage 8 done, record any migration in the repair note) and the README.
   - Commit with clear messages on a branch. Only merge to `main` once everything passes and the live project is ready.

**Don't do these:** anything from Stage 9 (the space game), new games, new features, chat or free text, or new outside services. If you think something is missing, list it for me instead of building it.

When you're done, give me a short plain-English summary covering:
- what the security review found and fixed, from most to least serious
- whether every line of the definition of done is met, and anything that isn't
- what I need to send to the school (the privacy summary) and what they need to approve
- anything I need to click, one clear set of steps at a time
- what to do before the first whole-class lesson
- anything about cost, free-tier limits, privacy or licences I should know

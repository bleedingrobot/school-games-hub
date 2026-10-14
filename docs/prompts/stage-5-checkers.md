We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/. Stages 1–4 are done.

**Before doing anything, read these files:**
- `docs/BRIEF.md` is my full original brief. Section 5 covers checkers, section 12 sets how I want you to work, and section 13 says what "done" means.
- `docs/PLAN.md` is the agreed architecture, the decisions we've made, and the setup notes. Where it disagrees with the brief, PLAN.md wins.
- `README.md` explains how the project runs, is tested and is published.
- `supabase/migrations/`, `supabase/tests/` and `supabase/functions/` hold the database setup, its tests and the server functions.
- Stage 4's chess code, which Stage 5 should follow closely: `shared/chess/`, `src/games/chess/`, `src/data/botGames.ts` and `supabase/functions/save-bot-game/`.

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Where things stand

- **Website:** React + TypeScript + Vite with hash routes, published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
- **Sign-in:** Google through Supabase. Only @douglaspark.school.nz accounts get in.
- **Chess (Stage 4):**
  - chess.js rules in `shared/chess/`
  - a tap-to-move board
  - Very Easy, Easy and Medium bots (Stockfish in a Web Worker)
  - results saved to the `bot_games` table, through the `save-bot-game` server function, which replays every move before saving
- **Checkers page:** `/#/checkers?bot=easy` still shows "Coming soon". The dashboard's checkers stats are still sample data (`src/dev/sampleData.ts`).
- **The `bot_games` table** already accepts `game = 'checkers'`. Its `player_side` and `reason` columns take any short lowercase word, so checkers may not need a new migration. Check this yourself before deciding.
- **Supabase project:** `zqzhetlzvtptnkmeiumi` (Sydney, free plan).

## Things to know before you start

- **You can change Supabase yourself now.**
  - A Supabase access token is saved in `~/.supabase/access-token`. Never print it, copy it, or put it in the repo.
  - Two commands are pre-approved in `.claude/settings.local.json`:
    - live SQL: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`
    - server functions: `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`
  - Look before you change anything live: run a read-only query first.
  - Check with me before anything that deletes data or changes sign-in.
  - The migrations were applied by hand, not with `supabase db push`. See PLAN.md before ever using `db push`.
- **I often work remotely, on my phone.**
  - Never ask me to paste passwords, secret keys or login codes into the chat.
  - Keep anything you need me to click short, with one clear set of steps at a time.
- **Server functions:**
  - Edit `handler.ts`, then run `npm run build:functions` to rebuild the generated `index.ts`. That's the single file that gets deployed.
  - A test fails if you forget to rebuild.
  - `save-bot-game` currently only handles chess.
- **Testing on this machine:**
  - The local Supabase copy needs Docker: `npx supabase start`, then `npm run test:db`.
  - After editing `supabase/config.toml`, restart it with `npx supabase stop` and `npx supabase start`.
  - `[auth.email] enable_signup = false` blocks email *logins* too. For local browser tests with a password test user, switch it on briefly, then switch it back.
  - Run `npx supabase db reset` afterwards, or leftover test accounts make the profile tests fail.
  - `npm run functions:serve` runs the server functions locally.
- **Screenshots and browser games:**
  - Playwright is installed at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`. Pass the cached Chromium as `executablePath`: `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`.
  - In Stage 4, I signed in a local password test user with supabase-js and put the session in `localStorage` (key `sb-127-auth-token`) before the page loaded.
  - In Stage 4, the "student" was the engine in Node, picking moves and clicking squares by their accessible names.
- **Library versions:** these are newer than you may know (React 19, react-router 8, TypeScript 7, Vite 8, Vitest 5). Check their real APIs in `node_modules` before using them.

## Your task: Stage 5 — Checkers against the bots

1. **Checkers rules, written by us**, kept in `shared/checkers/` so the server can use the same code (PLAN.md: no well-tested library exists for English checkers). Follow English/American draughts on an 8×8 board, not international draughts:
   - pieces move diagonally forward on the dark squares; kings move both ways
   - captures are compulsory: if any capture exists, you must take one
   - multi-jumps must be finished, and a piece that's crowned mid-jump stops there
   - reaching the far row makes a king
   - a player loses when they have no pieces left or no legal move
   - draw after 40 moves each with no capture and no new king (PLAN.md decision)
   - decide and document who moves first and the board orientation, following the standard rules
2. **Thorough rules tests:**
   - forced captures
   - multi-jumps, including choosing between capture routes
   - kings
   - crowning ending a jump
   - wins by capture and by blocking
   - the 40-move draw
   - replaying a game and rejecting illegal moves
3. **The checkers board**, matching the chess board's look and feel:
   - big, clear and touch-friendly on Chromebooks and tablets
   - tap a piece, then tap where it goes
   - multi-jumps work step by step, or as one tap if there's only one route
   - turn indicator, the selected piece highlighted, its legal moves shown, the last move highlighted
   - make it obvious when a capture is compulsory, and why other moves aren't allowed
   - move summary, New game, Resign, and a friendly result screen with **Rematch**
   - keyboard-friendly, and the same optional sounds and mute button as chess
4. **Bots (Very Easy, Easy, Medium), as PLAN.md describes:**
   - our own look-ahead search, running in the browser
   - Very Easy looks 1 move ahead with lots of randomness; Easy looks 3 ahead; Medium looks 6 or more ahead
   - keep it fast on a Chromebook (consider a Web Worker if Medium is slow)
   - the bot pauses briefly so its moves feel natural
   - explain each level in kid-friendly words on the screen
   - test that every level only plays legal moves, including forced captures, multi-jumps and kings, and that each level beats the one below it
5. **Save every finished checkers game** in the same way as chess:
   - the server replays the moves with the shared checkers rules and decides the result
   - extend `save-bot-game`, or add a sibling function, whichever is simpler and safer
   - add a migration and pgTAP tests only if the database needs to change
   - abandoned and very short games are recorded but earn nothing
   - no points, ratings or leaderboards yet; those are Stage 7
6. **Dashboard:**
   - show real checkers stats and recent checkers games
   - remove the checkers sample stats
   - keep the SAMPLE DATA badge on anything still made up (points, levels, achievements)
7. **Check your work:**
   - run the type check, tests, database tests and production build
   - play full games against each checkers bot in a real browser, as both colours
   - take screenshots at Chromebook (1366×768) and tablet (768×1024) sizes
   - make sure chess still works
   - tell me plainly what's tested and what isn't
8. **Finish up:**
   - apply any database change and deploy the server function to the live project yourself, then check both from outside
   - update `docs/PLAN.md` (mark Stage 5 done) and the README
   - commit with clear messages on a branch
   - only merge to `main` (which publishes the live site) once everything passes and the live database and server function are ready
9. **Prepare the student trial.** PLAN.md has a small student trial of sign-in and bot games after Stage 5. Write a short, one-page checklist in `docs/`, in plain words. It should cover:
   - what I check before the lesson, including whether the free Supabase project has paused
   - what students try
   - what I watch for
   - how students report problems without typing anything personal

**Don't do these yet:** multiplayer (Stage 6), and points, badges, ratings or leaderboards (Stage 7).

When you're done, give me a short plain-English summary covering:
- what was built
- anything I need to click, one clear set of steps at a time (ideally nothing)
- what to try on the live site
- anything about cost, privacy or licences I should know

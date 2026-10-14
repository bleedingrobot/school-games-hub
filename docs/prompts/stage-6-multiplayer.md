We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/. Stages 1–5 are done.

**Before doing anything, read these files:**
- `docs/BRIEF.md` is my full original brief. Section 4 covers multiplayer, section 8 covers safety, section 12 sets how I want you to work, and section 13 says what "done" means.
- `docs/PLAN.md` is the agreed architecture, the decisions we've made, and the setup notes. Where it disagrees with the brief, PLAN.md wins.
- `README.md` explains how the project runs, is tested and is published.
- `docs/STUDENT-TRIAL.md` is the student trial checklist from Stage 5.
- `supabase/migrations/`, `supabase/tests/` and `supabase/functions/` hold the database setup, its tests and the server functions.
- The bot-game code that Stage 6 builds on:
  - rules: `shared/chess/`, `shared/checkers/`, `shared/botGame.ts`
  - boards and game pages: `src/games/chess/`, `src/games/checkers/`
  - saving: `src/data/botGames.ts` and `supabase/functions/save-bot-game/`

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Where things stand

- **Website:** React + TypeScript + Vite with hash routes, published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
- **Sign-in:** Google through Supabase. Only @douglaspark.school.nz accounts get in.
- **Bot games (Stages 4 and 5):**
  - Chess uses chess.js and Stockfish; checkers uses our own rules and bots.
  - Finished games go to the `save-bot-game` server function, which replays every move before saving to `bot_games`.
  - Reports carry `"game": "chess"` or `"game": "checkers"`. A report with no game is treated as chess.
- **Lobby page:** `/#/lobby` still shows "Coming soon". The dashboard's "Play a friend" card links to it.
- **Already in the database from Stage 3:**
  - `app_settings.multiplayer_enabled` and `teacher_set_multiplayer()`: the teacher's switch for turning multiplayer off.
  - `teacher_set_hidden()`: hides a student.
  - Check both yourself before relying on them.
- **Supabase project:** `zqzhetlzvtptnkmeiumi` (Sydney, free plan). 17+ real chess games have been saved on it.

## The student trial

PLAN.md has a small student trial after Stage 5. If I've given you notes from it, **fix those first**, in their own small commits, before starting multiplayer. If I haven't, ask me once whether the trial has happened. Don't hold up the work waiting for an answer.

## Things to know before you start

- **You can change Supabase yourself.**
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
  - A new function must be added to the `FUNCTIONS` list in `scripts/build-functions.mjs`.
  - A test fails if you forget to rebuild.
  - Keep each function's logic in a `handler.ts` with its Supabase calls passed in, so it can be tested without Supabase, the way `save-bot-game` does it.
- **Testing on this machine:**
  - The local Supabase copy needs Docker: `npx supabase start`, then `npm run test:db`.
  - After editing `supabase/config.toml`, restart it with `npx supabase stop` and `npx supabase start`.
  - `[auth.email] enable_signup = false` blocks email *logins* too. For local browser tests with password test users, switch it on briefly, then switch it back.
  - Run `npx supabase db reset` afterwards, or leftover test accounts make the profile tests fail.
  - `npm run functions:serve` runs the server functions locally.
  - `.env.local` already points the dev site at the local Supabase copy.
  - Don't use `pkill -f <pattern>` to stop the dev servers: it matches its own command and kills the shell. Find the process IDs with `ps` and kill those.
- **Screenshots and browser games:**
  - Playwright is installed at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`. Pass the cached Chromium as `executablePath`: `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`.
  - Sign in a local password test user with supabase-js, and put the session in `localStorage` (key `sb-127-auth-token`) before the page loads.
  - For two players, use **two separate browser contexts**, each with its own test user.
  - In Stage 5, the shared rules were bundled with `rolldown` into a single `.mjs` in the scratchpad, so a Node script could pick legal moves and click squares by their accessible names (chess: `e2`; checkers: `Square 11`).
  - Wait about a second before taking screenshots, or you'll catch the pop-in animations half-way.
  - Changing only the `#/...` part of the address keeps the same page open. Go via the dashboard to get a fresh game page.
- **Library versions:** these are newer than you may know (React 19, react-router 8, TypeScript 7, Vite 8, Vitest 5, supabase-js 2.117). Check their real APIs in `node_modules` before using them, especially supabase-js Realtime.

## Your task: Stage 6 — Multiplayer

Two signed-in students play chess or checkers against each other, live, on separate devices.

1. **Plan first, briefly.**
   - Before building, write a short design section in `docs/PLAN.md`:
     - the tables
     - the server function(s)
     - how live updates reach the other player
     - how cheating, races and disconnects are handled
     - what it costs against the free-tier limits in PLAN.md
   - If something can't be done reliably on the free plan, tell me before building it.
   - Then carry on; don't wait for my approval unless there's a real choice only I can make.
2. **Starting and joining a game:**
   - **Game code:** a student creates a game (chess or checkers), picks or randomises their colour, and gets a short code that's easy to read aloud and type. Use no lookalike characters such as O/0 or I/1. A friend types the code to join.
   - **Open lobby:** a student can instead post the game in the lobby, where others see it with the creator's display name and avatar only, and tap to join.
   - The creator can cancel a game nobody has joined. Unjoined games expire on their own after a while.
   - Nobody can join their own game, join a full game, or have lots of waiting games at once.
   - Hidden students don't appear in the lobby and can't play.
   - When the teacher's switch has multiplayer turned off, the lobby says so kindly and the server refuses new games and moves.
3. **Playing live:**
   - Reuse the chess and checkers boards. Show the opponent's avatar and name, whose turn it is, the move list, and the last move.
   - **The server is the referee.** The browser only *asks* to move. A server function checks:
     - that it's that student's game and turn
     - that the move is legal, using the shared rules
     - the game hasn't ended
   - The server then saves the move and decides any result. Never trust the browser.
   - No out-of-turn moves and no double moves. Two requests arriving at once must not both succeed: use a row lock or a move-number check.
   - The other player sees each move within a second or two, through Supabase Realtime.
   - Students can only read games they're playing in. The lobby shows waiting games only, with no emails or IDs beyond what's needed.
4. **Ending a game (PLAN.md decisions):**
   - checkmate, stalemate and every draw rule in chess; all checkers endings, including the 40-move draw
   - **Resign**, with a confirm step
   - **Offer a draw**, which the opponent accepts or declines. Don't let a student spam offers.
   - If a player doesn't move for **2 minutes**, their opponent can **claim the win**. Use the server's clock, not the browser's.
   - Leaving or abandoning counts as a loss for the leaver.
   - Very short and abandoned games are recorded but will earn nothing, like bot games.
   - A friendly result screen for both players, with **Rematch**: the same opponent, colours swapped, and both must agree.
5. **Disconnects and coming back:**
   - Reloading the page, closing the lid, or losing Wi-Fi briefly must not lose the game. The student can reopen it from the dashboard or lobby and carry on.
   - Show clearly when the opponent seems to be away. If live updates drop, fall back to checking now and then.
   - A student's unfinished multiplayer game should be easy to find on the dashboard.
6. **Dashboard and stats:**
   - Recent games include multiplayer games, showing the opponent's display name and avatar.
   - Keep multiplayer and bot results separate in the stats. Bot games must never count towards Stage 7 rankings.
   - Keep the SAMPLE DATA badge on anything still made up.
7. **Safety:**
   - no chat, no free text, no emails or real names anywhere
   - students can't read or change anyone else's games or profiles
   - logs say what went wrong, never who
   - friendly error messages that reveal nothing technical
   - rate-limit move and create requests sensibly
   - flag anything that affects privacy, security or cost
8. **Tests:**
   - **Rules and server handlers:** turn order, illegal moves, moves after the game ends, the wrong player moving, two requests arriving at once, resign, draw offers, the 2-minute claim (with a fake clock), the multiplayer switch, hidden students, and joining rules.
   - **pgTAP:** row-level security (outsiders, the other player, a third student, teachers), and that the website can't write game tables directly.
   - **Interface:** lobby, code entry, the waiting screen, the opponent-away state, and the result screen.
9. **Check your work:**
   - Run the type check, tests, database tests and production build.
   - In a real browser, with **two separate local accounts in two browser contexts**, play full games of **chess and checkers** to the end:
     - one ending by the rules, one by resignation, one by an accepted draw, and one by a 2-minute claim (shorten the timer only in the test)
     - a reload in the middle of a game, to check the student can carry on
   - Take screenshots at Chromebook (1366×768) and tablet (768×1024) sizes.
   - Make sure bot games for both chess and checkers still work and save.
   - Tell me plainly what's tested and what isn't.
10. **Finish up:**
    - Apply the migration and deploy the server function(s) to the live project yourself (enable Realtime for the right tables in the migration, not by hand), then check both from outside.
    - Record the migration in the PLAN.md note about `supabase migration repair`.
    - Update `docs/PLAN.md` (mark Stage 6 done) and the README, including how multiplayer works and what to do if it misbehaves in class (the teacher's off switch).
    - Commit with clear messages on a branch.
    - Only merge to `main` once everything passes and the live database and server functions are ready.
11. **The live two-account test.** Definition of done needs two real school accounts playing each other live, and only I can sign in with those. Give me one short set of steps I can do on two devices, such as my laptop and a Chromebook, or with a colleague. Then check the saved games in the live database afterwards and tell me what you found.

**Don't do these yet:** points, XP, levels, badges, Elo ratings, leaderboards, or teacher screens (all Stage 7). The teacher's multiplayer switch must already *work* on the server, but its button can wait for Stage 7. Store results so Stage 7 can calculate ratings from them later.

When you're done, give me a short plain-English summary covering:
- what was built
- anything I need to click, one clear set of steps at a time
- what to try on the live site, including the two-device test
- anything about cost, free-tier limits, privacy or licences I should know

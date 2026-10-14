We're building **School Games Hub**: a chess and checkers website for my Year 4–6 students at Douglas Park School. The project is in `~/projects/school-games-hub` (GitHub: bleedingrobot/school-games-hub, public). It's live at https://bleedingrobot.github.io/school-games-hub/. Stages 1–3 are done.

**Before doing anything, read these files:**
- `docs/BRIEF.md` is my full original brief. Section 4 covers chess, section 12 sets how I want you to work, and section 13 says what "done" means.
- `docs/PLAN.md` is the agreed architecture, the decisions we've made, and the setup notes. Where it disagrees with the brief, PLAN.md wins.
- `README.md` explains how the project runs, is tested and is published.
- `supabase/migrations/` and `supabase/tests/` hold the database setup and its tests.

I'm a teacher, not a developer. Please explain things in plain, simple words, and make the technical decisions yourself.

## Where things stand

- **Website:** React + TypeScript + Vite with hash routes, published to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.
- **Sign-in:** Google through Supabase. Only @douglaspark.school.nz accounts get in. This is checked by a sign-up hook, a database trigger and row level security. Students and I have tested it with real accounts.
- **Profiles:** a word-list name, avatar codes and a role (student or teacher). I'm the first teacher.
- **Chess page:** `/#/chess?bot=easy` currently shows "Coming soon". The dashboard's sample stats are in `src/dev/sampleData.ts`.
- **Supabase project:** `zqzhetlzvtptnkmeiumi` (Sydney, free plan).

## Things to know before you start

- **I often work remotely and can't run terminal commands that need logins.**
  - Never ask me to paste passwords, secret keys, login codes or the database password into the chat.
  - To change the live database, give me SQL to paste into the Supabase **SQL Editor**, via a GitHub link to the migration file and its "Copy raw file" button. That worked well in Stage 3.
  - Edge Functions can be deployed from the Supabase dashboard's own editor if the CLI isn't logged in.
  - The CLI has never been used on the live project. If you ever use `supabase db push`, first run `npx supabase migration repair --status applied 20261015000100` (see PLAN.md).
- **Testing on this machine:**
  - The local Supabase copy needs Docker: `npx supabase start`, then `npm run test:db`.
  - After editing `supabase/config.toml`, restart it with `npx supabase stop` and `npx supabase start`.
  - `[auth.email] enable_signup = false` blocks email *logins* too. For local browser tests with a password test user, switch it on briefly, then switch it back.
- **Screenshots:** Playwright can use the cached Chromium at `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` (pass it as `executablePath`).
- **Library versions:** these are newer than you may know (React 19, react-router 8, TypeScript 7, Vite 8, Vitest 5). Check their real APIs in `node_modules` before using them.

## Your task: Stage 4 — Chess against the bots

1. **Chess rules with chess.js**, kept in `shared/` so the server can use the same code later:
   - every rule: legal moves, check, checkmate, stalemate, all the draw rules, castling, en passant and promotion
   - promotion lets the student choose the piece
2. **The chess board:**
   - big, clear and touch-friendly on Chromebooks and tablets
   - a turn indicator, the selected piece highlighted, its legal moves shown, the last move highlighted
   - move history, New game, Resign, and a clear, friendly result screen
   - keyboard-friendly where practical
   - optional move and capture sounds that follow the mute button (sound starts off)
3. **Bots (Very Easy, Easy, Medium), as PLAN.md describes:**
   - Stockfish compiled to WebAssembly, running in a Web Worker in the browser
   - Stockfish's files hosted in this repo, not loaded from another website
   - **Check Stockfish's licence (GPL)** for a public repo served from GitHub Pages, tell me plainly what it means, and keep its licence notice with it
   - explain the difficulty settings in kid-friendly words on the screen
   - the bot should pause briefly so its moves feel natural
4. **Tests:**
   - the rules, especially castling, en passant, promotion, checkmate, stalemate and the draw rules
   - every bot level only ever plays legal moves, including in special positions (promotion, en passant, castling, check)
5. **Save every finished bot game** (PLAN.md: results are saved from Stage 4):
   - a new migration with a games/results table that has row level security, plus pgTAP tests
   - a server-side check that replays the moves with chess.js and decides the result, so the browser can't fake a win (an Edge Function, or whatever you judge simplest and safest)
   - students can only see their own games for now
   - abandoned or very short games are recorded but earn nothing
   - no points, ratings or leaderboards yet; those are Stage 7
6. **Dashboard:**
   - replace the sample "Recent games" and chess stats with real data where it now exists
   - keep the SAMPLE DATA badge on anything still made up
7. **Check your work:**
   - run the type check, tests, database tests and production build
   - play full games against each bot in a real browser
   - take screenshots at Chromebook (1366×768) and tablet (768×1024) sizes
   - tell me plainly what's tested and what isn't
8. **Finish up:**
   - update `docs/PLAN.md` (mark Stage 4 done) and the README
   - commit with clear messages
   - work on a branch, and only merge to `main` (which publishes the live site) once everything passes and any database changes I need to paste are already live

**Don't do these yet:** checkers (Stage 5), multiplayer (Stage 6), and points, badges or leaderboards (Stage 7).

When you're done, give me a short plain-English summary covering:
- what was built
- what I need to click or paste, one clear set of steps at a time
- what to try on the live site
- anything about cost, privacy or licences I should know

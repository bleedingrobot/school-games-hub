# School Games Hub

A chess and checkers website for Year 4–6 students. Students will sign in with their school Google account, build an avatar, and play against computer bots or each other.

**Live site:** https://bleedingrobot.github.io/school-games-hub/

**Where it's up to:** Stages 1–4 of 8 are done. Students sign in with their Douglas Park Google account, pick a safe player name, build an avatar, and play chess against three bots. Every finished chess game is checked by the server and saved. Checkers, playing each other, and points come in later stages; those pages say "Coming soon". The full plan is in [docs/PLAN.md](docs/PLAN.md).

## How sign-in stays school-only

Only `@douglaspark.school.nz` accounts can get in, and that's checked three times, all on the server:

1. Google's sign-in screen (the Google project is "Internal" to the school).
2. Supabase refuses to create an account for any other email (a sign-up hook, plus a database backstop).
3. Every read of the database re-checks the school email, and students can only change their own name and avatar.

Profiles store a random ID, a word-list name (like "Speedy Otter 27") and avatar codes. No emails or real names. Supabase's own sign-in records do keep each student's Google email and name; only the server can see those.

**Making someone a teacher:** the first teacher is made by hand. Sign in to the website once, then in Supabase go to **SQL Editor** and run
`select public.make_first_teacher('your.email@douglaspark.school.nz');`
After that, teachers can make other staff teachers from inside the app (teacher screens arrive in Stage 7).

## Chess against the bots

Students pick a bot and a colour, then tap a piece and tap a dot to move. The board works with a mouse, a touchscreen or a keyboard (arrow keys and Enter). The rules come from [chess.js](https://github.com/jhlywa/chess.js), a well-tested chess library: check, checkmate, stalemate, castling, en passant, promotion (the student picks the piece) and all the draw rules.

| Bot | What it does |
|---|---|
| **Very Easy** | Picks any legal move, a bit more likely to grab a piece. Never thinks ahead. |
| **Easy** | Stockfish at its weakest setting, looking 3 moves ahead, plus a random move 1 time in 5. |
| **Medium** | Stockfish at skill 6 of 20, looking 8 moves ahead. Steady, but beatable with a plan. |

**Stockfish** is a free, open-source chess engine. It runs inside the student's browser (so it costs nothing), and its files are part of this website, in `public/stockfish/`. To make a bot easier or harder, change `BOT_SETTINGS` in [src/games/chess/bot.ts](src/games/chess/bot.ts). The bot waits about a second before moving so it feels natural.

### How results are saved (and why they can't be faked)

When a game ends, the website sends the list of moves to a small **server function** called `save-bot-game`. The server replays every move with the same chess rules, decides who won by itself, and only then saves the game. It ignores what the browser *says* the result was. Students can see only their own games.

- Resigning counts as a loss.
- Leaving a game part-way through (closing the tab, going back home, or pressing New game) is saved as **unfinished**, and counts as a loss.
- Unfinished games, and games where the student made fewer than 10 moves, are saved but will **earn nothing** when points arrive in Stage 7.
- One honest limit: the bot runs in the browser, so a very determined student could fake *the bot's* moves. The server still checks every move is legal. That's why bot games will only ever earn small, capped points and never count towards the competitive rankings.

## The pretend data

Points, levels, badges and checkers results don't exist yet, so the dashboard shows **made-up sample data** for those. Anything made up has a yellow **SAMPLE DATA** badge next to it. The name, avatar, recent games and chess stats are real.

All of it lives in one file: [src/dev/sampleData.ts](src/dev/sampleData.ts). It gets deleted once real data takes over.

## Running it on your computer

You need **Node.js** version 22 or newer. Check by typing `node -v` in a terminal. If it's missing, get the "LTS" version from nodejs.org.

In VS Code, open the project folder, then open a terminal (**Terminal → New Terminal**) and type:

```bash
npm install
```

You only need this the first time, or after the project's packages change. Then:

```bash
npm run dev
```

It prints a link like `http://localhost:5173/`. Ctrl-click it to open the site. Changes you save show up straight away. Press **Ctrl+C** in the terminal to stop it.

## Checking it works

| Command | What it does |
|---|---|
| `npm test` | Runs the automatic tests |
| `npm run typecheck` | Checks the code for type mistakes |
| `npm run build` | Builds the finished website into the `dist` folder |
| `npm run check` | Does all three, in that order |
| `npm run test:db` | Tests the database rules (needs the local Supabase copy, see below) |
| `npm run build:functions` | Rebuilds the server functions after you change them (see below) |

Run `npm run check` before pushing. If it says everything passed, the publish will work too.

### Testing the database rules on your computer

This needs **Docker Desktop** installed and running. Then:

```bash
npx supabase start     # first time downloads a lot; later it's quick
npm run test:db
npx supabase stop      # when you're done
```

## How publishing works

Every time you push to the `main` branch on GitHub, GitHub automatically:

1. runs the type check, tests and build,
2. and, if they all pass, puts the new version on the live site.

It takes about 1–2 minutes. To watch it, open the repo on GitHub and click the **Actions** tab. A green tick means it's live. A red cross means something failed: nothing was published, and the old version stays up. Click the red run to see what went wrong.

### One-time setup (already done, here for reference)

On GitHub, open the repo, then go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. There's nothing else to set.

## Where things are

```
src/              the website
  pages/          one file per page (Dashboard, Lobby, Leaderboard...)
  components/     building blocks used on many pages (buttons, cards, avatar)
  games/          one folder per game, plus registry.ts which lists them
  dev/            development-only sample data, to be deleted later
  styles.css      colours, sizes and layout
  auth/           sign-in and keeping pages private
  avatar/         avatar parts and drawing
  data/           talking to the database
  games/chess/    the chess board, the bots, and the Stockfish connection
public/stockfish/ the Stockfish chess engine files and their licence
shared/           game rules shared with the server (chess.js rules, deciding results)
supabase/         database setup (migrations), its tests, server functions, local settings
scripts/          builds the server functions into single files
docs/             the plan and the original brief
.github/workflows the automatic test-and-publish steps
```

**Adding a game later:** make a new folder in `src/games/` (copy `chess/` as a starting point) and add one line to `src/games/registry.ts`. It then gets its own card on the dashboard and its own page.

## Server functions (Supabase Edge Functions)

Server functions live in `supabase/functions/`. Each one has a `handler.ts` (the logic, with tests) and an `index.ts`, which is **generated**: it's the single file that gets deployed. After changing a handler, or the chess rules in `shared/`, run `npm run build:functions`. A test fails if you forget.

To update a function on the live site without the Supabase CLI:

1. On GitHub, open `supabase/functions/<name>/index.ts` and click **Copy raw file**.
2. In Supabase, go to **Edge Functions**, open the function, click **Code**, select everything, paste, then click **Deploy**.

`save-bot-game` must have **Verify JWT** switched **off** (under the function's **Details**). That's safe: the function checks the student's sign-in itself.

## After the school holidays

The free Supabase plan **pauses a project after a week with nobody using it**. If the site says sign-in isn't working after a break: log in at supabase.com, open the project and click **Restore project**. It takes a few minutes and nothing is lost.

## Licences

- **Stockfish** (the chess engine) is GPL version 3. Its licence and a link to its source code sit next to it in [public/stockfish/](public/stockfish/NOTICE.md). Keep them there if Stockfish is updated.
- **chess.js** is BSD-2-Clause. **Chess piece pictures** are Colin M.L. Burnett's "cburnett" set, GPL ([notice](src/games/chess/pieces/NOTICE.md)).

## Privacy and safety so far

- No tracking, analytics, ads or outside fonts. Everything the site loads comes from this repo.
- The browser saves the sign-in session and whether sound is on (sound starts off). Signing out clears the session.
- Names come from word lists, avatars from a fixed set of parts. There's no free typing and no photo uploads.
- Each saved bot game stores the student's random ID, the bot level, the moves, the result and the time. Nothing else. Deleting a student deletes their games.
- The chess engine runs on the student's own device. Nothing about their games goes anywhere except our Supabase database.
- The code is public, so **no passwords or secret keys ever go in it**. Only Supabase's public "publishable" key goes in the website (in `src/config.ts`). It's safe to share because the database rules do the protecting.

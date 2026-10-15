# School Games Hub

A chess and checkers website for Year 4–6 students. Students will sign in with their school Google account, build an avatar, and play against computer bots or each other.

**Live site:** https://bleedingrobot.github.io/school-games-hub/

**Where it's up to:** all 8 stages are done, and it's ready for a whole class. Students sign in with their Douglas Park Google account, pick a safe player name, build an avatar, and play chess or checkers against three bots or against each other. Every game is checked by the server, saved, and turned into points, levels, badges and achievements, with weekly and all-time leaderboards. Teachers have their own screen to look after students. The full plan is in [docs/PLAN.md](docs/PLAN.md).

- **Running a lesson:** [docs/CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md) (the day before, a lesson plan, what error messages mean, the problem slip).
- **For the principal and board:** [docs/PRIVACY-SUMMARY.md](docs/PRIVACY-SUMMARY.md).
- **Looking after the site:** [Looking after the site](#looking-after-the-site) below.

## How sign-in stays school-only

Only `@douglaspark.school.nz` accounts can get in, and that's checked three times, all on the server:

1. Google's sign-in screen (the Google project is "Internal" to the school).
2. Supabase refuses to create an account for any other email (a sign-up hook, plus a database backstop).
3. Every read of the database re-checks the school email, and students can only change their own name and avatar.

Profiles store a random ID, a word-list name (like "Speedy Otter 27") and avatar codes. No emails or real names. Supabase's own sign-in records do keep each student's Google email and name; only the server can see those.

**Making someone a teacher:** the first teacher is made by hand. Sign in to the website once, then in Supabase go to **SQL Editor** and run
`select public.make_first_teacher('your.email@douglaspark.school.nz');`
After that, teachers can make other staff teachers from the **Teacher** page (see below).

## Chess against the bots

Students pick a bot and a colour, then tap a piece and tap a dot to move. The board works with a mouse, a touchscreen or a keyboard (arrow keys and Enter). The rules come from [chess.js](https://github.com/jhlywa/chess.js), a well-tested chess library: check, checkmate, stalemate, castling, en passant, promotion (the student picks the piece) and all the draw rules.

| Bot | What it does |
|---|---|
| **Very Easy** | Picks any legal move, a bit more likely to grab a piece. Never thinks ahead. |
| **Easy** | Stockfish at its weakest setting, looking 3 moves ahead, plus a random move 1 time in 5. |
| **Medium** | Stockfish at skill 6 of 20, looking 8 moves ahead. Steady, but beatable with a plan. |

**Stockfish** is a free, open-source chess engine. It runs inside the student's browser (so it costs nothing), and its files are part of this website, in `public/stockfish/`. To make a bot easier or harder, change `BOT_SETTINGS` in [src/games/chess/bot.ts](src/games/chess/bot.ts). The bot waits about a second before moving so it feels natural.

## Checkers against the bots

This is English checkers (also called American checkers or draughts) on an 8×8 board. It's **not** international draughts, which has a bigger board and "flying" kings.

- Red goes first (the official rules call that side "Black"; on most boards those pieces are red). Each student plays from their own side, with their pieces at the bottom.
- Pieces move one square diagonally forwards. Reaching the far side makes a **king** (it gets a crown), which can also move backwards.
- **If you can jump, you must.** The pieces that can jump glow, and a note says why the others can't move. If a piece can keep jumping, it must, and the whole jump is one move. A piece crowned part-way through a jump stops there.
- Multi-jumps: tap the piece, then each landing square. If there's only one way to go, one tap does the whole jump.
- You win by capturing all the other side's pieces, or by blocking them so they can't move. After 40 moves each with no capture and no new king, it's a draw.
- The little numbers on the dark squares are the standard checkers square numbers (1–32). The move list uses them, e.g. "11 – 15", or "15 × 24" for a jump.

There's no well-tested library for English checkers, so we wrote the rules ourselves in [shared/checkers/rules.ts](shared/checkers/rules.ts), with thorough tests next to them.

The checkers bots are our own too. They "look ahead": try each move, then each reply, and so on, and pick the move that leads to the best position. They run in a Web Worker inside the student's browser, so they cost nothing and the page never freezes.

| Bot | What it does |
|---|---|
| **Very Easy** | Looks 1 move ahead, with lots of randomness. Often blunders. |
| **Easy** | Looks 3 moves ahead, with a little randomness. Spots simple jumps. |
| **Medium** | Looks 6 moves ahead (up to 8 when there's time) and always follows a jump to the end. |

To make a bot easier or harder, change `BOT_SETTINGS` in [src/games/checkers/bot.ts](src/games/checkers/bot.ts). The tests check each level beats the one below it.

### How results are saved (and why they can't be faked)

When a chess or checkers game ends, the website sends the list of moves to a small **server function** called `save-bot-game`. The server replays every move with the same rules (chess.js for chess, our checkers rules for checkers), decides who won by itself, and only then saves the game. It ignores what the browser *says* the result was. Students can see only their own games.

- Resigning counts as a loss.
- Leaving a game part-way through (closing the tab, going back home, or pressing New game) is saved as **unfinished**, and counts as a loss.
- Unfinished games, and games where the student made fewer than 10 moves, are saved but **earn nothing**.
- One honest limit: the bot runs in the browser, so a very determined student could fake *the bot's* moves. The server still checks every move is legal. That's why bot games earn only small, capped points and never count towards badges.

## Playing a friend

Students tap **Play a friend** on the dashboard (or **Lobby** at the top) and either:

- **Start a game:** pick chess or checkers and a colour (or "Surprise me"). They get a 5-character **game code**, like `KM4 TP`, to read out to a friend. Codes never use vowels or lookalike characters (no O/0, I/1/L, S/5, Z/2 or B/8), and typing them in lower case or with a space is fine. They can also choose **Anyone in the lobby**, which lists the game for everyone to see with just their player name and avatar.
- **Join a game:** type a friend's code, or tap **Join** next to a game in the lobby.

The game starts the moment someone joins. Then:

- Each move appears on the other screen within about a second (it took 0.3 seconds in testing).
- **Resign** asks "Are you sure?" first, and counts as a loss.
- **Offer a draw:** the other player taps Yes or No. Making a move instead also says no. Each player can offer at most 3 draws a game, with at least 5 of their own moves between offers. When they can't offer one, the button greys out and a note says why.
- **The 2-minute rule:** if it's your opponent's turn and they haven't moved for 2 minutes, a **Claim the win** button appears. The server's clock decides, not the device's. Walking away counts as a loss for the one who left.
- If the other player closes the page or loses Wi-Fi, their card says **away** after a few seconds.
- At the end, both players see the result. **Rematch** starts a new game with the colours swapped, once both players have pressed it.
- A waiting game is cancelled after 10 minutes if nobody joins (or straight away with **Cancel**). Each student can have one waiting game at a time.

**Coming back to a game:** reloading the page, closing the Chromebook lid or losing Wi-Fi doesn’t lose the game. If the Wi-Fi blips for a moment, the site quietly tries again once. Unfinished games are shown at the top of the dashboard and in the lobby, with a **Carry on** button. If nobody moves for 30 minutes, the game ends by itself as a loss for the player whose turn it was.

### Why students can't cheat

The website never changes a game itself. It only *asks* a server function called `multiplayer`, which checks the student's sign-in, that it's their game and their turn, that the move is legal (using the same rules code as the bot games), and that the game isn't over. The server alone decides checkmate, every draw rule and every checkers ending. If two requests arrive at the same moment (say, a double-tap), only one gets through. Students can only read the games they're playing in.

Games that were abandoned, or where either player made fewer than 10 moves, are saved but **earn nothing**. Games against friends and bot games are kept apart in the stats, and bot games never count towards badges.

### If games against friends misbehave in class

You can switch them off for everyone straight away: open the **Teacher** page and press **Pause games against friends**. The lobby then says "Your teacher has paused games against friends for now", and the server refuses new games and moves. Games already going can still be resigned. Bot games carry on as normal. Press **Switch games against friends back on** to undo it.

If you can't sign in for some reason, the same switch works from Supabase: **SQL Editor**, paste
`update public.app_settings set multiplayer_enabled = false where id;` and click **Run** (`true` switches it back on).

Other problems:

- **Moves seem slow or stuck:** the page checks for moves every few seconds even if live updates drop, and reloading is always safe. If several students see it at once, Supabase may be having a hiccup; check status.supabase.com.
- **"We couldn't find a game with that code":** the code may be mistyped, or the game may have already started, been cancelled or waited 10 minutes. Make a new one.
- **A student keeps leaving games:** each one is recorded as a loss for them, and earns nothing.

## Points, levels, badges and leaderboards

Students can read all of this on the **How points work** page (linked from the dashboard and the leaderboard). The numbers on that page come straight from the database, so it never disagrees with the scoring.

**How to explain it to a class:**

- Every game you finish earns points, **even if you lose**. Harder bots earn more, and playing a friend earns the most.
- Bots can earn you up to 40 points a day. Playing the same friend, your first 5 games together each day earn points.
- Every achievement earns 10 bonus points. Points take you up levels.
- Games only count if you each make at least 10 moves. Leaving early earns nothing.
- Your **badge** (Bronze, Silver, Gold, Champion) comes only from games against friends. Win and you take some of the other player's hidden score; beat someone better and you climb more.

| Points | Lose | Draw | Win |
|---|---|---|---|
| Very Easy bot | 1 | 2 | 3 |
| Easy bot | 2 | 3 | 5 |
| Medium bot | 3 | 5 | 8 |
| A friend | 4 | 6 | 8 |

**Levels:** level 2 at 50 points, level 3 at 125, level 4 at 225, and each level needs 25 more than the last.

**Ratings and badges:** each student has a hidden chess score and a hidden checkers score, starting at 1000. Only games against friends change them (an "Elo" rating: a win against an equal player is +10, and one game moves it by 20 at most). Badges: **Silver** at 1030 (about 3 more wins than losses against players at your level), **Gold** at 1080 (about 8 more), **Champion** at 1150 with at least 15 games against friends. Students never see the numbers, only the badge and how close they are to the next one.

**Achievements:** 12 for each game: first game, first win, 10 and 50 games, beating each bot, beating a friend, reaching Silver, Gold and Champion, plus Checkmate! (chess) and Crown 5 kings (checkers).

**Leaderboards** (chess and checkers each): **This week** (points since Monday midnight, NZ time; needs 3 games), **All time** (by badge; needs 5 games against friends) and **Most improved** (the biggest climb this week; needs 3 games against friends). Students see the top 10 plus their own place. Boards show only player names, avatars and badges. Hidden students aren't on them.

**Why it can't be faked:** everything is worked out inside the database, the moment the server saves a game. The website can only read the results; it can't write points, ratings or badges, and it can't call the code that works them out.

## Wormholes & Black Holes (the space game)

A space snakes and ladders for 2–4 rockets: against 1–3 bots, with classmates, or pass-and-play (2–4 people taking turns on one Chromebook, never saved and no points). Race from Earth to the space station. Wormholes zoom you up, black holes pull you down, and stars give items that help you (or slow the others down). The full design, the simulation results and every decision are in [docs/SPACE-GAME-PLAN.md](docs/SPACE-GAME-PLAN.md).

- **Boards:** Inner Solar System (gentle), Nebula (medium, the default), Deep Space (wild), Asteroid Belt (a quick 50-square game), and **Random Galaxy**. A galaxy has a code like `Comet-Kiwi-48`, so a class can all type the same one in. **Galaxy of the day** is the same for everyone that day.
- **Modes:** **Cosmic** (everything) or **Classic** (just wormholes and black holes, no items and nothing to aim at other players). Use Classic for a gentler lesson.
- **How long:** about 4–8 minutes for a big board, 2–4 for Asteroid Belt. A fuel gauge ends any game that drags on (places then go by how far everyone got).
- **How to play** and the **Star chart** open from the settings, the game (button or the `?` key) and the waiting room. How to play has a picture and one line for every square and item, the fair-play rules and the keys. Landing on a star (or a wormhole, black hole, comet...) shows a short space fact, which is collected on the student's **Star chart**. The Star chart is kept on that device only, not in the database. The facts are in [shared/space/facts.ts](shared/space/facts.ts).
- **Cosmic events** (on by default on Deep Space, a setting elsewhere): every 5 rounds, solar wind, a meteor shower or a wormhole shift, with a banner and a line in the mission log.
- **Sound** is off until the student turns it on, like chess and checkers. **Less motion** turns hops into slides and stops things popping in (it's on automatically if the device asks for less motion).
- **Keyboard:** Space or Enter rolls, 1–3 use items or pick cards, 1–6 picks a Navigator roll, arrow keys move between buttons, Escape closes things. Every move is read out by screen readers through the mission log.

**Points:** taking part only. It's a dice game, so winning is mostly luck and never earns more than losing. A finished bot game earns **2** (inside the same 40-a-day bot limit as chess and checkers). A finished classmates game earns **4** (the first 6 a day). Games under 5 turns, and players who leave or go on autopilot, earn nothing. Space games **never** change ratings, badges or leaderboards. There are 6 space achievements (10 points each).

**Playing classmates:** one student taps **Play a friend → Start a game → Wormholes & Black Holes**, picks a board, and reads out the code. Up to 3 others join with it (or from the lobby). The host can fill empty seats with bots, then presses **Launch**. The server rolls every die. Each turn has 30 seconds (15 for a choice). A student who misses 3 turns in a row goes on **autopilot**, so the game carries on for everyone; they can **Take the controls** back, but that game no longer earns them points. At the end, **Rematch** starts a new waiting game with the same board.

**Teacher switches:** the **Pause games against friends** switch covers space games too. **Emoji reactions in space games** (on the Teacher page, off to start) lets students send one of 6 fixed emoji (🚀 👏 😮 🎉 😂 👍) over their rocket, at most one every 5 seconds and 20 a game. There's no text and no chat. Each student can hide reactions on their own screen with 🙈.

**Why it can't be faked:** bot games play in the browser from a dice "seed" the server stamps at the start. At the end the server replays the whole game from that seed before saving it. In classmates games the server rolls the dice and runs the rules, and the website only asks.

## The teacher view

Teachers see a **Teacher** link in the top bar (students don't, and the database refuses them even if they type the address). It has:

- **Games against friends:** pause them for everyone (chess, checkers and space games), or switch them back on.
- **Emoji reactions in space games:** off to start (see the space game section).
- **Players:** everyone with an account, with their player name, avatar, games played and when they last played. Type in **Find a player** to search. Tap someone to see their games against bots and friends, how many they left early, their badges and their last 10 games. Then:
  - **New name:** gives them a new random name (for a name that's being used to tease). They can pick their own again.
  - **Hide / Show again:** a hidden student is left off leaderboards and the lobby, and can't play friends. Their bot games still work.
  - **Make teacher / Remove teacher:** for other staff. You can't change your own role, so there's always at least one teacher.
  - **Delete:** removes the student's account and all their games, points and achievements. You type their player name to confirm. It can't be undone. Friends they played keep those games, without their name. If they sign in again, they start fresh. Teachers can't be deleted (remove their teacher role first).
- **End of year: start a new season:** see below.

Teachers can see students' games and stats only through these screens; the database gives them nothing else.

### End-of-year cleanup (new season)

At the start of a new school year, on the Teacher page, type `NEW SEASON` (in capitals) and press **Start a new season**. It:

- **deletes** every finished game, and every point, level, badge, achievement and leaderboard place, so everyone starts fresh;
- **keeps** every account, player name and avatar, the teachers, who is hidden, the friend-games switch, and any games still being played.

It can't be undone. Delete students who have left the school first, one by one. It also frees space in the free database.

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
  styles.css      colours, sizes and layout
  auth/           sign-in and keeping pages private
  avatar/         avatar parts and drawing
  data/           talking to the database
  multiplayer/    the shared screen for games against friends, and keeping them up to date
  games/chess/    the chess board, the bots, and the Stockfish connection
  games/checkers/ the checkers board and our own checkers bots
  games/space/    Wormholes & Black Holes: board, screens, How to play, Star chart, bot worker
  space/          keeping a space game with classmates up to date
public/stockfish/ the Stockfish chess engine files and their licence
shared/           game rules shared with the server (chess and checkers rules, deciding results, refereeing friend games)
  space/          the space game's rules engine, boards, bots, galaxy codes, space facts and simulation
supabase/         database setup (migrations), its tests, server functions (save-bot-game, multiplayer, space-game), local settings
scripts/          builds the server functions into single files
docs/             the plan and the original brief
.github/workflows the automatic test-and-publish steps
```

**Adding a game later:** make a new folder in `src/games/` (copy `chess/` as a starting point) and add one line to `src/games/registry.ts`. It then gets its own card on the dashboard and its own page.

## Server functions (Supabase Edge Functions)

Server functions live in `supabase/functions/`. Each one has a `handler.ts` (the logic, with tests) and an `index.ts`, which is **generated**: it's the single file that gets deployed. After changing a handler, or the rules in `shared/`, run `npm run build:functions`. A test fails if you forget.

To update a function on the live site without the Supabase CLI:

1. On GitHub, open `supabase/functions/<name>/index.ts` and click **Copy raw file**.
2. In Supabase, go to **Edge Functions**, open the function, click **Code**, select everything, paste, then click **Deploy**.

There are three functions: `save-bot-game` (saves bot games, including space games), `multiplayer` (referees chess and checkers between students) and `space-game` (runs Wormholes & Black Holes with classmates). All three must have **Verify JWT** switched **off** (under the function's **Details**). That's safe: each function checks the student's sign-in itself.

## Looking after the site

This part is for whoever looks after the site, including someone who isn't James.

### Where the accounts live, and who owns them

| Account | What it holds | Who owns it |
|---|---|---|
| **GitHub** `bleedingrobot` | The code (public repo `school-games-hub`) and the website (GitHub Pages) | James |
| **Supabase** organisation "Douglas Park Games", project `zqzhetlzvtptnkmeiumi` (Sydney, free plan) | The database, sign-in and the two server functions | James (logs in to supabase.com with the GitHub account above) |
| **Google Cloud** project "School Games Hub", inside the douglaspark.school.nz organisation | The Google sign-in button (an "Internal" app). Its client secret is stored only in Supabase | James's school Google account |

No account has a credit card, so none of them can send a bill. **Give a second person access** so the site doesn't depend on one login: on GitHub (repo **Settings → Collaborators**), in Supabase (**Organization settings → Team → Invite**) and in Google Cloud (**IAM → Grant access**). Turn on two-step sign-in for all of these accounts.

### After the holidays: waking the site

The free Supabase plan **pauses a project after a week with nobody using it**. If the site says sign-in isn't working, or *"We couldn't load your profile"*, after a break: log in at supabase.com, open the project and click **Restore project**. It takes a few minutes and nothing is lost. Do this the day before a lesson ([CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md)).

### How a change gets published, and how to undo a bad one

- Every push to `main` on GitHub runs the checks and, if they pass, publishes the website in 1–2 minutes (see [How publishing works](#how-publishing-works)). If a check fails, nothing is published and the old version stays up.
- **To undo a bad website change quickly:** on GitHub, open **Actions**, click the last run *before* the bad one, then **Re-run all jobs**. That republishes the older version. (The next push publishes the newest code again, so fix or undo the code too.)
- **To undo it in the code:** in VS Code's terminal, `git revert HEAD` (undoes the latest commit), then `git push`.
- The website, the server functions and the database are published **separately**. Undoing a website change doesn't undo a function or database change.

### Updating a server function

After changing `supabase/functions/<name>/handler.ts` or the rules in `shared/`, run `npm run build:functions`, then `npm run check`. Then deploy it:

```bash
npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api
```

Or, without the command line: on GitHub open `supabase/functions/<name>/index.ts`, click **Copy raw file**, then in Supabase go to **Edge Functions → <name> → Code**, select everything, paste and click **Deploy**. Keep **Verify JWT** switched **off** for both functions (each function checks the sign-in itself). To undo, deploy the previous version of `index.ts` the same way (GitHub's **History** button on the file shows older versions).

### Changing the database

Database changes are files in `supabase/migrations/`. Test them locally first (`npx supabase db reset`, then `npm run test:db`). Then apply the new file to the live project, either by pasting it into Supabase's **SQL Editor** and clicking **Run**, or with

```bash
npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>.sql
```

Then add its number to the `migration repair` note at the bottom of [docs/PLAN.md](docs/PLAN.md), so a later `supabase db push` doesn't apply it twice. There's no "undo" for a database change: write a new migration that puts things back. Never run anything that deletes data on the live project without a check first.

### Start of the school year

1. **Delete students who have left:** **Teacher** page → find them → **Delete** (type their player name). Do this first.
2. **Start a new season:** type `NEW SEASON` on the Teacher page and press **Start a new season**. It clears every finished game, point, rating and achievement. Accounts, names, avatars and teachers stay.
3. **New students** just sign in: their account is made the first time, with a random safe name.
4. **A new teacher:** they sign in once, then an existing teacher finds them on the Teacher page and presses **Make teacher**. If there's no teacher left at all, use `make_first_teacher` (see [How sign-in stays school-only](#how-sign-in-stays-school-only)).
5. Wake the site and do the "day before" checks in [CLASS-LAUNCH.md](docs/CLASS-LAUNCH.md).

### If Supabase or Google changes something

- **Supabase keys.** The website uses only the public *publishable* key, in `src/config.ts`. If Supabase replaces it (**Project Settings → API Keys**), put the new one there and push. The server functions get the secret key from Supabase automatically. Never put a secret key in the code.
- **Free plan limits.** Check supabase.com/pricing once a year and update the numbers in [docs/PLAN.md](docs/PLAN.md). A class uses a small part of them (see PLAN.md, "Stage 8: classroom load"). If a limit is passed, Supabase emails the account owner and allows a grace period, then may slow or stop the project until the next month. It can't bill without a card. **Organization → Usage** in Supabase shows how much has been used.
- **The sign-in limit.** Supabase allows about 150 sign-ins and session refreshes every 5 minutes from one internet address. The school shares one address. If whole-class sign-in errors happen, raise **Authentication → Rate Limits → Token refreshes** (e.g. to 600).
- **The Google sign-in screen.** If Google asks for the app to be verified, or students see *access_not_configured*, check in Google Cloud that **Google Auth Platform → Audience** still says **Internal**. Internal apps for your own school don't need Google's verification. The school's Google admin can also allow it under **Security → API controls → Manage third-party app access**, using the Client ID in PLAN.md.
- **Supabase's sign-in settings** (not stored in the code; check them if sign-in behaves oddly): **Authentication → Sign In / Providers**: Google on, Email off. **Authentication → URL Configuration**: Site URL `https://bleedingrobot.github.io/school-games-hub/`. **Authentication → Auth Hooks**: *Before User Created* on, pointing at `public.hook_before_user_created`.
- **If Supabase or GitHub ever stopped being free:** the code doesn't depend on anything special. The website can move to any static host, and the database to another Supabase project (paid or free) by running the migrations in order.

## Licences

- **Stockfish** (the chess engine) is GPL version 3. Its licence and a link to its source code sit next to it in [public/stockfish/](public/stockfish/NOTICE.md). Keep them there if Stockfish is updated.
- **chess.js** is BSD-2-Clause. The checkers rules and bots are our own code. **Chess piece pictures** are Colin M.L. Burnett's "cburnett" set, GPL ([notice](src/games/chess/pieces/NOTICE.md)).

## Privacy and safety

The one-page version for the school is [docs/PRIVACY-SUMMARY.md](docs/PRIVACY-SUMMARY.md). In short:

- No tracking, analytics, ads or outside fonts. Everything the site loads comes from this repo.
- The browser saves the sign-in session and whether sound is on (sound starts off). Signing out clears the session.
- Names come from word lists, avatars from a fixed set of parts. There's no free typing and no photo uploads.
- Each saved bot game stores the student's random ID, the bot level, the moves, the result and the time. Nothing else. Deleting a student deletes their bot games.
- Points, ratings and achievements store only the student's random ID, the game, the result and the numbers. Leaderboards show only player names, avatars and badges, never emails, IDs, real names or classes.
- Each game against a friend stores the two players' random IDs, the game code, the moves, the result and the times. Each player sees the other's player name and avatar, nothing more. There's no chat. If a student is deleted, their opponents keep the game in their history, but nothing in it points back to the deleted student.
- The chess and checkers bots run on the student's own device. Nothing about their games goes anywhere except our Supabase database.
- Supabase's own sign-in records keep each student's school email, Google name, Google photo link and account number, last sign-in, and each signed-in device's internet address and browser type. Its request logs (internet address, rough location, browser) are kept for 1 day. Deleting a student removes their sign-in record.
- The code is public, so **no passwords or secret keys ever go in it**. Only Supabase's public "publishable" key goes in the website (in `src/config.ts`). It's safe to share because the database rules do the protecting.

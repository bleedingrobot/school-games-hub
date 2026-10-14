# School Games Hub — plan

Last checked: 15 October 2026. Free-tier numbers change, so check them again before launch.

## The short version

| Part | Service | What it does | Cost |
|---|---|---|---|
| The website | **GitHub Pages** | Hosts the pages students see | Free for public repos |
| Sign-in | **Google sign-in through Supabase Auth** | Students tap "Sign in with Google" using their school account. No passwords. | Free |
| Database | **Supabase** (Postgres, Sydney region) | Stores profiles, avatars, games, points, badges | Free tier |
| Live games | **Supabase Realtime** | Sends each move to the other player straight away | Free tier |
| Referee | **Supabase Edge Functions** | Checks every move and result on the server, so nobody can cheat | Free tier |
| Bots | **Stockfish** (chess) and our own checkers bot | Run inside the student's browser, so they cost nothing | Free, open source |

So there are three accounts to manage: GitHub (which you already have), Supabase, and a Google Cloud project for the sign-in button.

## Why this setup

- **Supabase over Firebase.** Firebase can't check chess moves in its database rules. Doing that needs Cloud Functions, and Firebase pushes those toward its pay-as-you-go plan, which needs a credit card. Supabase gives you a real database, sign-in, live updates and server functions on one free plan, with no card needed.
- **Supabase over Cloudflare.** Cloudflare's free plan is good at live games, but it has no built-in sign-in. We would have to build the Google login and its security ourselves. That's more code and more risk, for someone who isn't a full-time developer.
- **GitHub Pages for the website.** You already use it, it's free, and the website is just files. Everything secret lives in Supabase, not in the website.

## Supabase free-tier limits (from supabase.com/pricing)

- 2 active projects, a 500 MB database and 50,000 monthly users. A school will use a tiny fraction of each.
- 500,000 server function calls a month. Each multiplayer move is one call, so that's roughly 10,000 two-player games a month.
- 200 people connected live at once, and 2 million live messages a month.
- 5 GB of data sent out a month.
- **The big catch: a free project pauses after 1 week with no use.** Over school holidays the site will go to sleep. Waking it up is one click in the Supabase dashboard, and no data is lost. I'll put this in the README.
- There's no uptime guarantee and no official support.

## Could anything cost money?

- **Supabase:** only if you upgrade to a paid plan yourself. On the free plan without a card, hitting a limit slows or stops the service instead of sending a bill.
- **GitHub Pages:** free for public repositories. The code will be public, which is fine because no secrets go in it.
- **Google Cloud:** sign-in needs a Google Cloud project, but no billing account. Don't add a card to it.
- **Stockfish:** runs on the student's Chromebook, not on a server, so there's no cost.

## What I need you or the school to do

1. ✅ **The school's Google domain** is `douglaspark.school.nz` (confirmed by James, 15 Oct 2026).
2. **Talk to your school's Google Workspace admin.** Google blocks students marked as under 18 from signing in to outside apps until an admin approves the app. Without approval they get `Error 400: access_not_configured`. The admin approves it under *Security → API controls → Manage third-party app access*, using the app's Client ID, which I'll give you. If the admin creates the Google sign-in project inside the school's own Google account, Google itself will only let school accounts in.
3. ✅ **Free Supabase account and project** created 15 Oct 2026: project `school-games-hub`, Sydney region, address `https://zqzhetlzvtptnkmeiumi.supabase.co`.
4. **Get school sign-off on privacy before launch** (see below).

## How sign-in stays school-only

There are three locks, all enforced on the server:

1. The Google sign-in screen only shows school accounts.
2. A Supabase sign-up check rejects any email that isn't on the school domain, before the account is ever created.
3. Database rules (Row Level Security) only let signed-in school users read anything, and only let students change their own profile.

Students are identified by a random internal ID, not by their name or email. Leaderboards show only the display name they choose (from safe word lists, like "Brave Otter 42") and their avatar.

**One known limit:** Supabase automatically keeps the student's Google name and email in its sign-in records. Only the server can see these, and our tables won't copy them. Still, they *are* stored, so the school's privacy check should know about it.

## Cheating and fairness

- **Multiplayer:** the browser only *asks* to make a move. A server function checks it's that student's turn and that the move is legal, then saves it. Wins, losses and ratings are decided on the server.
- **Bot games:** the bot runs in the browser, so a very determined student could fake a bot game. To limit the damage, the server replays every move to check it was legal. Bot games also earn small points, capped per day, and never count toward the competitive rankings. Only multiplayer games affect ratings.
- **Point farming:** abandoned or very short games earn nothing, and quitting counts as a loss.

## Bots

- **Chess:** Stockfish compiled to run in the browser. *Very Easy* mostly plays random legal moves, with a light preference for captures. *Easy* is Stockfish at a low skill level and very shallow search, so it makes believable mistakes. *Medium* is Stockfish at a moderate skill level with deeper search.
- **Checkers:** no well-tested library exists for English checkers, so I'll write the rules myself, with thorough tests (forced captures, multi-jumps, kings). The bot uses look-ahead search: *Very Easy* looks 1 move ahead with lots of randomness, *Easy* 3 moves, *Medium* 6+ moves (up to 8 when it has time). It runs in a Web Worker so the page never freezes.
- **Checkers board (Stage 5 decision):** the pieces are **Red and White, and Red moves first** (the official rules call that side "Black"; most boards make those pieces red). Squares use the standard 1–32 numbering, with Red starting on 1–12. Each student sees the board from their own side.

## Privacy (New Zealand)

- The database will be in Supabase's **Sydney** region. That's the closest option, but it's still overseas, so Privacy Principle 12 (sending personal information overseas) applies. The school should note this.
- There will be no ads, no tracking and no analytics, no chat, and no photo uploads.
- Before Stage 8 I'll write a one-page privacy summary for your principal or board: what's stored, where, who can see it, and how to delete a student. Under-18 accounts also need the Workspace admin approval in step 2 above.

## Tech choices

- **React + TypeScript + Vite** for the website, using hash-style links (`/#/chess`) so GitHub Pages works without extra setup.
- **chess.js** for the chess rules. The same code runs in the browser and in the server functions.
- **Our own checkers rules** in TypeScript, shared the same way, with tests.
- **React Router** (hash mode) for moving between pages.
- **Vitest** and Testing Library for the tests.
- **Supabase CLI**, so the database setup lives in the repo as migrations.
- **GitHub Actions** builds and publishes the site whenever you push.

Folder layout:

```
src/            website (pages, components)
src/games/      one folder per game: rules, bot, board — new games plug in here
shared/         rules code used by both the website and the server
supabase/       database migrations and server functions
docs/           this plan and the README guides
```

To add a new game later, you add a folder with its rules, bot and board, plus one line registering it. Nothing else needs rebuilding.

## Decisions made (15 Oct 2026)

- **Size:** under 100 students, one class at a time, so we stay well inside the free limits.
- **Multiplayer:** students can share a **game code** with a friend, or join an **open lobby** that lists waiting games.
- **Teachers:** there's a teacher view for James plus a few other teachers. James can give other staff accounts teacher access. Teachers can:
  - rename or hide a student
  - remove a student and delete their data
  - do an end-of-year cleanup
  - switch multiplayer off for everyone
- **Leaderboards:** whole school, but students see only the top 10 plus their own position. Ranks show as badges (Bronze → Silver → Gold → Champion) rather than numbers. There's also a "most improved this week" list. Weeks run on New Zealand time.
- **Safety rules:**
  - Display names are picked from safe word lists (e.g. "Speedy Otter 27"), with no free typing.
  - A mute button, with sound off by default.
  - If a player doesn't move for 2 minutes, their opponent can claim the win.
  - An "offer a draw" button.
  - Checkers is a draw after 40 moves each with no capture and no new king.
- **Google admin:** the school's admin has agreed in principle to approve the app. Once sign-in exists (Stage 3), they'll need the Client ID.
- **Trial:** a small student trial of sign-in and bot games after Stage 5, before multiplayer is built.
- **Bot results** are saved from Stage 4 onwards, so no games are lost when points arrive in Stage 7.
- **Repo:** public GitHub repo `bleedingrobot/school-games-hub`, hosted on GitHub Pages.

## Stages

1. ✅ Inspect and plan (this file)
2. ✅ Foundation: website shell, look and feel, dashboard with clearly marked sample data, auto-deploy to GitHub Pages (done 15 Oct 2026, live at https://bleedingrobot.github.io/school-games-hub/)
3. ✅ Sign-in and profiles: Google login, school-only checks, database rules, display names, avatar maker, teacher roles (done 15 Oct 2026: James and students tested sign-in with real school accounts; no extra Workspace admin approval was needed)
4. ✅ Chess vs bots, results saved (done 15 Oct 2026: chess.js rules, Stockfish 19 lite in a Web Worker, `bot_games` table, `save-bot-game` server function that replays every move; full games played against all three bots in a browser at Chromebook and tablet sizes)
5. ✅ Checkers vs bots (done 15 Oct 2026: our own English checkers rules with thorough tests, three look-ahead bots in a Web Worker, results saved through `save-bot-game`; full games played against all three bots in a browser, as both colours, at Chromebook and tablet sizes), then **small student trial** using [STUDENT-TRIAL.md](STUDENT-TRIAL.md)
6. ✅ Multiplayer: lobby, game codes, server-checked moves, reconnecting (done 15 Oct 2026: `mp_games` table and `multiplayer` server function live; full chess and checkers games played between two local accounts in two browser windows, ending by the rules, resignation, an agreed draw and a 2-minute claim, with reloads part-way, at Chromebook and tablet sizes. Still to do: James's two-device test with real school accounts)
7. Points, badges, ratings, leaderboards, teacher view
8. Deploy and school testing

## Stage 6 design: playing a friend

**The short version:** one new table holds every game between two students. The website can read only the games its student is playing, and can't write to the table at all. Every change (create, join, move, resign, draw, claim, rematch) goes through one new server function, `multiplayer`, which checks it with the same rules code as the bot games. Supabase Realtime tells the other player's browser the moment the game changes.

**The table: `mp_games`** (one row per game)

- which game, the code, whether it's listed in the lobby
- the two players: `first_player` moves first (White in chess, Red in checkers), `second_player` second; plus who created it
- `status`: `waiting` → `playing` → `finished`, or `cancelled` / `expired` if nobody joined
- every move so far, and `turn_started_at` (the server's time when the current turn began, for the 2-minute rule)
- any draw offer, and how many each player has made
- the result: who won (or a draw), why (`checkmate`, `resigned`, `abandoned`...), and `counts_for_points`. Stage 7 works out ratings from these rows.
- `version`, a number that goes up by one with every change. It's how two requests at once are stopped (below).
- rematch requests, and a link to the rematch game

**The server function: `multiplayer`.** The browser sends an action (`create`, `join`, `cancel`, `move`, `resign`, `offer-draw`, `answer-draw`, `claim-win`, `rematch`). The function works out who's asking from their sign-in token, never from the request, then:

- refuses everything if the student is hidden, and refuses new games, joins, moves and rematches while the teacher's multiplayer switch is off (resigning and claiming still work, so games can end)
- for a move: checks it's that student's game and turn, that the game hasn't ended, and that the move is legal, by replaying the game with chess.js or our checkers rules. The server alone decides checkmate, stalemate, every chess draw rule and every checkers ending, including the 40-move draw.
- saves the change only if `version` hasn't moved since it read the game ("save only if nothing changed"). If two requests arrive at once, the database lets one through and the other finds the version has moved, so it's refused. No double moves, no move sneaking in after a resign.

The lobby list is a small read-only database function. It shows waiting lobby games with only the creator's player name, avatar, the game and the colour on offer. No codes, emails or IDs other than the game's own.

**Live updates.** Each player's browser listens to its own game's row through Supabase Realtime. The database only sends a change to people allowed to read that row (the two players). The players also share a private Realtime "who's here" channel. If the opponent drops off it, the page says they seem to be away. If the live connection drops, the page checks the game every few seconds instead, and every 20 seconds anyway as a safety net. Reloading just reads the game again, so nothing is lost.

**Fairness rules**

- **Codes** are 5 characters from `CDFGHJKMNPQRTVWXY34679`: no vowels (so no rude words) and no lookalikes (O/0, I/1/L, S/5, Z/2, B/8). Typing is case-blind and ignores spaces.
- One waiting game per student. Making a new one cancels the old one. A waiting game expires after 10 minutes. You can't join your own game or a full one.
- **2-minute rule:** if it's your opponent's turn and they haven't moved for 2 minutes by the server's clock, you can claim the win. It's recorded as `abandoned`: a loss for them that earns nothing.
- **Draw offers:** one at a time, at most 3 per player per game, and at least 5 of your own moves between offers. Making a move instead of answering turns the offer down.
- **Games where both players walk away:** a scheduled database job (pg_cron, every 5 minutes) expires old waiting games and finishes games with no move for 30 minutes, as `abandoned`, a loss for the player whose turn it was.
- **Counting:** a game counts for points only if each player made at least 10 moves and nobody abandoned it.
- **Rematch:** both players press Rematch; the second press starts a new game with the colours swapped.
- **Rate limits:** each student can create at most 20 games an hour (checked in the database) and try at most 10 codes a minute. The function also turns away anyone sending more than 60 requests a minute. That last check lives in the function's memory, so it's a soft limit.

**What it costs against the free plan.** Each move is one server function call. A long game is about 80 moves plus a few calls for joining and ending, so 500,000 calls a month is roughly 5,000 long games. 30 students each playing 3 games a school day is about 90,000 calls a month, under a fifth of the limit. Realtime sends about two messages per move, far below 2 million a month. Each open browser tab is one live connection, so up to about 200 tabs can be live at once. More than that and the extra tabs quietly fall back to checking every few seconds. The scheduled job and the lobby's 5-second refresh are tiny database reads, which the free plan doesn't count.

**What it can't promise:** the free plan has no uptime guarantee, so a Supabase hiccup could pause live games. Moves are saved, so players just carry on when it's back.

## Stage 7 design: points, badges, ratings, leaderboards and the teacher view

**The short version:** everything is worked out inside the database, the moment a game is saved. Saving a bot game, or a friend game finishing, sets off a database trigger that adds points, updates ratings and hands out achievements. The website can only *read* the results, through small read-only database functions. Nothing a browser sends can change a score. Only games that count (`counts_for_points = true`) earn anything.

### Points

| Against a bot | Lost | Draw | Won |
|---|---|---|---|
| Very Easy | 1 | 2 | 3 |
| Easy | 2 | 3 | 5 |
| Medium | 3 | 5 | 8 |

- **Bot games earn at most 40 points a day** (chess and checkers together, New Zealand day). After that, games still count towards achievements but earn 0 points. The last game before the cap gets whatever is left.
- **Against a friend:** lost 4, draw 6, won 8. Losing to a friend earns more than beating the easiest bot: playing people is what's rewarded.
- **Playing the same friend:** only your first 5 games together each day earn points and change ratings. More games still show in your history.
- **Achievements:** 10 points each.
- **Levels:** level 2 at 50 points, and each level after needs 25 more than the one before (50, 75, 100...). So level 3 is at 125, level 4 at 225, level 5 at 350, level 10 at 1,350. Total for level *L* = 25 × (*L* − 1) × (*L* + 2) ÷ 2.

Why these numbers: a keen student playing bots every day earns up to 40 a day, about level 6 after two weeks of daily play, and levels keep coming but slow down. Harder bots pay more even when you lose, so trying the Medium bot is always worth it.

### Ratings and rank badges (for a 9-year-old)

> Everyone starts with a hidden score of 1000 for chess and 1000 for checkers. When you play a friend, the winner takes some points from the loser. Beat someone better than you and you take a lot. Beat someone newer than you and you take only a little. Lose to someone better and you lose only a little. Your badge shows how high your score is.

- Elo, worked out on the server. Expected score E = 1 ÷ (1 + 10^((their rating − yours) ÷ 400)). Change = round(20 × (result − E)), where a win is 1, a draw ½ and a loss 0. The other player's change is the exact opposite.
- **K = 20, the same for everyone:** one game moves you by at most 20, and 10 for beating an equal. A few games can't swing much.
- Only friend games that count change ratings. Bot games never do. Chess and checkers are separate.
- **Badges:** Bronze to start; **Silver** at 1030 (about 3 more wins than losses against players at your level); **Gold** at 1080 (about 8 more); **Champion** at 1150 *and* at least 15 rated games. Because each win counts for less as you climb, Champion needs steady wins against good players. Badges can go back down, but the "reached Silver/Gold/Champion" achievements stay.
- Raw numbers are never shown. The page shows the badge and how far you are towards the next one.
- **Deleted opponents:** the remaining player keeps their game and rating change. When ratings are worked out again from scratch (only for the first fill-in and nothing else), a deleted opponent counts as 1000.

### Achievements (12 per game, earned on the server)

For chess and for checkers separately: First game · First win · 10 games · 50 games · Beat the Very Easy bot · Beat the Easy bot · Beat the Medium bot · Beat a friend · Reach Silver · Reach Gold · Reach Champion, plus **Checkmate!** (win a chess game by checkmate) or **Crown 5 kings** (checkers; the database counts each man the student crowns by following the moves). Only games that count, count.

### Leaderboards

For each game (chess, checkers), three boards. Students see the **top 10 plus their own place**:

- **This week:** points earned in that game since Monday 12am NZ time. Needs 3 games that count this week.
- **All time:** ordered by rating, shown as badges. Needs 5 rated friend games.
- **Most improved this week:** the biggest rating rise this week. Needs 3 rated games this week, and a rise.

Players with the same score share a place. Boards show only player name, avatar, badge and (for the week) points: no emails, IDs, real names or classes. Hidden students aren't on any board, and places are counted as if they weren't there. A deleted student's games stay in their opponents' totals.

### Tables and database functions

- `scored_games`: one row per player per game that counts: which game, bot or friend, the result, points earned, rating change, crowns. Filled by triggers on `bot_games` (when saved) and `mp_games` (when it becomes finished).
- `ratings`: one row per player per game: rating, rated games, best badge reached.
- `achievement_types` (the list, read by the website for names and emojis) and `achievements` (who earned what, when).
- Read-only functions for students: `my_progress()`, `leaderboard(game, board)`, `progress_rules()` (the numbers above, so the "How points work" page never disagrees with the database).
- Teacher-only functions: `teacher_students()`, `teacher_student_detail(student)`, `teacher_new_season(confirm)`, plus the Stage 3 ones.
- `rebuild_progress()`: wipes and recomputes everything from saved games, oldest first. Only the database owner can run it. Used once, to fill in points for games saved before Stage 7.

### Fairness: why it can't be farmed or faked

- Students can't write to any of these tables, or call the functions that fill them. Points come only from games the server has already checked.
- Short and abandoned games earn nothing (from Stages 4–6). Bot games are capped at 40 a day and never touch ratings.
- Two friends throwing games to each other: only 5 games a day between the same two count, and Elo gives less and less for beating the same lower-rated player.
- Weekly boards need 3 games and the all-time board 5 rated games, so one lucky game can't top a board.

### Teacher view

At `/#/teacher`, only for `role = 'teacher'` (checked by every function on the server; the page just hides itself for others). A list of everyone with name, avatar, games played and when they last played. Per person: see their stats and recent games, **New name**, **Hide/Show**, **Make teacher / Remove teacher** (not yourself), **Delete** (type the player's name to confirm). A switch for **games against friends**.

**End-of-year cleanup ("New season")** deletes every finished game and every point, rating, achievement and board, so everyone starts fresh. It keeps accounts, player names, avatars, teachers and hidden settings, and leaves games still being played alone. The teacher has to type `NEW SEASON` to do it, and the server checks the words too. Students who have left should be deleted one by one first.

### Cost against the free plan

Everything runs inside the database: no new server functions, no new function calls and no new live connections. A score row is about 150 bytes, so even 100 students × 10 games a day for a whole school year is about 30 MB, against the 500 MB database. The end-of-year cleanup frees it again. Leaderboard and dashboard reads are ordinary database requests, which the free plan doesn't count.

## Definition of done — additions to the brief

- A teacher can rename, hide or remove a student, and delete that student's data.
- The README explains how to wake the site after the holidays, when the free project pauses.

## Setup notes

- **Google sign-in:** Google Cloud project "School Games Hub" inside the douglaspark.school.nz organisation, consent screen set to **Internal**. Client ID `1082331069721-afm5mligouf44drvkpdb1vlatgqd6tor.apps.googleusercontent.com`. The client secret lives only in Supabase.
- **Supabase dashboard settings** (not stored in this repo): Google provider on, Email provider off, Site URL and redirect URL set to the GitHub Pages address, and the *Before User Created* hook pointing at `public.hook_before_user_created`.
- **Stage 6:** the migration `20261015000300_multiplayer.sql` was applied on 15 Oct 2026 with `supabase db query` (it also switches on live updates for `mp_games` and schedules the `tidy-friend-games` job). The `multiplayer` server function was deployed the same way as `save-bot-game`, with **Verify JWT off**. `save-bot-game` was redeployed at the same time (same behaviour, tidier code).
- **Stage 5 server function:** `save-bot-game` version 2 (chess and checkers) was deployed on 15 Oct 2026 the same way. Reports say `"game": "checkers"`; reports with no game are chess. Checkers needed no database change: `bot_games` already accepted it.
- **Stage 4 server function:** `save-bot-game` was deployed on 15 Oct 2026 with `npx supabase functions deploy save-bot-game --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. **Verify JWT is off** because the function checks the sign-in token itself.
- **Claude can edit Supabase:** a Supabase access token lives in `~/.supabase/access-token` on James's server (never in the repo). Live SQL runs with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`.
- **Bot results:** games with fewer than 10 student moves, and abandoned games, are saved with `counts_for_points = false`. A student can save at most 300 bot games a day (stops a script flooding the database).
- **Database setup:** the first migration was pasted into the SQL Editor on 15 Oct 2026, not pushed with the CLI. The Stage 4 migration (`20261015000200_bot_games.sql`) was applied on 15 Oct 2026 with `supabase db query` (also not recorded in the CLI's migration history). The Stage 6 migration (`20261015000300_multiplayer.sql`) was applied the same way on 15 Oct 2026. Before the first `supabase db push`, run `npx supabase migration repair --status applied 20261015000100 20261015000200 20261015000300` so they aren't applied twice.

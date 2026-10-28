# School Games Hub — plan

Last checked: 15 October 2026 (re-checked against supabase.com/pricing in Stage 8: unchanged). Free-tier numbers change, so check them again each year.

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
5. ✅ Checkers vs bots (done 15 Oct 2026: our own English checkers rules with thorough tests, three look-ahead bots in a Web Worker, results saved through `save-bot-game`; full games played against all three bots in a browser, as both colours, at Chromebook and tablet sizes), then **small student trial** (its checklist is now [CLASS-LAUNCH.md](CLASS-LAUNCH.md))
6. ✅ Multiplayer: lobby, game codes, server-checked moves, reconnecting (done 15 Oct 2026: `mp_games` table and `multiplayer` server function live; full chess and checkers games played between two local accounts in two browser windows, ending by the rules, resignation, an agreed draw and a 2-minute claim, with reloads part-way, at Chromebook and tablet sizes. Still to do: James's two-device test with real school accounts)
7. ✅ Points, badges, ratings, leaderboards, teacher view (done 15 Oct 2026: scoring runs inside the database; 126 new database tests; bot games, friend games (a win, a rematch and an agreed draw) and every teacher action, including deleting a test student and a new season, tried in a real browser at Chromebook and tablet sizes; live migration applied and scores filled in for the games already saved. James's live teacher test on 15 Oct 2026: rename, hide and show all went through)
8. ✅ Deploy and school testing (done 15 Oct 2026: security review with fixes, line-by-line definition of done below, 30-student load test, privacy summary, class launch checklist and maintenance guide; full games of chess and checkers against bots and friends, and every teacher action, in a real browser at Chromebook and tablet sizes with mouse, keyboard and touch. See "Stage 8" below)
9. ✅ Space snakes and ladders game, "Wormholes & Black Holes" (full brief in [prompts/space-game.md](prompts/space-game.md), plan and results in [SPACE-GAME-PLAN.md](SPACE-GAME-PLAN.md)). Approved by James on 15 Oct 2026; stages 9.1–9.6 built (rules engine, bots, saving and taking-part points, classmates, polish, pass-and-play). **Live 16 Oct 2026**
10. ✅ 101, James's family card game, against bots or 2–4 classmates (full brief in [prompts/game-101.md](prompts/game-101.md), plan and results in [101-PLAN.md](101-PLAN.md), rules in [101-RULES.md](101-RULES.md)). Plan and rule answers 16 Oct 2026; stages 10.1–10.5 built on branch `stage-10` (rules engine, bots and simulation; bot games on screen; saving and points; classmates with hidden cards; How to play, accessibility pass and docs). See "Stage 10 design" below. **Live 16 Oct 2026**
11. Gem Keep, a tower defence game powered by times tables (brief in [prompts/gem-keep.md](prompts/gem-keep.md)). Phase 0 recon done 16 Oct 2026: [gem-keep/RECON.md](gem-keep/RECON.md), on branch `stage-11`. Reviewed by James 16 Oct 2026 (answers in RECON.md section 4). Phase 1 playable prototype done 16 Oct 2026 at the hidden address `/#/gem-keep`; Phases 2–4 (maths engine, maths in the game, 10 levels with a campaign map) done 16 Oct 2026 ([gem-keep/PROGRESS.md](gem-keep/PROGRESS.md)). **On the dashboard for a class trial from 16 Oct 2026** (progress on each device, no points yet). Phase 5 (saving to the account, points, stars leaderboard, teacher settings and times-table grid) done and **live** 17 Oct 2026; Phase 6 (polish and classroom test) next

### Ideas for later (not scheduled)

- **Tic-Tac-Toe: Power Clash** (saved 16 Oct 2026): noughts and crosses with once-a-match powers (Double Trouble, Body Swap, Freeze Ray, Board Wipe first; four more later). Full brief in [prompts/power-clash.md](prompts/power-clash.md). The brief was written as a standalone site; here it would be a new game folder on the hub (pass-and-play first, then perhaps bots and classmates). Plan written 17 Oct 2026 in [POWER-CLASH-PLAN.md](POWER-CLASH-PLAN.md) (branch `power-clash`); plan approved 17 Oct 2026. P.1 rules engine and P.2 pass-and-play screens done; P.3 polish (animations, sounds, shouts, How to play) done 17 Oct 2026 and waiting for James's review. P.4 (Very Easy/Easy/Medium bots with a simulation, replayable saved bot games, 2 taking-part points, 4 badges) done 17 Oct 2026: migration written not applied, function not deployed, dashboard card off (`POWER_CLASH_ON`); nothing live. P.5 (playing a classmate, refereed by a new `power-clash` server function, 4 points a finished game, first 6 a day, rematch, 60-second turns, teacher and profile views) done 18 Oct 2026: two more migrations (`001600`, `001700`; P.4's is now `001500`) written and run in a scratch copy of the database, function built, nothing applied or deployed. P.6 done 18 Oct 2026 (Force Field, Portal Chaos, Wild Card, Time Heist and Chaos Mode on the one-screen and bot games; bots and the server know them; no new migration, functions rebuilt): the game is feature complete. P.7 done 18 Oct 2026: the three migrations applied, `power-clash` and `save-bot-game` deployed, card switched on and merged to main (see POWER-CLASH-PLAN.md sections 15 and 16). Still to do: one real two-device game and the class trial.
- **Mission Control maths** (planned 17 Oct 2026): times-table questions in Wormholes & Black Holes at wormholes, black holes and a booster. Right answers help, wrong ones never hurt, and the teacher (and, if allowed, each student) can switch it off. Shares Gem Keep's question engine and records. Full plan in [SPACE-MATHS-PLAN.md](SPACE-MATHS-PLAN.md). Not started: James answers its section 9 first.
- **Marble game** (saved 16 Oct 2026): our own marble-rolling time-trial game in the spirit of *Marble Madness* (isometric tracks, momentum, beat the clock), with 6 courses, classmate ghost races and 2 players on one Chromebook. GitHub search found nothing reusable (no licence, desktop-only, or someone else's game files), so it's written from scratch: our own physics in `shared/marble/` so the server can replay every run, drawn with three.js. Full plan in [MARBLE-PLAN.md](MARBLE-PLAN.md). Not started: James answers the questions in its section 11 first.
- **Maths Monsters** (planned and approved 17 Oct 2026, under way on branch `monsters`): a Pokémon-style world to walk around, where every attack and catch is a maths question and each monster type is a maths topic (times tables, adding and taking away, division, place value, fractions, decimals). Inspired by the MIT-licensed *Monster Tamer* tutorial game, but written our own way (its art and music can't go in our public repo). The new topics become skill packs every hub game can use. Full plan and James's answers in [MONSTER-PLAN.md](MONSTER-PLAN.md).
- **Dragon Maths** (planned and approved 17 Oct 2026): a *Legend of the Red Dragon*-style game with daily forest turns, a menu village (shop, healer, bank, inn, training grounds, arena), 12 levels of masters and the Red Dragon at the end. Maths at chosen moments (sizing up monsters, shop change, the healer's bill, riddles, master and dragon trials), never a timer, wrong answers never hurt. Uses LORD.ts (GPL-3, needs its own server, grown-up content) as a rule book only: our own code, writing and art, and the Maths Monsters maths packs. Brief in [prompts/lord-maths.md](prompts/lord-maths.md), full plan in [LORD-PLAN.md](LORD-PLAN.md). James answered all its questions 17 Oct 2026; starts after Maths Monsters is live.
- **Maths focus, classes and schools** (planned 18 Oct 2026, on hold until the current two games are finished): teachers set what maths every game asks (×6, doubles, rounding…) for a class, group or student, for a set time (default until Friday), then it falls back to the student's choice or **auto**, which climbs a 30-step skill ladder from bonds to 10 to BEDMAS and fractions, decimals and percentages, built on the NZC 2025 teaching sequence. Adds classes, teachers, groups and schools (Douglas Park as school 1). Full plan in [MATHS-FOCUS-PLAN.md](MATHS-FOCUS-PLAN.md), all questions answered. Not started: F.1 (skill engine) is first.

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

## Stage 8: security review, classroom load and launch

### Security review (15 Oct 2026)

Done as a curious Year 6 student with developer tools would try it, against the code, the local copy and (read-only) the live project. Most serious first:

1. **Medium: a hidden chat channel.** The private "who's here" channel for a friend game let the two players send each other any message with developer tools. The website never showed them, but the brief says no chat. Proven locally (a message from one player reached the other). **Fixed** in migration `20261015000500`: the channel now carries presence only. Tested both ways.
2. **Medium: the sign-up check is switched off on the live project.** Supabase's *Before User Created* hook (lock 2) is off. The database backstop still refuses any non-school account (tested: a gmail and a look-alike domain can't be created), and Google's Internal setting blocks them first, so nobody can get in. But one of the three locks isn't on. **Switched on by James on 15 Oct 2026** (checked through Supabase's settings API afterwards).
3. **Low-medium: re-sending a won bot game.** Copying a save request in the browser's developer tools and replaying it saved the game again, with points (up to the 40-a-day cap) and towards "Play 50 games". Lost replies on patchy Wi-Fi did the same through **Try again**. **Fixed**: the same counting game sent twice is saved and scored once (`record_bot_game`).
4. **Low: new tables started open.** Supabase gives signed-out visitors and students full rights on every new table; each migration had removed them by hand. **Fixed**: new tables now start closed, and a test checks it.
5. **Low: no request size limit** in the server functions. **Fixed**: bodies over 64 KB are refused unread.
6. **Low (cost, not security): two function calls per move.** Browsers asked permission (a CORS preflight) before every request. **Fixed**: the answer is remembered for 2 hours.

Checked and fine:

- **Live matches the migrations:** every table, policy, grant and function was listed from the live catalogue and compared. Every function has a fixed `search_path`. Signed-out visitors can read and call nothing (probed from outside). Students can only read, never write, and only these functions: the name/avatar ones, the read-only progress, lobby and board ones, and the teacher ones (which refuse non-teachers). `security.test.sql` now checks all of this every run.
- **Server functions:** forged and expired tokens, a deleted student's token, someone else's game (move, resign, join by ID), out-of-turn and illegal moves, the same move twice, unreadable and huge bodies, and 70 requests at once (turned away) were all tried locally.
- **Realtime:** a third student listening to the whole `mp_games` table got nothing from a game they weren't in, and couldn't join its private channel.
- **Sign-in:** non-school and look-alike domains, capital letters, sub-domains (pgTAP); expired sessions are refused by the database and both functions; a teacher's ID with a non-school email in the token gets no teacher powers.
- **Public repo and site:** no secret keys, service keys, tokens or real emails in the whole git history (only made-up test addresses and the commit author's address). The published site has no source maps, no `.env`, and talks only to our Supabase project.
- **Supabase's advisors:** the security advisor's warnings are all expected: the teacher, lobby, board and name functions are meant to be callable by signed-in users (each checks who's asking), the three score tables have row level security on and no policies on purpose (nobody reads them directly), and "leaked password protection" doesn't apply (no passwords). The performance advisor's warnings were fixed in migration `20261015000500` (rules check the caller once per query; five indexes).

Known limits, not fixed (for James to decide): a determined student can still invent a bot game move by move (it earns small capped points and never affects ratings); a group of friends throwing games to each other can lift one player's badge slowly (5 games a pair a day); the 60-requests-a-minute limit lives in each copy of the function and the live logs show a new copy starting for most requests, so it's a very soft limit. A student scripting thousands of requests could use up the month's free function calls. Supabase would warn first, and the site would slow or stop until the next month, but there would be no bill.

### Definition of done (brief section 13, plus PLAN.md's additions)

| Line | How it's proven | Met? |
|---|---|---|
| School accounts can sign in, unauthorised accounts are rejected by the backend | Live: 11 accounts, all school ones. pgTAP: domain checks, the hook, and the database backstop. Locally: a gmail and a look-alike domain can't be created; expired and forged tokens are refused | ✅ (live hook switched on 15 Oct 2026) |
| Avatars can be created and customised | pgTAP (`save_my_avatar`, free text refused); Stage 3 browser test; live: 7 of 11 players have built one | ✅ |
| Chess and checkers both work against all three bots | Unit tests (legal moves, each level beats the one below); Stage 4–5 full browser games against every level; this stage: full chess and checkers bot games in the browser; live: real students played every level of both | ✅ |
| Two separate accounts can play chess, and checkers, live | This stage: full games of both in two browsers, ending by checkmate and by blocking, with a reload and a closed lid part-way; live: 12 friend games between real students on 15 Oct, chess and checkers | ✅ |
| Results and leaderboards update correctly | 126 pgTAP scoring and board tests; browser: points (+8/+4) and ratings (±10) after friend games; live: every counting game has its score, and rating changes add up to zero | ✅ |
| Students can't modify each other's profiles, scores or results | `security.test.sql` (whole-catalogue rules), `profiles`/`bot_games`/`mp_games` tests, function tests, local probe | ✅ |
| It works on Chromebooks and tablets | Browser tests at 1366×768 (mouse and keyboard) and 768×1024 (touch); live: 156 requests from real Chromebooks and 203 from Macs/iPads on 15 Oct | ✅ |
| Tests, builds and security checks pass | 295 unit tests, 269 database tests, type check, production build, function build check; Supabase advisors reviewed | ✅ |
| Deployed on the agreed free services, no surprise paid dependency | GitHub Pages, Supabase free plan, Google Cloud with no billing; no card anywhere | ✅ (James: confirm Google Cloud **Billing** shows no billing account) |
| Clear maintenance and redeploy instructions | README, "Looking after the site" | ✅ |
| A teacher can rename, hide or remove a student, and delete that student's data | pgTAP; this stage: every teacher action in the browser, checking the database after each (a deleted student leaves 0 rows) | ✅ (James's live test on 15 Oct 2026: rename, hide, show; live logs show each one succeeded and nobody is left hidden) |
| The README explains waking the site after the holidays | README, "After the holidays: waking the site"; CLASS-LAUNCH.md, "The day before" | ✅ |

### Classroom load (30 students)

- **Locally, 30 students at once** (`load.mjs`-style script, not kept in the repo): 15 lobby games posted in the same moment, 15 students rushing the same game (exactly 1 got in, 14 were told it was full), then 15 games of 30 moves played together. 494 requests, no errors; median 54 ms, slowest 0.9 s. Every student got live updates for their own game only (900 = 450 moves × 2 players).
- **Patchy Wi-Fi:** reloading mid-game, and closing the page for 20 s (like a Chromebook lid), both came back to the game; the partner saw "away" and it cleared. The website now tries a request once more after a network error or a Supabase 502/503 (5 of these hit students' preflight requests on 15 Oct, all at the 5-minute marks). Retrying is safe: moves carry their number, and saves are idempotent.
- **A week of class use** (30 students, 3 lessons, say 4 friend games of ~80 moves and 5 bot games each a lesson): about 30 × 3 × (4 × 45 + 5) ≈ 17,000 function calls a week, ~70,000 a month, against 500,000. (Before Stage 8 every call cost two, so ~140,000.) Live connections: 30–60 tabs against 200. Live messages: about 2 per move, ~30,000 a week against 2 million a month. The database is 12 MB of 500 MB. Realtime's other free limits (100 messages a second, 20 presence messages a second) are well above a class.
- **The real limit for a class is sign-in:** Supabase allows 150 sign-ins and token refreshes per 5 minutes **per internet address**, in bursts of 30, and the whole school shares one address. Staggered sign-in is fine; if a whole class gets errors at once, raise it (README, "If Supabase or Google changes something").

## Stage 10 design: 101 and hidden cards

**The short version:** the first game with secrets. Every player may know only some of the cards, so no browser ever gets the whole game.

- **One rules engine** (`shared/card101/`) runs everywhere. `viewFor(game, seat)` turns the whole game into what one seat may know (the face-up cards, your own drawn card, your peek, everything at the end of a round). It's the only way card information leaves the server, and a test plays thousands of random games checking every view for leaks.
- **Against bots:** played in the browser from a seed the server stamps; the server replays the game before saving it (the same as the space game). Bots are only given their own seat's view. A determined student could find the bots' cards in the browser's memory, which is why bot games earn only the usual small, capped bot points.
- **Against classmates:** two tables. `card_games` holds the whole game and students can't read it at all (no rights, no row rules, not in Realtime). `card_game_seats` has one row per player holding only their view; students can read only their own, and Realtime sends each row only to its player. The new `card-game` server function shuffles with secure randomness, referees every move and writes the game and every seat row in one step. Tested with a student listening to every seat row of their game through Realtime: they only ever received their own.
- **Points:** bot games like chess and checkers (inside the 40-a-day cap); classmates 8 for a win, 4 for finishing (first 6 a day); nothing under 2 full rounds or for players who leave. Never ratings, badges or leaderboards (`ranked: false`). 8 achievements.
- **Cost against the free plan** (measured locally): a 3-player Quick game with classmates took about 80 function calls and 230 Realtime messages (every change rewrites each player's row); a careful Normal game is about three times that. A class of 30 playing 101 in groups of 3 for three lessons a week adds roughly 10,000–30,000 function calls a month (of 500,000) and 30,000–90,000 Realtime messages (of 2 million). Bot games are 2 calls each. Seat rows are a few KB and New season clears them.

## Setup notes

- **Google sign-in:** Google Cloud project "School Games Hub" inside the douglaspark.school.nz organisation, consent screen set to **Internal**. Client ID `1082331069721-afm5mligouf44drvkpdb1vlatgqd6tor.apps.googleusercontent.com`. The client secret lives only in Supabase.
- **Supabase dashboard settings** (not stored in this repo): Google provider on, Email provider off, Site URL and redirect URL set to the GitHub Pages address, and the *Before User Created* hook pointing at `public.hook_before_user_created`. **Checked 15 Oct 2026 (Stage 8): the hook was found switched off; James switched it on the same day**; everything else as listed.
- **Stage 8:** the migration `20261015000500_stage8_hardening.sql` was applied on 15 Oct 2026 with `supabase db query`, and `save-bot-game` and `multiplayer` were redeployed the same way as before (checked from outside: both answer the browser's preflight with the 2-hour `Access-Control-Max-Age`).
- **Stage 6:** the migration `20261015000300_multiplayer.sql` was applied on 15 Oct 2026 with `supabase db query` (it also switches on live updates for `mp_games` and schedules the `tidy-friend-games` job). The `multiplayer` server function was deployed the same way as `save-bot-game`, with **Verify JWT off**. `save-bot-game` was redeployed at the same time (same behaviour, tidier code).
- **Stage 5 server function:** `save-bot-game` version 2 (chess and checkers) was deployed on 15 Oct 2026 the same way. Reports say `"game": "checkers"`; reports with no game are chess. Checkers needed no database change: `bot_games` already accepted it.
- **Stage 4 server function:** `save-bot-game` was deployed on 15 Oct 2026 with `npx supabase functions deploy save-bot-game --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. **Verify JWT is off** because the function checks the sign-in token itself.
- **Claude can edit Supabase:** a Supabase access token lives in `~/.supabase/access-token` on James's server (never in the repo). Live SQL runs with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`.
- **Bot results:** games with fewer than 10 student moves, and abandoned games, are saved with `counts_for_points = false`. A student can save at most 300 bot games a day (stops a script flooding the database).
- **Stage 7:** the migration `20261015000400_progress.sql` was applied on 15 Oct 2026 with `supabase db query`, then `select public.rebuild_progress();` filled in scores for the games already saved (30 scored games, 34 achievements, 4 ratings). No server function changed.
- **Database setup:** the first migration was pasted into the SQL Editor on 15 Oct 2026, not pushed with the CLI. The Stage 4 migration (`20261015000200_bot_games.sql`) was applied on 15 Oct 2026 with `supabase db query` (also not recorded in the CLI's migration history). The Stage 6 migration (`20261015000300_multiplayer.sql`) and the Stage 7 migration (`20261015000400_progress.sql`) were applied the same way on 15 Oct 2026. The Stage 8 migration (`20261015000500_stage8_hardening.sql`) was applied the same way. The Stage 9 migrations (`20261015000600_space_points.sql`, `20261015000700_space_classmates.sql`) were applied the same way on 16 Oct 2026. The Stage 10 migrations (`20261016000800_101_points.sql`, `20261016000900_101_classmates.sql`) were applied the same way on 16 Oct 2026, and so was the teacher real-names migration (`20261016001000_teacher_real_names.sql`). Gem Keep Phase 5 (`20261017001100_gem_keep.sql`) was applied the same way on 17 Oct 2026. Dragon Maths (`20261018001600_dragon_maths.sql` and `20261018001700_dragon_maths_l5.sql`) was applied the same way on 18 Oct 2026, with the `lord` function deployed the same day and the game switch OFF. Clan Quest (`20261018001800_clans.sql`, `20261018001900_clans_fights.sql`, `20261018002000_clans_village.sql` and `20261018002100_clans_rewards.sql`) was applied the same way on 18 Oct 2026, with both Clan Quest switches OFF. The points hooks for new games (`20261020000100_game_hooks.sql`) were applied the same way on 20 Oct 2026, in one transaction. Bond Match (`20261019001000_bond_match.sql`, applied 19 Oct 2026 under its old number `20261019000200`) was applied the same way, and so was its switch migration `20261020000200_bond_match_switch.sql`, on 20 Oct 2026. Mine Runner (`20261021000100_mine.sql` and `20261021000200_mine_hub.sql`) was applied the same way on 21 Oct 2026, with the `mine` function deployed the same day and the game switch OFF. Archery Challenge (`20261021000300_archery.sql`, `20261022000100_archery_classmates.sql` and `20261022000200_archery_hub.sql`) was applied the same way on 22 Oct 2026, with the game switch OFF (Classmate fights on). Training before games (`20261022000300_training_first.sql`) was applied the same way on 22 Oct 2026, with the switch OFF everywhere, and the `training` function redeployed. Question skips (`20261022000900_question_log.sql`) was applied the same way on 22 Oct 2026 (no functions changed), and so was its Skip button switch (`20261022001100_question_skips_switch.sql`, every class On). The Dragon Maths topic switches (`20261019001100_lord_topics.sql`) were applied the same way on 26 Oct 2026 (all eight topics on), with the `lord` function redeployed from `dragon-art` the same day. Kingdom Keeper (`20261026000100_kingdom.sql`) was applied the same way on 27 Oct 2026, with the game switch OFF everywhere. The Maths Monsters battle limit (`20261027000200_monster_battle_cap.sql`, 12 a day) was applied the same way on 27 Oct 2026, in one transaction (no functions changed), and so was battles left on the dashboard card (`20261027000300_monsters_moves_left.sql`, re-creates `my_moves_left()`). The teacher view class reports (`20261028000100_gem_keep_class_report.sql`, `20261028000200`, `20261028000300` and `20261028000500`) and the Students roster (`20261028000700_teacher_class_overview.sql`) were applied the same way on 28 Oct 2026. After the site was published, `20261028000600_drop_school_class_reports.sql` was pasted into the SQL Editor the same day. The Admin page functions (`20261028000800_admin_pages.sql`) were applied the same way on 28 Oct 2026. The Admin Classes functions (`20261028000900_admin_classes.sql`) were pasted into the SQL Editor on 28 Oct 2026 (the Supabase connector's confirm step for SQL containing `delete` never reached James). Clan Quest My Village (`20261028001000_clans_my_village.sql`) was pasted into the SQL Editor on 28 Oct 2026, with the `clans` function deployed from James's Mac the same day, then `select public.clan_my_village_share_chests();` run once. The End of year functions (`20261028001100_admin_end_of_year.sql`) were pasted into the SQL Editor the same day. `20261028000400` (Dragon Maths school season) is **not** applied yet. Before the first `supabase db push`, run `npx supabase migration repair --status applied 20261015000100 20261015000200 20261015000300 20261015000400 20261015000500 20261015000600 20261015000700 20261016000800 20261016000900 20261016001000 20261017001100` (and every later migration, including `20261021000300`, `20261022000100`, `20261022000200`, `20261022000300`, `20261022000900`, `20261022001100`, `20261019001100`, `20261026000100`, `20261027000200`, `20261027000300`, `20261028000100`, `20261028000200`, `20261028000300`, `20261028000500`, `20261028000600`, `20261028000700`, `20261028000800`, `20261028000900`, `20261028001000`, `20261028001100`, `20261018001600`, `20261018001700`, `20261018001800`, `20261018001900`, `20261018002000` and `20261018002100`) so they aren't applied twice.

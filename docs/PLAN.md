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
- **Checkers:** no well-tested library exists for English checkers, so I'll write the rules myself, with thorough tests (forced captures, multi-jumps, kings). The bot uses look-ahead search: *Very Easy* looks 1 move ahead with lots of randomness, *Easy* 3 moves, *Medium* 6+ moves.

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
5. Checkers vs bots (results saved), then **small student trial**
6. Multiplayer: lobby, game codes, server-checked moves, reconnecting
7. Points, badges, ratings, leaderboards, teacher view
8. Deploy and school testing

## Definition of done — additions to the brief

- A teacher can rename, hide or remove a student, and delete that student's data.
- The README explains how to wake the site after the holidays, when the free project pauses.

## Setup notes

- **Google sign-in:** Google Cloud project "School Games Hub" inside the douglaspark.school.nz organisation, consent screen set to **Internal**. Client ID `1082331069721-afm5mligouf44drvkpdb1vlatgqd6tor.apps.googleusercontent.com`. The client secret lives only in Supabase.
- **Supabase dashboard settings** (not stored in this repo): Google provider on, Email provider off, Site URL and redirect URL set to the GitHub Pages address, and the *Before User Created* hook pointing at `public.hook_before_user_created`.
- **Stage 4 server function:** `save-bot-game` is deployed from the dashboard's editor (paste of `supabase/functions/save-bot-game/index.ts`), with **Verify JWT off** because the function checks the sign-in token itself.
- **Bot results:** games with fewer than 10 student moves, and abandoned games, are saved with `counts_for_points = false`. A student can save at most 300 bot games a day (stops a script flooding the database).
- **Database setup:** the first migration was pasted into the SQL Editor on 15 Oct 2026, not pushed with the CLI. The Stage 4 migration (`20261015000200_bot_games.sql`) is pasted the same way. Before the first `supabase db push`, run `npx supabase migration repair --status applied 20261015000100 20261015000200` so they aren't applied twice.

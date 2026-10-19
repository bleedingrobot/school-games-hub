# Lighter on the server: plan

*How to make the hub ask the server for much less, so a whole class can use it at once without the database timing out. Written 19 October 2026 for James, after the lobby timeout that morning.*

**Status: S.1 and S.2 built and tested on the `server-load` branch, not live (see "Stage S.1 results" and "Stage S.2 results" at the end); nothing else built. The lobby already refreshes every 20 seconds instead of 5, and the faster points-and-level job is live (both 19 Oct 2026). James answered the questions the same day (section 7). Everything below waits for James to say go, one stage at a time, starting with S.1.**

## 1. Why

The hub runs on Supabase's smallest, free size: about half a gigabyte of memory and a shared processor. The tables are tiny (40 people), so no single request is slow when things are quiet: the slowest takes about 50 milliseconds, most take 1 to 3. The trouble is a whole class doing the same thing at the same moment. Hundreds of small requests queue up, each one waits for the others, and on 19 Oct requests that normally take 50 milliseconds took 300 to 600 until the database gave up.

So the aim is **fewer requests**, not faster ones. Every request also costs something before it does any work (checking who is asking, setting things up), so one request that does ten things is much lighter than ten requests.

### What the database's records say (14 to 19 Oct 2026)

| What | Times asked | Note |
|---|---|---|
| Points and level (home page) | 982 | Most database time of anything. About 50 ms each when quiet, 400 ms when busy |
| Live updates checking for changes | 32,157 | Runs in the background all the time; second-biggest |
| Dragon Maths saves | 1,101 | About 200 ms each when busy |
| Maths path, maths focus, my class, moves left (home page) | 325 to 373 each | 150 to 440 ms each when busy |
| The four lists of open games (lobby) | 221 to 1,251 each | |
| The games' on/off switches | about 45,000 reads of a 3-row table | Every page asks again |

## 2. What changes, in short

1. **On/off switches are read once** and remembered for a few minutes, instead of on every page.
2. **The home page asks once** instead of about 23 times.
3. **The checks inside two-player games back off** when live updates break, instead of everyone asking every 4 seconds, and they pause in hidden tabs.
4. **The lobby asks once** per refresh instead of about 10 times.
5. **Server functions check the sign-in on the spot** instead of asking the sign-in service on every move.
6. **Small tidy-ups** on the teacher pages.

Stages 1, 2 and 3 matter most. Together they should cut what a class sends at a busy moment to a fraction of today's.

## 3. Rules for every stage

- Build on a new branch, `server-load`, in its own worktree. Never on `main` until James says it can go live.
- Nothing a pupil sees changes. Same screens, same numbers, same order. Any change a pupil could notice is listed in the stage and needs James's OK.
- The server stays in charge of rules. Remembering a switch on the screen is only about what to show; the server functions still refuse a game that is switched off (check this is true for every game in S.1).
- New database changes get the next free number across **all** branches (the maths-focus branch already clashes once).
- Each stage ends with: quick tests passing, a request count before and after (section 5), a short "results" section added to this plan, and a stop for James.

## 4. Stages

### S.1 Switches read once

**Now:** each game's on/off switch (Maths Monsters, Dragon Maths, Clan Quest, playing friends, Mission Control maths, reactions) is read separately, on every page that needs it. The home page alone reads three.

**Change:**
- One small helper reads the pupil's whole settings row in one go and remembers it for **5 minutes**. Pages that ask at the same moment share the one request.
- It is forgotten on sign-out, when the tab comes back after being hidden for more than 5 minutes, and when a teacher changes a switch on that device.
- Teachers who have picked a class on the Teacher page keep reading that class's settings fresh, as now (few people, and they need to see their change straight away).

**What a pupil might notice:** when a teacher switches a game on or off, a pupil's screen can take up to 5 minutes (or a page reload) to show it. Starting a game that's been switched off is still refused by the server with the usual message.

**Tests:** three switch checks on the home page become one request; two pages opened together share one; the remembered answer runs out after 5 minutes; sign-out forgets it; the teacher class picker still reads fresh.

### S.2 Home page in one request

**Now:** about 23 requests every time the home page opens, again each time a pupil comes back from a game: points and level, recent games and stats for each kind of game (bots, chess and checkers with friends, space, 101, Power Clash), games in progress, players' names and avatars, moves left, my class, maths focus and maths path, plus the switches.

**Change:**
- One new database job, "my home page", returns all of it in one answer. It **runs as the pupil**, so the existing rules about who can see what still apply. It calls the jobs that already exist rather than copying them, so the numbers can't drift apart.
- The home page and its cards (class, maths focus, maths path) take their parts from that one answer. The cards keep their own request as a fallback, for when they are shown somewhere else.
- **Not remembered between visits:** points, recent games and moves left must be up to date straight after a game, so the home page still asks every time it opens. It just asks once.
- If the one request fails, the page shows what it shows now when everything fails, with the same messages.

**What a pupil might notice:** nothing, except the page filling in all at once instead of bit by bit.

**Tests:** the new job gives the same answer as the separate jobs for a pupil with lots of games, a new pupil, a teacher, a hidden pupil, and with each game switched off (database test in a rolled-back transaction, like the earlier stages). Screen tests: one request on opening; the same cards and numbers as before; a failure shows the old message.

**Check on today's data:** time the new job against the separate ones for the busiest pupil, without changing anything.

### S.3 Calmer checks inside two-player games

**Now:** during chess, checkers, space, 101 and Power Clash with classmates, each screen checks the game every 20 seconds in case a live update was missed. If live updates break, it checks every **4 seconds**. If live updates break for everyone at once (which is most likely when the server is already struggling), the whole class asks every 4 seconds and makes it worse. The checks also carry on in tabs nobody is looking at.

**Change:**
- When live updates break: wait 4 seconds, then 8, 16, and then 30 seconds between checks. Back to normal as soon as live updates work again.
- Each screen adds a small random wait (up to a quarter of the gap), so a class doesn't ask in step.
- No checks while the tab is hidden; one straight away when it comes back (that part is already there).
- Your own move still goes straight through and shows straight away. Only the "did anything change?" checks slow down.

**What a pupil might notice:** if live updates are broken, an opponent's move can take up to about 30 seconds to appear, instead of 4. This only happens when something is already wrong.

**Tests:** the gaps grow as above and reset when live updates come back; no checks while hidden; one check on coming back; the same in all four kinds of game.

### S.4 Lobby in one request

**Now:** about 10 requests every 20 seconds: the friends switch, four lists of open games, four lists of your own open games, then names and avatars.

**Change:**
- One new database job, "lobby", returns the open games of every kind and your own open games, with names and avatars included. It runs as the pupil.
- The switch comes from S.1.
- Still every 20 seconds, still straight away on coming back to the tab, and creating or joining a game still never waits.

**Tests:** the same games listed in the same order as now (database test with each kind of game, hidden players, expired games and switches off); one request per refresh.

### S.5 Sign-in check on the spot

**Now:** every server function (each game move, save, fight) asks the sign-in service who the pupil is, and the sign-in service uses the same database.

**Change:** check the pupil's sign-in token inside the function instead, with no trip to the sign-in service.

**Needs James first:** switching the project to the newer kind of sign-in keys in the Supabase dashboard. That's a one-off settings change; signed-in pupils stay signed in. Until then this stage waits.

**Tests:** each function still refuses a missing, wrong, expired or non-school token, the same as now.

### S.6 Small tidy-ups (optional)

- The teacher's class page refreshes every 8 seconds; 30 seconds would do, with the same "look again when the tab comes back".
- The four clean-up jobs run every 5 minutes, day and night. They're cheap, so they can stay as they are; this is only listed so it isn't forgotten.

## 5. How we'll know it worked

- **In the tests:** each stage counts the requests a page sends, before and after. Expected roughly:

  | Page | Now | After |
  |---|---|---|
  | Home page, each visit | about 23 | 1 or 2 |
  | Lobby, each refresh | about 10 | 1 |
  | Game, live updates broken, over 2 minutes | 30 | about 7 |

- **On the live database:** after each stage goes live, look again at the same records as section 1 (read only) and compare times asked per school day, and how slow things get at the busiest moment.
- **In class:** the real test is a whole class on the home page and in the lobby at once, with no timeouts.

## 6. A bigger server (James: later, if still needed)

The next size up costs about US$10 a month on the paid plan (the plan's fixed credit covers that size). It gives the database its own processor and about twice the memory, so there's much more room before a busy moment becomes a timeout. It's worth having as a safety margin, but it doesn't remove the cause, which is why stages S.1 to S.3 come first.

## 7. James's answers (19 Oct 2026)

1. **5 minutes** is fine for a switch change to reach pupils' screens (S.1).
2. **Up to 30 seconds** is fine for an opponent's move to show when live updates are broken (S.3).
3. The home-page change (Power Clash moved to "Non-maths games") is **committed to `main`**, so the branch starts from it.
4. **Bigger server: later, if still needed** after S.1 to S.3 and a full-class try.
5. **Yes, clear the database's request counts** once S.1 to S.3 are live, after copying section 1's numbers (and any newer ones) into this plan. Only the counts are cleared, never pupil data.

## Stage S.1 results (19 Oct 2026)

**Built on `server-load`, not live.** Nothing merged, pushed to `main`, deployed or changed in the database.

### What was built

- **One read for every switch.** With no class picked, the screen now asks for the person's whole settings row once (`src/data/settingsMemory.ts`, used by `readSettings` in `src/data/classSettings.ts`) and every switch takes its column from it. A signed-in person may read all 27 columns of `app_settings` (checked on the live database, read only), so it asks for `*` and none are left out. Maths Monsters' own direct read now goes through the same place.
- **Remembered for 5 minutes.** Pages asking at the same moment share one request. A failed read (or no row) is not remembered, so the next one tries again. Each caller still shows the same message as before when the read fails.
- **Forgotten:** on sign-out; when a different person signs in on the device (a token refresh for the same pupil keeps it); when the tab comes back after being hidden for more than 5 minutes; and straight after every teacher save that changes a setting (`teacher_set_` multiplayer, space reactions, space maths, Gem Keep, Dragon Maths, Maths Monsters, Clan Quest, raids, Clan Quest maths, pupils choosing focus, maths auto, and the Clan Quest new season). This happens whichever class the save was for, which is a little more than asked and costs at most one extra read. A read already on its way when the row is forgotten is not kept.
- **Teacher class picker:** a picked class is still read fresh every time, not remembered.
- No database change and no server function change.

### Requests (test mock, `src/pages/RequestCount.test.tsx`)

Only the Supabase client is faked; every page and data function is the real one. Empty answers, so cards that only load when there are games (names, maths focus and path cards) don't add their requests here; the live count is a little higher, as in section 5.

| | Before | After |
|---|---|---|
| Home page opening | 20 (3 of them switches) | 18 (1 switch read) |
| Lobby opening | 10 (2 switches: friends and Mission Control maths) | 9 (1) |
| Home page, then lobby | 5 switch reads | 1 |
| Any page within the next 5 minutes | 1 or more switch reads each | 0 |

The big saving is the last line: on 14 to 19 Oct the switches were read about 45,000 times; now a pupil reads them at most about once every 5 minutes.

### The server still checks every switch (step 4)

| Game or switch | Where the server refuses it |
|---|---|
| Maths Monsters | `monster` function: nothing saved while off (`supabase/functions/monster/handler.ts`, "Maths Monsters is switched off.") |
| Dragon Maths | `lord` function: every action answers "closed" while off, except for teachers (`shared/lord/server.ts`, `settings.enabled`) |
| Clan Quest | `clans` function: every action refused while off, except for teachers (`supabase/functions/clans/handler.ts`, from `load_clan`'s `clans_enabled`) |
| Clan Quest raids | Raid targets and raids refused while off (`shared/clans/actions.ts` / `empire.ts` `raidRefusal`, switch read by the server) |
| Playing friends: chess and checkers | `multiplayer` function, "paused" (`handler.ts`, `multiplayerEnabled`) |
| Playing friends: Wormholes & Black Holes | `space-game` function, "paused" |
| Playing friends: 101 | `card-game` function, "paused" |
| Playing friends: Power Clash | `power-clash` function, "paused" |
| Space reactions | `space-game` function, "Reactions are switched off." |
| Mission Control maths | `space-game` (classmates: refused or set to match the switch) and `save-bot-game` (a bot space game with maths can't start while off) |
| Pupils choosing their own focus | The database job that saves a pupil's focus checks `students_choose_focus` |

Gem Keep and maths auto are settings, not on/off switches; the server reads them itself. No game relies only on the screen.

### Tests

- New: `src/data/settingsMemory.test.tsx` (10 tests: three home-page switches in one request; two callers sharing one; 5 minutes then fresh; failed read not kept; class picker fresh; hidden tab over 5 minutes, but not a short break; every teacher save; a read on its way when forgotten; sign-out and a different pupil, with the real sign-in code) and `src/pages/RequestCount.test.tsx` (3 tests).
- Changed: one line in `src/data/focus.test.ts` (the read now asks for `*`). The test setup forgets the row after each test. Every other switch test passes unchanged.
- Quick tests before the change: all 149 files passed (my first edits were made while that run was finishing). After: all pass.

**Not tested:** a real browser and the real sign-in service (the tests fake Supabase); the live request counts, which can only be read after it goes live.

### Go-live steps

1. Merge `server-load` into `main` and push `main`. That deploys the site. No functions to deploy and no database changes.
2. Pupils' screens pick up a teacher's switch change within 5 minutes or on reload; a teacher's own device sees it straight away.
3. After S.1 to S.3 are live, compare the switch reads in `extensions.pg_stat_statements` against section 1 (James's answer 5).

## Stage S.2 results (19 Oct 2026)

**Built on `server-load`, not live.** Nothing merged, pushed to `main` or deployed, and the migration is **not applied** to the live database (it was only run inside rolled-back transactions on the local copy).

### What was built

- **One database job, `my_home_page()`** (migration `20261019000700_my_home_page.sql`, the next free number across every branch and worktree, local and on GitHub). It runs as the pupil (`security invoker`), so each table's row rules still decide what they see. It calls the jobs that already exist (`my_progress`, the five `my_…_game_stats`, `my_moves_left`, `my_class`, `my_maths_focus`, `my_ladder`) and makes the page's ten table reads with the same columns, filters, order and limits, plus the names-and-avatars lookup for the other players. Signed-in users only, like the other `my_` jobs; added to the security test's list.
- **The home page asks once, every time it opens.** Nothing is remembered between visits, so points, recent games and moves left are up to date straight after a game. The switches still come from S.1's remembered read.
- **The three cards** (Join your class, My maths focus, My maths path) take their parts from the same answer. They keep their own request for when they are shown without the home page's answer, or the answer has no part for them. The maths cards read their own parts, so the maths code stays out of the home page's first download (checked in the build).
- **If the one request fails**, the page shows exactly what it showed when every request failed: "We couldn’t load your games just now.", achievements "Loading…", dashes in the stats, no class card, no maths path, and the maths focus card on auto. The cards don't then ask for themselves.
- **One difference in how things fail:** before, each part could fail on its own (say the points while the games still showed). Now the parts come together, so a failure inside any one of them shows the "everything failed" page above. In normal use no part fails on its own.
- The old one-at-a-time data functions are still there (the lobby and other pages use some; the rest are no longer used by any page and could be tidied away later).

### Requests (test mock, `src/pages/RequestCount.test.tsx`)

| | Before S.2 | After |
|---|---|---|
| Home page opening (test mock, maths cards included) | 20 | 2: the one job, and S.1's switch read |
| Home page live, with friend games (adds the names lookup) | 21 | 2 |
| Coming back from a game (switches remembered) | 19 to 20 | 1 |

With S.1 and S.2 together, a class opening the home page sends about 1 request each instead of about 23.

### Timing on the live database (step 5, read only)

Run as the busiest pupil (bd09…, 37 games of four kinds) and the next busiest (f1b3…, 28 games of five kinds), inside a transaction that ended in a deliberate error, so nothing could be kept. The new job's query against all the separate requests run one after another, 15 times each, database time only:

| Pupil | One job (median) | Separate requests added together (median) |
|---|---|---|
| Busiest | 46.2 ms | 46.4 ms |
| Next busiest | 47.9 ms | 48.6 ms |

So the one job is no slower; the work inside is the same (half of it is `my_progress`, about 24 ms). The saving is everything around the work: one sign-in check, one connection and one round trip instead of about 20, which is what queued up on 19 Oct.

### Tests

- Database (`supabase/tests/database/home_page.test.sql`, 40 checks, in a rolled-back transaction with the four migrations the local copy was missing): the job gives exactly the same answer as the separate jobs and table reads for a pupil with more games of every kind than the page shows, a brand-new pupil, a hidden pupil, both teachers, a class with a maths focus and one without, and with every game switched off. Lists are newest first and cut at 5 and 10; a pupil sees only their own 101 seat rows, not a classmate's games or waiting games; hidden players' names are left out; signed-out visitors can't call it; it runs as the person asking. The security test (50), `progress_access` and `mp_games` tests still pass with it.
- Screen (`src/pages/DashboardHome.test.tsx`, 7 tests, with a pretend server that answers both the old requests and the new one from the same games, `src/pages/homePageFake.ts`): one request on opening plus at most the switch read; the same cards and numbers for a busy pupil and a new pupil; the old messages when it fails, with nothing more asked; each card asks for itself when the answer has no part for it; a teacher gets one request and no pupil cards; coming back from a game asks again.
- Old page against new: during the build, the page as it was before S.2 and the new one were drawn side by side from the same made-up games (busy pupil, new pupil, teacher, everything failing, new pupil with everything failing). The pages came out identical, down to the HTML. That comparison was temporary and isn't kept in the repo.
- Existing tests: the card tests and `Dashboard.test.ts` pass unchanged. `App.test.tsx`'s five home page tests pass unchanged; the file gained one fake for the new request, built from its existing made-up answers. `RequestCount.test.tsx` now expects exactly two requests.
- Quick tests before the change: all 151 files passed. After: the whole suite (`TESTS=all`, 159 files, 3,351 tests), the type check and the build all pass.

**Not tested:** a real browser against a real Supabase (the tests fake the client; the database test checks the job's answer against the same reads the client makes, which is what PostgREST runs); the job on the live database itself (only its query was timed there, as above); live request counts, which can only be read after it goes live.

### Go-live steps (in this order)

1. **Apply the one migration** to the live database: `20261019000700_my_home_page.sql` only. It adds one job and changes nothing else, so pages already open, and the site as it is now, carry on exactly as before (they don't call it).
2. **Then merge `server-load` into `main` and push `main`.** That deploys the site (S.1 and S.2 together, if S.1 hasn't gone already). No server functions to deploy.

**Why this order:** the new site asks for `my_home_page`. If the site went first, every pupil's home page would show "We couldn’t load your games just now" until the migration was applied. The other way round there is no gap.

**Pupils with the page open in between:** nothing changes for them. Their page keeps using the old separate requests, which all still exist, until they reload or open the site again, and then they get the new page. Undoing it later only needs the site rolled back: the job can stay.

After S.1 to S.3 are live, compare the home page's jobs (`my_progress`, `my_class`, `my_moves_left`, `my_maths_focus`, `my_ladder` and the table reads) in `extensions.pg_stat_statements` against section 1, then clear the counts (James's answer 5).

# Lighter on the server: plan

*How to make the hub ask the server for much less, so a whole class can use it at once without the database timing out. Written 19 October 2026 for James, after the lobby timeout that morning.*

**Status: S.1, S.2 and S.3 are live (19 Oct 2026 evening; see "S.1 to S.3 went live"). S.4 is built and tested on the `server-load-s4` branch (which starts from S.3), not live: it waits for James to say go. S.5 and S.6 not built. The lobby already refreshes every 20 seconds instead of 5, and the faster points-and-level job is live (both 19 Oct 2026). James answered the questions the same day (section 7).**

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

## Stage S.3 results (19 Oct 2026)

**Built on its own branch, `server-load-s3` (worktree `~/projects/school-games-hub-server-load-s3`), not live.** It starts from the end of S.2, so S.1 and S.2 can go live from `server-load` without it. No database change and no server function change: it is only the screen.

### What was built

- **One shared piece for the checks** (`src/multiplayer/useGameChecks.ts`), used by all four kinds of game with classmates: chess and checkers (`useFriendGame`), Wormholes & Black Holes (`useSpaceGame`), 101 (`useCardGame`) and Power Clash (`usePowerGame`). Before, each had its own timer: every 20 seconds while live updates worked, every 4 seconds while they didn't.
- **When live updates break:** the waits between checks are 4, 8, 16 and then 30 seconds, and stay at 30. As soon as live updates work again, it goes back to every 20 seconds; if they break again, it starts at 4 seconds again. "Connecting" counts the same as broken, so a connection that keeps dropping and coming back doesn't keep starting the waits again.
- **Spread out:** each wait is made up to a quarter longer at random (so 20 to 25 seconds while live updates work, 4 to 5, 8 to 10, 16 to 20 when broken), so a class doesn't ask at the same moment. **No wait is ever longer than 30 seconds**, which keeps James's answer 2 (an opponent's move shows within 30 seconds). The plan said "up to a quarter of the gap" for every wait, which would have made the longest 37.5 seconds; it is capped at 30 instead. The randomness in the shorter waits before it still keeps a class out of step.
- **Hidden tabs:** no checks at all while the tab is hidden. Coming back to the tab still looks again straight away (that was already there, and is unchanged).
- **Your own moves** still go straight to the server and show straight away. Only the "did anything change?" checks slow down.

### Requests

| One pupil's game screen, over 2 minutes | Before | After |
|---|---|---|
| Live updates broken | 30 checks | 6 (fewer with the random spread) |
| Live updates working | 6 | 6 or fewer (20 to 25 seconds apart) |
| Tab hidden | 6 or 30 | 0 |

### What a pupil might notice

Only when live updates are broken: an opponent's move can take up to 30 seconds to appear, instead of about 4. When live updates work, nothing changes.

### Tests

- New: `src/multiplayer/useGameChecks.test.tsx` (18 tests). The waits are 20 seconds, or 4, 8, 16 then 30; the spread is up to a quarter longer and never over 30 seconds; 6 checks in 2 minutes with live updates broken; back to 20 seconds when they work and starting at 4 again when they break again; a dropping connection doesn't restart the waits; no checks while hidden; none once the game is over. For each of the four kinds of game, with only the server requests faked: 6 checks in 2 minutes broken and 6 working; nothing while hidden and one check straight away on coming back.
- Quick tests before the change: all 152 files passed. After: the whole suite (`TESTS=all`, 160 files), the type check and the build pass. The existing game page tests pass unchanged.

**Not tested:** real live updates breaking in a real browser (the tests fake the live-updates channel and the clock).

### Go-live steps

S.3 needs S.1 and S.2 to go first, because its branch contains them.

1. Once S.1 and S.2 are live (the `my_home_page` migration applied, then `server-load` merged into `main` and pushed), merge `server-load-s3` into `main` and push. That deploys the site. No migration and no functions.
2. A pupil already in a game keeps the old checks until they reload or open the game again.

If S.3 ever has to go before S.1 and S.2, the `my_home_page` migration must be applied first, for the same reason as in S.2.

## Go-live rehearsal (19 Oct 2026)

**A practice run of putting S.1 to S.3 live, with nothing live touched.** It was done on a throwaway branch from GitHub's `main` (in a throwaway worktree, both deleted afterwards and never pushed).

### What was checked

- **Merging:** `server-load`, then `server-load-s3`, went into today's `main` with **no clashes**. `main` had gained one commit since the branches were made (a Dragon Maths question-box fix), which touches different files. Merging into the `main` on this computer gives exactly the same files: it has four commits that aren't on GitHub yet (the Power Clash home-page move, this plan, the S.1 prompt and a merge), and `server-load` already contains the first three. So pushing `main` after the merge also puts live **Power Clash moving to "Non-maths games"** on the home page (section 7, answer 3).
- **The merged copy:** the type check, the whole suite (`TESTS=all`: 161 files, 3,370 tests) and the build all pass.
- **The database side, on the local copy, in rolled-back transactions:** the local copy had migrations up to `20261019000100`. With `000200` to `000600` from `main` and then `20261019000700_my_home_page.sql` piped in, `home_page.test.sql` passes (40 of 40), and so does the security test on its own (50 of 50). Nothing was kept.
- **The live database, read only:** every job `my_home_page` calls (`my_progress`, the five `my_…_game_stats`, `my_moves_left`, `my_class`, `my_maths_focus`, `my_ladder`) is there with the same inputs and the same kind of answer, and every table column it reads (`mp_games`, `bot_games`, `space_games`, `card_game_seats`, `power_games`, `profiles`) is there with the same type. The bodies match `main`'s migrations except one: **the live `my_progress` is Bond Match's version** (M.4, applied live), which adds Bond Match games to the recent points list. `my_home_page` passes its answer on unchanged, so that's fine, and it is the version pupils get now. (Worth knowing: `main`'s `20261019000600_faster_my_progress.sql` is the older one, so it must never be re-run on the live database.) `my_home_page` and `lobby` are not there yet, as expected. The live database keeps no list of applied migrations: they have always been pasted in by hand.
- **Not redone: the live timing.** Timing the job's query as the busiest pupil on the live database was refused by Claude Code's safety check this time, and was not tried another way. S.2's numbers from earlier the same day (46.2 ms against 46.4 ms) stand: nothing the job uses has changed since, apart from the Bond Match line above.

### Go-live steps for James

Each step only when you say so. Do them in this order.

**Step 1. Add the home page's job to the database.**

1. On GitHub, open the `server-load` branch's file `supabase/migrations/20261019000700_my_home_page.sql` (github.com/bleedingrobot/school-games-hub/blob/server-load/supabase/migrations/20261019000700_my_home_page.sql) and press **Raw**. Select all and copy.
2. In the Supabase dashboard, open the project, then **SQL Editor**, then **New query**. Paste the whole file in and press **Run**.
3. **If it worked** you see "Success. No rows returned". If you see "function my_home_page already exists", it was already in: that's fine too. Any other red message: stop and tell Claude what it says.
4. Tell Claude **"done"**. Claude then checks, read only, that the job is there, runs as the pupil, and only signed-in users can use it, before going on.

Pupils notice nothing from this step: the site doesn't use the job yet.

**Step 2. Put S.1 and S.2 live (and the Power Clash home-page move).**

- Claude merges `server-load` into `main` and pushes `main`.
- **Or from your phone:** on GitHub open github.com/bleedingrobot/school-games-hub/compare/main...server-load, press **Create pull request**, then **Create pull request** again, then **Merge pull request** and **Confirm merge**. (Claude tidies up the copy of `main` on the computer afterwards.)
- Either way, GitHub then runs its checks and publishes the site, which takes a few minutes. On GitHub, **Actions** shows a green tick when it's out. A red cross means a check failed and nothing was published: the old site stays.

**Step 3. Later, put S.3 live.** After a school day or so with step 2 looking fine: Claude merges `server-load-s3` into `main` and pushes `main` (or, from the phone, the same as step 2 with github.com/bleedingrobot/school-games-hub/compare/main...server-load-s3). No database step.

### What to check afterwards

- After step 2: open the site as a pupil (or ask one). The home page shows points, recent games and the class card as before, all at once rather than bit by bit, and the lobby works. "We couldn’t load your games just now" would mean something is wrong.
- After step 2, Claude can check the live request records (read only) to see the home page asking `my_home_page` once instead of about 20 separate requests.
- After step 3: a game with a classmate works as before.
- Once all three are in, copy section 1's numbers and then clear the request counts (section 7, answer 5).

### How to undo each step

- **Step 1:** nothing needs undoing; the job can stay even if the site goes back. If it must go, paste `drop function public.my_home_page();` into the SQL Editor, but only once step 2 has been undone, or the home page will show "We couldn’t load your games just now".
- **Step 2 or 3:** on GitHub, open the pull request and press **Revert** (then merge the new pull request it makes), or tell Claude to revert the merge on `main` and push. The site goes back to how it was in a few minutes. Pupils with a page open keep what they have until they reload.

## S.1 to S.3 went live (19 Oct 2026, evening)

- **S.1 and S.2:** James pasted `20261019000700_my_home_page.sql` into the SQL Editor. Checked live, read only: its text is the same as the file's, it runs as the pupil, and only signed-in users can use it. Then `server-load` was merged into GitHub's `main` (merge commit `e7c2e4e`) and pushed; "Test and publish" passed. That also put the Power Clash home-page move live.
- **Check before S.3 (read only):** the published site asks for `my_home_page` and the home page's separate requests are no longer in its main files. Only 2 `my_home_page` calls had come in by 7:35 pm (a quiet evening): 106 ms and 1,276 ms, the second most likely a cold start. The request counts are totals since 14 Oct, so whether the old separate calls have stopped can only be seen by comparing with that evening's numbers after a school day (saved at 7:35 pm: `my_progress` 1,119, `my_class` 516, `my_moves_left` 470, `my_maths_focus` 477, `my_ladder` 440, `my_home_page` 2).
- **S.3:** `server-load-s3` merged into GitHub's `main` (merge commit `80f3ea9`, on top of `dd44a51`, which had three newer commits: a maths question wording change, a crash screen and a Clan Quest fix) and pushed with James's approval. "Test and publish" passed (run 39212833539). The published files have S.3's waits (4, 8, 16 and 30 seconds). No database change.
- **Not checked by Claude:** a real game with a classmate on the live site (James to try).
- **Undo:** revert the merge on `main` and push (James approves), or GitHub's Revert button.

## Stage S.4 results (19 Oct 2026)

**Built on its own branch, `server-load-s4` (worktree `~/projects/school-games-hub-server-load-s4`), not live.** It starts from `server-load-s3` after the go-live rehearsal, so it contains S.1 to S.3. Nothing merged, pushed to `main` or deployed, and the migration is **not applied** to the live database (it was only run inside rolled-back transactions on the local copy).

### What was built

- **One database job, `lobby()`** (migration `20261019000800_lobby.sql`, the next free number across every branch and worktree, local and on GitHub). It runs as the pupil (`security invoker`), so each table's row rules still decide what they see. It calls the four jobs that already exist for the open games anyone can join (`lobby_games`, `space_lobby_games`, `card_lobby_games`, `power_lobby_games`) and passes each list on in its own order. It reads my own open games of each kind with the same columns, order and limits as the lobby did (the same reads as `my_home_page`), and looks up the names and avatars of the other players in them, by id, as the lobby did (hidden players are left out by the profiles' own row rule). Signed-in users only, like the other jobs; added to the security test's list.
- **Written for speed:** it is written in PL/pgSQL (the database's own scripting language), so the database keeps its plan between calls instead of working it out again every 20 seconds for every pupil, and it builds its answer as plain JSON, the way the server builds each separate answer. See the timing below for why.
- **The lobby asks once per refresh.** `refresh` in `src/pages/Lobby.tsx` now asks `lobby` once (`src/data/lobby.ts`), plus S.1's remembered switch read. Still every 20 seconds while the tab is shown, still straight away when the tab comes back, and creating or joining a game still never waits for it. The lobby still drops my waiting games that are past their time, with the same rule as before (now shared: `stillOpen` in `multiplayer.ts`, `stillOpenSeats` in `cardGames.ts`, also used by the old fetchers). Power Clash still shows only while `POWER_CLASH_ON` is on.
- The old one-at-a-time fetchers are still there (the games still use `fetchPlayerCards`; the lobby lists and "my open games" fetchers are no longer used by any page and could be tidied away later).

### What changes when something fails

- **Before:** the space, 101 and Power Clash parts were asked for separately and could each fail on their own: the lobby then still showed chess and checkers and the other kinds, with that kind missing. If the names failed, the games showed "a classmate".
- **Now** it is one request. If it fails, the lobby shows exactly what it showed before when everything failed: "We couldn’t load the lobby. Check the Wi-Fi; we’ll keep trying.", "Loading…" under open games, and the Start a game and Join with a code boxes (which still work). If a later refresh fails, it keeps showing what it had and tries again in 20 seconds, as before. In normal use no part fails on its own.

### What a pupil might notice

Nothing, except that classmates' names in "Your games" now come with the games, instead of "a classmate" for a moment first.

### Requests (test mock, `src/pages/RequestCount.test.tsx` and `src/pages/LobbyRequests.test.tsx`)

| The lobby | Before S.4 | After |
|---|---|---|
| Opening (switches not yet remembered) | 9 (10 before S.1) | 2: the one job, and S.1's switch read |
| Opening, with games with classmates (adds the names lookup) | 10 | 2 |
| Each refresh after that (every 20 seconds) | 8 or 9 | 1 |

So a class of 28 in the lobby sends about 28 requests every 20 seconds instead of about 250.

### Timing (step 4)

- **On the live database: not done.** Claude Code's safety check refused timing queries as a pupil on the live database (in the rehearsal too), and it was not tried another way.
- **Instead, on the local copy,** with the database test's made-up games, as the pupil with games of every kind: the one job against the nine separate requests one after another, 200 rounds, median, database time only. Both sides were timed the way the real server runs them: plans kept between calls (the server's connections stay open), each separate answer turned into JSON, and the server's setup at the start of each request.
- **The first version was slower:** about 16 ms against 14 ms. That's the "stop" case in step 4, so before going further I found out why, and fixed all three causes: a plain SQL job is planned again on every call (about 1.3 ms here), the names were compared as text (so the profiles' row rule was checked for every pupil instead of the few needed), and the answer was built in the slower `jsonb` form.
- **The final version: the same.** 13.9 to 14.2 ms each way, over three runs (within 0.03 ms). Most of that is the four existing open-game jobs (about 2.5 ms each here), which are unchanged. The saving is everything around the work: one sign-in check, one connection and one round trip instead of nine.
- The live database is a different machine with more pupils, so if James wants the live number before it goes live, Claude needs his OK for that read-only check at his computer.

### Tests

- **Database** (`supabase/tests/database/lobby.test.sql`, 37 checks, in a rolled-back transaction with the migrations the local copy was missing): the job gives exactly the same answer as the four lobby jobs, the four table reads and the names lookup for a pupil with open games of every kind (more chess and checkers games than the lobby shows), a classmate, a hidden pupil, a pupil with none, a pupil at another school, a teacher, and with playing friends switched off. Lists are in the same order and cut at 10; finished games, expired lobby games, a hidden pupil's lobby game, a code-only game and the other school's games are left out, as now; a hidden player is left out of other pupils' names; a pupil sees only their own 101 seat rows, never a classmate's; signed-out visitors can't call it; it runs as the person asking. Checked that the test catches mistakes: a wrong limit fails 5 checks, running as the owner instead of the pupil fails 21. The security test (50) and `home_page` test (40) pass with it, and so does every other database test file.
- **Screen** (`src/pages/LobbyRequests.test.tsx`, 8 tests, with the pretend server from S.2 now answering the lobby's old requests and its new one from the same games, `src/pages/homePageFake.ts`): one request on opening plus the remembered switch read; the same open games and "Your games" in the same order as before (including two games made at the same moment, a hidden player and an expired waiting game); one request every 20 seconds and none while the tab is hidden; one straight away when the tab comes back; the old message when it fails, with nothing more asked; the games kept when a later refresh fails; creating and joining with a code still work while the lobby's request hasn't answered. Pointed at the old lobby, the five request tests fail and the order, create and join tests pass, as they should.
- **Old lobby against new:** during the build, the lobby as it was before S.4 and the new one were drawn side by side from the same made-up games (a busy lobby, an empty one, everything failing, playing friends paused). The HTML came out identical (once React's automatic ids for the avatar pictures, which just count up between drawings, were set aside). With one part failing on its own, the old lobby still showed the other games and the new one shows the "everything failed" page, as described above. That comparison was temporary and isn't kept in the repo.
- **Existing tests:** `Lobby.test.tsx` and `LobbyPower.test.tsx` pass with their tests unchanged; each file gained two lines, a fake for the new request built from the fakes they already set up (`src/pages/lobbyFromSeparate.ts`). `RequestCount.test.tsx`'s lobby test now expects exactly the two requests.
- Quick tests before the change: 152 of 153 files passed; `SetFocus` failed once and passed on its own (known flaky). After: the whole suite (`TESTS=all`, 161 files, 3,377 tests), the type check and the build all pass.

**Not tested:** a real browser against a real Supabase (the tests fake the client; the database test checks the job's answer against the same reads the client makes); the timing on the live database; live request counts, which can only be read after it goes live.

### Go-live steps (in this order)

S.4 needs S.1 to S.3 to go first, because its branch contains them: steps 1 to 3 of the go-live rehearsal above (the `my_home_page` migration, then `server-load`, then `server-load-s3`). Then:

1. **Apply the one migration** to the live database: `20261019000800_lobby.sql` only, pasted into the Supabase SQL Editor from the `server-load-s4` branch on GitHub (github.com/bleedingrobot/school-games-hub/blob/server-load-s4/supabase/migrations/20261019000800_lobby.sql, then **Raw**). If it worked you see "Success. No rows returned". Tell Claude "done", and Claude checks (read only) that the job is there, runs as the pupil and only signed-in users can use it.
2. **Then merge `server-load-s4` into `main` and push `main`** (or, from the phone, github.com/bleedingrobot/school-games-hub/compare/main...server-load-s4, then **Create pull request** and **Merge pull request**). That deploys the site. No server functions.

**Why this order:** the new lobby asks for `lobby`. If the site went first, every pupil's lobby would show "We couldn’t load the lobby" until the migration was applied. The job adds nothing else and changes nothing, so applying it first leaves no gap. If S.4 is merged before S.3 has gone, it takes S.3 (and S.1 and S.2) live with it, so the `my_home_page` migration must be in first as well.

**Pupils with the lobby open in between:** nothing changes for them. Their open lobby keeps using the old separate requests (which all still exist) every 20 seconds until they reload or open the site again, and then they get the new lobby. Undoing it later only needs the site rolled back (revert the merge): the job can stay.

After it is live, compare the lobby's requests (`lobby_games`, `space_lobby_games`, `card_lobby_games`, `power_lobby_games` and the table reads) in `extensions.pg_stat_statements` against section 1.

## S.4 go-live check (20 Oct 2026, morning)

Nothing live changed. Before asking James to paste the lobby migration:

- **Still merges cleanly** with GitHub's `main` (now 16b93a9, which has the faster tests, the database checks in the publish and the Dragon Maths question box fix). No new migrations on `main` since 000700, so 000800 is still the next number.
- **The merged code passes everything:** type check, build, and the whole suite (`TESTS=all`, 164 files, 3,385 tests, 1 skipped).
- **Every database test file passes with the lobby migration** (36 files, including `lobby` 37, `security` 50, `home_page` 40), each run on the local copy inside a transaction that was rolled back, so the local copy is still at 000700. Once `main` has the migration, the publish's own database check will run it too, so a broken migration would stop the publish.
- **Not done:** the live read-only checks (is `lobby` already there, and the request counts after a school day). Claude Code's safety check refused them in auto mode; they wait for James (manual mode, or he approves them at his computer).

## S.4 went live (20 Oct 2026)

- **Migration:** James pasted `20261019000800_lobby.sql` into the Supabase SQL Editor ("Success. No rows returned"). Checked read only on the live database: `lobby()` is there, returns `json`, is `plpgsql` and `security invoker`; signed-in users can call it, `anon` and `public` can't. Its text is exactly the file's except that the SQL Editor saved every line ending as Windows-style (61 extra carriage returns, one per line); with those set back, the text's md5 matches the file's. Harmless: PL/pgSQL reads a carriage return as a space.
- **Site:** merge commit 6310ae0 (origin/main 16b93a9 + `server-load-s4`) pushed to `main` with James's approval. The first "Test and publish" run failed on the known flaky wormhole test in `src/games/space/SpaceLive.test.tsx` (nothing published; database checks passed; the test passed 5 out of 5 on its own); re-running the failed jobs passed and published. The published JS asks for `lobby` once per refresh.
- **To check:** the lobby lists open games and "Your games" as before; starting a game and joining with a code work.
- **To undo:** revert the merge on `main` and push (or GitHub's Revert button). The job can stay.
- Still to do: compare the lobby's requests in `extensions.pg_stat_statements` against section 1 after a school day.

## Stage S.5 results (20 Oct 2026)

**Built on its own branch, `server-load-s5` (worktree `~/projects/school-games-hub-server-load-s5`, from `main` after S.4), not live.** No migration, no screen change: only the ten server functions.

### What was built

- **One shared sign-in check,** `supabase/functions/_shared/signIn.ts`, used by all ten functions (`save-bot-game`, `multiplayer`, `space-game`, `card-game`, `gem-keep`, `power-clash`, `monster`, `lord`, `clans`, `training`) in place of their own `getUser` call. It uses the Supabase library's `getClaims`:
  - **With the newer sign-in keys** (after James's switch in the dashboard), the token's signature is checked inside the function against the project's public keys. The library fetches those keys once and keeps them for 10 minutes, so a pupil's moves no longer ask the sign-in service (and its database) who they are.
  - **With the older shared secret** (now, and for up to an hour after the switch while old tokens run out), or a token naming a key the project doesn't have, the library asks the sign-in service, exactly as `getUser` does today. So **this can go live before the switch and changes nothing until then.**
  - Only a signed-in user's token is accepted (`role` is `authenticated` and it names the user); expired, changed, forged or junk tokens are refused, and a failure to fetch the keys is a refusal, never a crash. What each function does after the check is unchanged.
- The ten `index.ts` files are rebuilt. `monster/index.ts` also picks up the "Write it as a decimal." wording that was on `main` but never rebuilt into it (Maths Monsters is switched off for pupils).
- All ten functions were already deployed with Supabase's own gate ("Verify JWT") **off** (README; the go-live checks it). That matters: Supabase's docs say that gate breaks with the newer keys, so it must stay off.

### What changes for pupils

Nothing they can see. **One difference in how sign-out works:** after a pupil signs out, the functions keep accepting their old sign-in token until it expires (at most 1 hour), because the check no longer asks the sign-in service. The browser throws the token away on sign-out, so this only matters if someone had copied it out of the browser. Teachers removing or hiding a pupil is unchanged: the functions' own database checks still look the pupil up on every request.

### Tests

- **`supabase/functions/_shared/signIn.test.ts`** (12 tests): the real Supabase library against a pretend sign-in service, with real tokens signed by real ES256 keys. Right pupil with no request to the sign-in service, keys fetched once for three checks; expired, changed after signing, signed by a forger's key under the project's key name, the site's public key, the server's key, no user, wrong role, junk: all refused; an unknown key asks the sign-in service; a new key is picked up straight away; keys that can't be fetched mean a refusal; older-style tokens ask the sign-in service and trust only its yes. Checked that the tests catch a missing role check.
- **Against the real sign-in service on the local copy** (which already signs with ES256): a throwaway pupil signed in; 21 checks gave the right pupil with one request (the public keys), about 3 ms each after the first; the site's public key, the server key and a changed token were refused; the old `getUser` agreed. After sign-out, the new check still accepted the token and `getUser` did not (the difference above). The pupil was then removed. (Side finding: removing a user through the sign-in service's admin API failed locally with "permission denied for table class_group_members"; the user was removed directly instead. Worth checking before anyone deletes a pupil from the Supabase dashboard.)
- **Whole suite:** type check, and `TESTS=all` (165 files, 3,397 tests, 1 skipped) all pass, including every function's handler tests, unchanged.

**Not tested:** the live project after the switch (needs James's dashboard change); the request counts, which can only be read after it goes live.

### Go-live steps (in this order)

1. **Check the live functions (read only, needs manual mode):** each of the ten deployed functions matches `main`'s `index.ts` today (apart from `monster`'s wording), so deploying doesn't bring in anything else, and each has Verify JWT off.
2. **Deploy the ten functions** from this branch: `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api` for each (James approves). Nothing changes yet: with the older secret they ask the sign-in service, as now. Check from outside: each still answers 401 without a sign-in; a quick game still saves.
3. **Merge `server-load-s5` into `main`** (James approves the push). The site's own code is unchanged, so this just keeps `main` the same as what's deployed.
4. **James switches the keys** in the Supabase dashboard: **Project Settings → JWT Keys**, then **Migrate JWT secret** (the old secret carries on working and a new ECC key is made, waiting), then **Rotate keys** so the new key signs new sign-ins. **Don't revoke the old secret, and leave the legacy API keys on:** the site uses them. Pupils stay signed in; their tokens switch over as they refresh (within an hour).
5. **Check** an hour later: a game with a classmate and a Clan Quest fight still work; then, after a school day, the sign-in service's database requests from the functions should have dropped (compare `extensions.pg_stat_statements` with section 1).

**To undo:** before step 4, redeploy the previous `index.ts` files (or just leave them: they behave as before). After step 4, nothing needs undoing for the functions to work, since they handle both kinds of key; rotating back is in the same dashboard page.

## S.5 functions deployed (20 Oct 2026)

**Step 1 check (read only) found two things the plan didn't expect:**

- **Six live functions were older than `main`,** each exactly an older commit on `main`: `save-bot-game`, `space-game`, `gem-keep` from eb09215 (F.8 part A); `card-game`, `monster`, `lord` from f13f87c (F.2). Deploying `main`'s versions would also have put live the "Write it as a decimal." wording (all six) and F.3 part 2, F.5 and F.6 (`card-game`, `monster`, `lord`), none of which had been deployed in those functions. So **each function was built from the exact commit that is live, plus only the sign-in change** (temporary worktrees at eb09215, f13f87c and the `bond-match` tip 4b3101e; `multiplayer`, `power-clash`, `clans`, `training` were already identical to `main`). For all eleven, the new file differs from the downloaded live file by exactly the sign-in check and the one `userIdFor` line (28 changed lines, the same in each; `multiplayer` 27, one comment fewer). All load `@supabase/supabase-js@2.117.3`, the version tested.
- **An eleventh function, `bond-match`** (live from the `bond-match` branch tip 4b3101e, game switched off), had **Verify JWT on**, which Supabase says breaks after the key switch. It checks the sign-in itself, so it got the same sign-in change and was deployed with Verify JWT off, like the rest. The change is **not committed to the `bond-match` branch** (its worktree has someone's unsaved files): the branch's `bond-match/entry.ts` still has `getUser`, so its next deploy must take the change or it goes back to asking the sign-in service (still works) — and must keep `--no-verify-jwt`.

**Deployed** all eleven with `functions deploy <name> --no-verify-jwt --use-api` (Maths Monsters first, as it's switched off). From outside, Maths Monsters answered 401 "Please sign in again." with no token, a junk token and a forged ES256 token naming a made-up key. The same outside check on the other ten was refused by the auto-mode safety check; it waits for manual mode.

**So `main` and live functions still differ** in the same six (that was already so): `main` has maths changes not yet deployed in them. Whoever deploys those next takes the sign-in change with them from this branch once merged.

**To undo:** redeploy the previous builds (`git show eb09215:supabase/functions/<name>/index.ts`, `f13f87c:…`, `origin/main:…` for the four, `4b3101e:…` for `bond-match`). Not needed for the key switch to be safe: before it, the new check asks the sign-in service exactly as before.

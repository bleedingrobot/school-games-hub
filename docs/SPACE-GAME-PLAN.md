# Wormholes & Black Holes: plan

Stage 9 of School Games Hub: a space snakes and ladders for Years 4–6, against bots or 2–4 classmates.
Written 15 October 2026 from the brief in [prompts/space-game.md](prompts/space-game.md), after reading the code on the `stage-8` branch.
**Status: approved by James on 15 October 2026 (answers in section 11). Stage 9.1 done (results in section 14); James happy with the numbers as they are (15 Oct 2026). Stage 9.2 done (playing against bots; phone preview built with `npm run space:preview`). Stage 9.3 done (bot games saved and checked, taking-part points, space achievements; results in section 15; not live yet). Stage 9.4 done (playing classmates; results in section 16; not live yet). Stage 9.5 done (polish; results in section 17; not live yet). Stage 9.6 done (pass-and-play; section 18). **LIVE 16 October 2026** (migrations 0600 + 0700 applied, save-bot-game and space-game deployed, merged to main). Mission Control maths not built (only if James asks).**

Where this plan and the brief disagree, this plan wins once James approves it.

## The short version

- **It's a new game card on the dashboard**, added with one line in `src/games/registry.ts`, like chess and checkers. Chess and checkers don't change at all.
- **One rules engine in `shared/space/`** runs the whole game. The same code runs in the browser, in the bots and in the server. Give it the same board, the same dice and the same choices, and it always gives the same result. That's what makes games checkable and testable.
- **Against bots:** the game runs in the student's browser, like chess, so it costs nothing and carries on through patchy Wi-Fi. At the start the server hands out a stamped "dice seed". At the end it replays the whole game from that seed before saving it, so a student can't invent a win.
- **Against classmates (2–4 players):** a **new table** and a **new server function** just for this game. The server rolls every die. The browser only ever *asks* ("roll", "use my Booster", "jump through the gate"). The `mp_games` table that chess and checkers use isn't touched.
- **Points:** this game is mostly luck, so it **never** affects ratings, badges or leaderboards. I recommend small **participation points** (the same points whether you win or lose) plus a few fun one-off achievements. Your call: see the questions at the end.
- **Cost:** stays well inside the free plan. A whole class playing it three lessons a week adds roughly 40,000 function calls a month to the ~70,000 chess and checkers already use, against 500,000.

## 1. What the brief says vs what's built now

The brief was written before Stages 7 and 8. Here's what still fits and what changes.

| Brief says | Now | What I'll do |
|---|---|---|
| "Stage 7 (points, badges, ratings) isn't built yet" | Built and live: points, levels, achievements, Elo ratings, rank badges, leaderboards, teacher view | The space game plugs into it, but only for points and achievements (section 7) |
| Save results with `counts_for_points` like the other games | Still how it works. A database trigger scores a game the moment it's saved | Same column, same idea. The space game gets its own scoring rules |
| Never count towards competitive ratings | Ratings come only from friend games in `mp_games` | Space games never touch `ratings`. The **Leaderboard** page and the rank badges skip games marked "not ranked" |
| Bot games never count towards rankings | Bot games earn small points, at most 40 a day across all games | Space bot games share that same 40-a-day cap |
| Respect the teacher's "pause games against friends" switch | Live (`app_settings.multiplayer_enabled`) | The new server function checks the same switch |
| Use the `version` check against double taps | Live in `mp_games` | Same check in the new table |
| Reloading or losing Wi-Fi never loses a game | Stage 8 added: one automatic retry on Wi-Fi drops and Supabase 502/503s, and bot saves that are safe to send twice | Same retry for every space request; space bot saves are safe to send twice in the same way (the stamped seed makes each game unique) |
| Presence ("who's here") channel | Stage 8 made it **presence only**: no hidden chat | Space games get the same kind of channel, presence only, covered by the same rule and tested |
| (not in brief) | Stage 8: new tables start locked; `security.test.sql` checks every table and function | Every new table and function is added to `security.test.sql`'s lists on purpose, with a test showing students can't write to them |
| Brief section 1 file list mentions `CLASS-LAUNCH.md` | Exists | I'll add a short space-game part to it at the end |

Two things in the current code assume "chess or checkers" and need a small, careful change (with chess and checkers tests still passing untouched):

- The **Leaderboard** page and the **rank badges** list every game in the registry. I'll add `ranked: false` to the space game's entry so those pages leave it out.
- Database `check` rules only allow `'chess'` or `'checkers'` in `bot_games`, `scored_games` and `achievement_types`. The migration adds `'space'` to those lists. `ratings` stays chess and checkers only, so a space rating can't exist.

## 2. The rules

The numbers below are **starting points**. Stage 9.1 builds a simulation that plays tens of thousands of bot games per board, and I'll tune the numbers from that and report them back to you before building the screens.

### Moving, winning and how long a game lasts

- 10×10 board, squares 1–100 in the classic back-and-forth pattern. Launch from Earth (square 1), race to the space station on 100.
- Roll one die and move. Rockets can share a square (no bumping).
- **Finishing:** my recommendation is **any roll that reaches 100 wins**. A quick simulation on a classic board: needing the exact roll makes games about 15–20% longer, and most of that is rockets bouncing about near the end. For 9-year-olds, that's the frustrating bit. "Exact roll" stays as a setting.
- **Roll a 6, roll again:** a setting, off by default, at most once per turn.
- **The mission clock (new, my idea):** dice games have long tails. In my quick simulation of a classic board (exact-roll finish), an average 4-player game took 20 rounds, but the unluckiest of 20,000 took over 100. A class can't wait that long. So after a set number of rounds (to be tuned, about 40 on the big board), the **fuel runs out** and rockets finish in order of how far they got. A "⏱ 5 rounds of fuel left" warning shows first. Almost no game should reach it. It's there so a lesson never gets stuck.
- **Places, not just a winner:** when someone docks, the game ends and everyone gets a place (1st, 2nd, 3rd, 4th) by how far they got. A podium shows every rocket.
- **Target length:** 8–15 minutes for 2–4 players on the big board, 3–6 on the quick board. Turns are fast, so a 4-player game of about 75 turns at roughly 6–8 seconds a turn (dice, hops, effects, decisions) lands in that range. The simulation will check it. A speed setting (Relaxed / Normal / Zippy) changes only the animations.

### Wormholes and black holes

- **Wormholes** (the ladders) carry you up, with a swirl through the tunnel.
- **Black holes** (the snakes) pull you down, with a cartoon "spaghetti" stretch and spin. Silly, not scary.
- Force Field blocks one black hole. Escape Pod halves the drop (rounded so you always lose at least 1 square).

### Star squares

Each star has its own shape and icon (never colour alone), plus a one-line fact for Year 4–6 readers.

| Star | Effect | Notes |
|---|---|---|
| Red dwarf | Gain a common item | Most common star |
| Yellow star | Gain a random item | |
| Blue giant | Gain a rare item | Rare |
| White dwarf | Gain a Force Field | |
| Binary star | Next turn, roll two dice and pick one | |
| Neutron star | Heavy gravity: your next 2 rolls are halved (rounded up, never 0) | A "hinder" square |
| Pulsar | Every other rocket within 5 squares behind *or* ahead goes back 2 | Never pushes below square 1 |
| Supernova | You blast forward 5, rockets within 10 go back 2, then it becomes a harmless nebula | Once per game |
| Comet | Land anywhere on the comet and ride to the front of its tail | The comet moves forward a few squares each round, and wraps round |
| Matariki | Everyone gets a common item. A sharing square | **Wording for you to check** (below) |

**Matariki wording (draft, for you to check, perhaps with your school's te reo or tikanga lead):**
> **Matariki.** Matariki is a cluster of stars that rises in midwinter. For many people in Aotearoa it marks the Māori New Year, a time to remember, celebrate and share. *Everyone gets a gift!*

If you'd rather not include it, it's easy to drop or rename.

**Full inventory:** if you already hold 3 items, a new one goes straight to you only if you choose to swap one out. In multiplayer that choice has a 15-second timer, and on timeout you keep what you have.

### Items (hold up to 3, use one before rolling)

| Item | Kind | Effect |
|---|---|---|
| Booster | help | +2 to your next roll |
| Hyperdrive (rare) | help | Double your next roll |
| Navigator (rare) | help | Choose your roll, 1–6 |
| Force Field | help, automatic | Blocks the next black hole you land on |
| Escape Pod | help, automatic | A black hole drops you only half as far |
| Repair Kit | help | Clears a gravity effect |
| Warp Key | help | Jump to the nearest wormhole entrance ahead of you (and ride it) |
| Rescue Beacon | help, catch-up only | Jump forward 10. Only given to a rocket 30+ squares behind the leader |
| Tractor Beam | hinder | Pull a chosen rocket back 3 |
| Gravity Anchor | hinder | A chosen rocket's next roll is halved |
| Space Mine | hinder | Drop it on your square. The next *other* rocket to land there goes back 3 |
| Quantum Swap (rare) | hinder | Swap places with a rocket up to 15 squares ahead |

**Keeping hinders fun, not mean** (my picks, the engine enforces them):

1. You can't target the rocket in **last place**.
2. After being hit by a hinder, a rocket has a **shield until its next turn**. Nobody can gang up on one player in one round.
3. You can't target the **same rocket twice in a row**.
4. No Quantum Swap if the target is on **square 90 or higher**. Nobody gets robbed at the finish line.
5. Space Mines are visible to everyone, one per player on the board at a time, and fizzle out after 5 rounds.
6. Bots follow exactly the same rules.
7. **Classic mode has no items at all**, so younger classes can play with no hinders.

### Gravity squares

- **Heavy gravity:** next 2 rolls halved, rounded up (never 0).
- **Low gravity:** +2 on your next 2 rolls.
- **Slingshot:** your next roll doubled.
- One gravity effect at a time. A new one replaces the old. Shown as a clear badge with an icon on the rocket and in the player list.

### Teleports

- **Paired gates:** land on one and choose to jump to its twin or stay. 15-second timer in multiplayer; "stay" on timeout.
- **Mystery coordinates station:** pick one of three face-down cards. **The destination is decided by the server only after you pick**, so there's nothing hidden in the game data for a curious student to peek at with developer tools. (Same fairness, nothing to leak.) 15-second timer; card 1 on timeout.

### Cosmic events (a setting)

Every 5 rounds, one of three. Each one gets a full-width banner and a mission log line:

- **Solar wind:** everyone's next roll +1.
- **Meteor shower:** 5 random empty squares become asteroids for one round. Landing on one costs an item (or 1 square if you have none).
- **Wormhole shift:** one wormhole's exit moves up to 5 squares (still obeying the fairness rules below).

### Catch-up and safety rules

- **Catch-up help:** the rocket in last place gets one tier better from star squares (common becomes random, random becomes rare). A rocket 30+ squares behind the leader gets a Rescue Beacon, at most once every 5 rounds.
- **Chain reactions** (wormhole → star → gate...) are capped at **3 effects per turn**. After that, squares do nothing until the next turn, so loops are impossible. The engine also has a hard safety stop that tests check is never hit.
- **Mission log:** a side panel with every event in plain words: "Speedy Otter 27 hit a black hole and fell from 64 to 22." Read aloud by screen readers through a live region.

## 3. Boards and modes

| Board | Size | Feel | Default extras |
|---|---|---|---|
| **Inner Solar System** | 100 | Gentle: short black holes, more wormholes, mostly helpful stars, no hinder stars | No cosmic events |
| **Nebula** | 100 | Medium: balanced, gates and the mystery station | No cosmic events |
| **Deep Space** | 100 | Chaotic: long wormholes and black holes, comet, pulsar, supernova | Cosmic events on |
| **Asteroid Belt** (quick game) | 50 | Short lessons | No cosmic events |
| **Random Galaxy** | 100 or 50 | Made by a generator with fairness rules | Your choice |

Starting numbers for a 100-square board (tuned in 9.1): 8 wormholes, 8 black holes, 10 star squares, 4 gravity squares, 1 pair of gates, 1 mystery station, 1 comet. The quick board has about half.

**Random Galaxy fairness rules:** no black hole on squares 1–5 or ending below square 2; no wormhole exit landing on a black hole's mouth (or the reverse); nothing on 100; at least 2 squares between special squares; wormholes and black holes roughly balanced in total distance; every board the generator makes is checked by the simulation in the tests.

**Galaxy codes (new, my idea):** instead of a number, a Random Galaxy's seed is shown as three easy words, like **Comet-Kiwi-48**. A class can type it in to all play the same galaxy. There's also a **Galaxy of the day**: everyone gets the same random galaxy that day.

**Modes:** **Classic** (wormholes and black holes only: no items, stars or hinders) and **Cosmic** (everything). The settings screen has these, the board, finishing rule, roll-again-on-6, cosmic events and speed. Sensible defaults: Cosmic, Nebula, any roll wins.

**Mission Control maths** (off by default, built last): the engine has a "question" pause built in from the start. When it's built, landing at a wormhole's mouth can offer a quick Year 4–6 maths question to power it up further. Not built until you say so.

## 4. Single player (against bots)

- 1 student vs 1–3 bots: **Cadet** (Very Easy), **Pilot** (Easy), **Commander** (Medium). All bots in a game share one level, to keep the setup screen simple.
- Dice are luck, so bot skill is all in decisions. Cadet uses items at random. Pilot uses them sensibly. Commander saves Force Fields, targets the leader, takes good gates and cards, and keeps Navigator for the finish.
- Bots "think" for about a second, and their decisions run in a Web Worker so the page never freezes. The decision code lives in `shared/space/` because the server also needs it (for autopilot, section 5).
- **Saving and checking:** when the game starts, the page asks the server for a dice seed. The server stamps it with a secret signature (made from the server's own key, so nothing new for you to set up). The game plays in the browser from that seed. At the end the browser sends the seed, the stamp and every decision. The server checks the stamp and replays the whole game. Wrong stamp, or a replay that doesn't match? Not saved.
  - *Couldn't a student peek at the seed and predict the dice?* With developer tools and a lot of effort, yes. That's why I recommend points don't depend on winning (section 7): there's nothing to gain from cheating.
  - *No Wi-Fi at the start?* The game still plays. It just says "Practice game: this one won't be saved".
  - Sending a save twice is safe. Stage 8's "same game sent twice is saved once" check already covers it, because each seed is unique.
- **Pass-and-play** (2–4 students sharing one Chromebook): easy to add, because it's the same engine with no server needed during play. I'd make it the optional last stage, and it would **never earn points** (the other students aren't signed in). Your call.

## 5. Playing classmates (2–4 players)

### A new table, not a bigger `mp_games`: why

| | Stretch `mp_games` to 4 players | **New `space_games` table** (my choice) |
|---|---|---|
| Risk to chess and checkers | High: scoring, the tidy-up job, the lobby, stats and the rematch code all assume two players taking turns | **None**: their table and code stay exactly as they are |
| Work | Change lots of tested Stage 6–7 code | New code, using the same patterns |
| Lobby | One list | The lobby page shows two lists merged into one |
| Codes | One set | Codes are checked against both tables so they never clash |

### How a game runs

1. **Start:** a student taps **Play friends → Wormholes & Black Holes → Start game**, picks the board and mode, and gets a 5-character code (same code letters as now), with an optional lobby listing.
2. **Join:** classmates type the code or tap **Join** in the lobby. Same rules as now: one waiting game each, waiting games expire after 10 minutes, you can't join your own. The **Join a game** box works for any game: it asks the chess/checkers function first and, if that says "not found", the space function.
3. **Launch:** the host sees everyone who's joined and presses **🚀 Launch** once there are at least 2 (up to 4). The server shuffles the turn order.
4. **Each turn:** the browser asks; the server checks it's that player's turn, rolls with secure randomness, runs the shared rules engine, and saves the new state **only if the version hasn't changed** (no double rolls from double taps). It also saves the list of events. Every player's screen gets the change through Realtime and animates the events in order.
5. **Choices** (gate, mystery card, item target, full inventory) are separate small requests, each with a timer.
6. **The end:** places for everyone, a podium, and **Rematch**. The first to press Rematch becomes host of a new waiting game linked to the old one. Everyone else's Rematch joins it, and the host launches. That reuses the normal launch flow and works however many want to play again.

### Timeouts (dice games need different rules from chess)

| Situation | What happens |
|---|---|
| Your turn and you don't act for **30 seconds** (plus a few seconds of animation time, worked out by the server) | The server rolls for you, with no item used. A ring timer shows round your rocket for the last 10 seconds |
| A choice isn't made in **15 seconds** | Stay (gates), card 1 (mystery), keep your items (full inventory), item not used (no target) |
| **3 timed-out turns in a row** | **Autopilot** (a Pilot-level bot) flies your rocket, so the game goes on for everyone. The game is recorded as **abandoned for you** (no points for you). If you come back, you can tap **Take the controls** and keep playing for fun, but it stays abandoned for you |
| Hidden by the teacher mid-game | Autopilot straight away |
| Everyone left (no action for **10 minutes**) | The tidy-up job ends it with no points for anyone |
| Host doesn't launch within 10 minutes | The waiting game expires, as now |

**Who presses the "time's up" button?** Server functions can't wake themselves up, and the database's scheduled job can't run the rules engine. So when the server's clock says time's up, the waiting players' pages send a "time's up" request. The next player in turn order asks first, the others a few seconds later only if needed. The server checks the clock itself, so a page can't hurry anyone. The 5-minute tidy-up job is the backstop for games where everyone's gone.

Autopilot turns are played by the server **inside the request that hands them the turn**, so they cost no extra function calls.

### Safety, same as chess and checkers

- No chat and no free text. Names, avatars and (if the teacher switches them on) a few fixed emoji reactions only.
- The server works out who's asking from their sign-in token, never from the request. Players can read only games they're in.
- Hidden students can't start or join. The teacher's pause switch stops starting, joining, launching and rolling, but leaving still works. Same as now.
- Rate limits like now: 20 games started an hour, 10 code tries a minute, 60 requests a minute.

### Emoji reactions (James chose these, with a teacher switch)

- **Off until a teacher switches them on**, with a new switch on the Teacher page next to "games against friends": *Emoji reactions in space games*.
- **A fixed set of 6:** 🚀 👏 😮 🎉 😂 👍. No other emoji, no text. The website only shows buttons for these, and the server refuses anything else.
- **They go through the server, not straight between browsers.** A reaction is a request to the `space-game` function, which checks the switch, that you're in the game and not hidden, and the limits. It then puts the reaction on the game row, so every player sees it through the same live update as the moves. The "who's here" channel stays presence only, so Stage 8's "no hidden chat" fix still holds and its test still passes.
- **Limits:** one reaction every 5 seconds each, and at most 20 per player per game.
- The reaction pops up over the sender's rocket for 2 seconds and is **not** kept in the mission log or anywhere else.
- **Each student can hide reactions** on their own screen (a 🙈 button). That's remembered on the device.
- Hidden students can't send them. Bots never send them.
- Cost: each reaction is one function call. At 20 per player per game, the worst case adds about 80 calls to a 4-player game, so still well inside the free plan (section 9).

## 6. Look, feel and accessibility

- Everything drawn with SVG and CSS: starfield, planets, nebulae, rockets, holes and stars. No images, fonts or downloads from anywhere else.
- **Each rocket wears its player's avatar** in the window (the existing `AvatarImage`), with a coloured trail and a seat shape (circle, triangle, square, diamond), so rockets are never told apart by colour alone.
- Animations play the server's event list step by step: dice tumble → rocket hops square by square → wormhole swirl / black hole spaghetti → star sparkle → item card flips in. Short steps, plus the speed setting.
- `prefers-reduced-motion` and an in-game **Less motion** switch: hops become slides, swirls become fades.
- Sound uses the existing sound module (made in the browser, no files), **off by default**: a few new tones for rolls, wormholes, black holes and items.
- **Keyboard:** Space or Enter rolls, number keys pick items, arrow keys pick targets and cards, Escape closes panels. Big tap targets everywhere. Every event announced through an `aria-live` region.
- **Sizes:** Chromebook (1366×768): board on the left, players, items and mission log on the right. Tablet portrait (768×1024): board on top, panels below. Tested in a real browser at both, with mouse, touch and keyboard.
- **How to play** screen: a picture of every square and item with one line each. Opens from the game and the settings screen.
- **Space facts:** short, accurate, Year 4–6 reading level, one per star type (and some for planets on the decorations), checked against NASA or similar sources.

## 7. Points (decided: taking part only)

**Participation points only** (James, 15 Oct 2026), so winning a luck game is never worth cheating for, and so playing a full game with classmates is what's rewarded.

| Space game | Points (win or lose) | Limit |
|---|---|---|
| Against bots, finished | **2** | Shares the existing 40-points-a-day bot cap with chess and checkers |
| Against classmates, finished | **4** | First 6 a day earn points (more still show in your history) |
| Quit, autopilot, or under 5 turns | 0 | Same as "abandoned" now (5, not 10: see section 15) |
| Classmates game with bots in some seats | 4 | Only if at least 2 students played it |

- **Never:** ratings, rank badges, leaderboards or "most improved". The Leaderboard page doesn't show a space tab.
- **A few one-off space achievements** (10 points each, the same as other achievements): 🚀 First launch · 🛰️ Finish a game with classmates · 🌀 Ride 25 wormholes · 🛡️ Block a black hole with a Force Field · ⭐ Land on every kind of star · 🏁 Dock at the station 10 times. These show on the Profile page next to chess and checkers.
- The **How points work** page gets a short space section, read from the database like the rest, so it never disagrees with it.
- **Teacher view:** each student's detail shows space games played too. **New season** and **Delete student** clear space games as well (tested).

## 8. How it's built (the technical part)

### Rules engine (`shared/space/`)

- `engine.ts`: `play(state, action, dice) → { state, events }`. A pure function: no clock, no network, no `Math.random`. The dice come in from outside: a seeded generator in bot games, secure randomness on the server, a fixed list in tests.
- `boards.ts` (the four designed boards), `galaxy.ts` (the Random Galaxy generator and galaxy codes), `items.ts`, `bot.ts` (Cadet/Pilot/Commander decisions), `facts.ts`, `replay.ts` (replays a saved game for the server).
- Events are plain data like `{ kind: 'black-hole', seat: 2, from: 64, to: 22 }`. The screen animates them and the mission log turns them into words. The screen **never works out results itself**.
- `scripts/space-sim.mjs`: plays tens of thousands of bot games per board, mode and player count. It reports average and longest game (turns, rounds, estimated minutes), how often each square and item fires, win rate by turn order, how often the last-place rocket comes back, how often the mission clock or chain cap is hit, and checks no game ever loops. Its summary goes into this plan after 9.1.

### Database (one new migration, applied only after you say yes)

- `bot_games`, `scored_games`, `achievement_types`: allow `'space'` (not `ratings`).
- **`space_games`** (one row per classmates game): code, lobby flag, host, `seat1`–`seat4` (each a player, and if a student is deleted that seat becomes empty and the game stays for the others, like `mp_games`), status, settings (board, mode, galaxy code, options), the current state (positions, items, effects, comet, mines, round, whose turn, any choice waiting, autopilot seats), `version`, `turn_deadline`, the last turn's events, places and `counts_for_points` per seat, rematch link. Kept small (a few KB), because every change is sent to every player.
- **`space_game_log`** (one row per action: who, what, the dice and the events): the mission log and the record the server can replay. Players can read only their own games' logs. Not sent live; pages read it when they open a game and add new events as they arrive.
- Row level security on both, readable only by the game's players, writable by nobody but the server. Realtime switched on for `space_games` only.
- The presence-only "who's here" rule is extended to `space-game:<id>` channels (still presence only, still tested).
- Small read-only functions: `space_lobby_games()`, `my_space_game_stats()`. Server-only: player status (reuses `mp_player_status`), `space_tidy()` on a new 5-minute scheduled job.
- Scoring: a trigger on `space_games` (when a game finishes) and the existing `bot_games` trigger, with a separate `score_space_game` path. **The chess and checkers scoring functions stay as they are.**
- `app_settings` gets `space_reactions_enabled` (false to start), switched by a new teacher-only `teacher_set_space_reactions()`.
- `progress_rules()`, `my_progress()`, `teacher_student_detail()`, `teacher_new_season()`, `teacher_delete_student()`, `rebuild_progress()` updated to include space.
- `security.test.sql` lists updated by hand (new readable tables, new callable functions, the new Realtime table) plus new tests: students can't write to the new tables, can't read others' games, can't call server-only functions, can't send messages on the space channel.

### Server functions

- **New `space-game` function:** `solo-start` (hands out a stamped seed), `create`, `join`, `cancel`, `launch`, `use-item`, `roll`, `choose`, `times-up`, `take-controls`, `leave`, `rematch`, `react`. Same structure as `multiplayer`: a testable `handler.ts`, a thin `entry.ts`, built into `index.ts` by `npm run build:functions`. Same 64 KB body limit, CORS answer remembered for 2 hours, and friendly error messages.
- **`save-bot-game`:** accepts `game: "space"` reports and replays them. Chess and checkers reports are handled exactly as now (their tests run unchanged).
- **`multiplayer`:** not changed.

### Website

- `src/games/space/`: board, rockets, dice, panels, settings, How to play, bot Web Worker, sounds. Registered with one line in `registry.ts`, with `ranked: false`.
- `src/space/useSpaceGame.ts`: keeps a classmates game up to date, using the same approach as `useFriendGame`: live updates, checking every few seconds if they drop, reload-safe, the "away" signal, and the Stage 8 retry. Chess and checkers keep their own hook, unchanged.
- The Lobby page shows space games in the same list, with how many seats are filled ("2 of 4").

## 9. Free-tier cost

Estimates now; the simulation in 9.1 will firm them up.

| | Per game | A class (30 students, 3 lessons a week, ~3 space games a lesson in groups of 4) |
|---|---|---|
| Function calls, classmates | ~75 turns × about 1.5 requests (item, roll, choice), plus ~10 to start, join, launch and finish: **~120** | ~70 games a week × 120 ≈ 8,500 a week, **~35,000 a month** |
| Function calls, bots | **2** (seed + save) | small |
| Realtime messages | each change to up to 4 players: ~500 | ~35,000 a week, ~150,000 a month, against 2 million |
| Data sent out (egress) | a few KB per change × 4 players: ~1.5 MB | ~0.5 GB a month, against 5 GB. **This is the one to watch.** It's why the mission log lives in its own table and isn't sent live |
| Database | a few KB per game plus its log | well under 50 MB a year, against 500 MB. New season clears it |
| Live connections | 1 per open tab, same as now | unchanged |

Together with chess and checkers (~70,000 calls a month at the same class size), that's about 105,000 of 500,000 function calls. The real classroom limit is still sign-in (Stage 8 notes), not this game.

## 10. Stages

Each stage ends with `npm run check` passing, a browser test where there's something to see, and a short report to you.

1. **9.1 Rules engine, boards, simulation, tests.** No screens yet. I report the simulation numbers (game length, fairness, how often each thing happens) and the tuned settings, so you can say "too long" or "too mean" before anything is drawn.
2. **9.2 Playing against bots** (board, rockets, animations, items, settings, keyboard), not saved yet. Full games played in a real browser at Chromebook and tablet sizes. **Preview:** I'll put this stage on a private claude.ai page that James can open on a phone and actually play (no sign-in, no saving, nothing to do with the live site).
3. **9.3 Saving bot games and points:** `save-bot-game` replays space games, the migration's points/achievements part, the Profile, How points work and teacher detail updates.
4. **9.4 Playing classmates:** `space_games`, the `space-game` function, lobby, launch, timers, autopilot, bots in empty seats, rematch, emoji reactions and their teacher switch. Played with 2, 3 and 4 local accounts in separate browser windows, with reloads and a closed lid part-way.
5. **9.5 Polish:** cosmic events, How to play, space facts, sounds, an accessibility pass, README and CLASS-LAUNCH updates.
6. **9.6 Pass-and-play** (James said yes), then Mission Control maths only if James wants it.

**Going live:** Stage 8 is now deployed and merged (15 Oct 2026). When Stage 9 is ready, I'll tell you exactly what the migration and the new function change, and wait for your yes, the same as Stage 8. Nothing goes live and nothing goes into `main` before that.

## 11. Decisions (James, 15 October 2026)

| Question | Decision |
|---|---|
| Name | **Wormholes & Black Holes** |
| Most players in a classmates game | **4** |
| Pass-and-play | **Yes**, built last (Stage 9.6), never earns points |
| Finishing | **Any roll that reaches 100 wins**; "exact roll" is a setting |
| Points | **Taking part only** (section 7) |
| Emoji reactions | **Yes, with a teacher switch, off to start** (section 5, "Emoji reactions"). This is the one change from my recommendation |
| Bots in empty seats | **Yes**; counts only with at least 2 students |
| Mission clock | **Yes**, about 40 rounds, tuned in 9.1 |
| Matariki square | **Use the wording as written** in section 2 |
| Phone preview after 9.2 | **Yes** |

## 12. Fun extras I've included (within the hub's rules)

- **Podium** with every rocket's place, not just the winner.
- **Galaxy codes** (Comet-Kiwi-48) and a **Galaxy of the day**, so a class can all play the same galaxy.
- **Mission clock** with a fuel gauge, so the end is exciting rather than dragging.
- **Rockets wear your avatar**, with a trail and a seat shape.
- **Star chart:** every space fact you've discovered is collected on a page. Kept on that device only, not in the database.
- **Space achievements** (section 7).
- **Autopilot** keeps the game going for everyone when someone's Chromebook dies.

## 13. What I need from you now

Nothing for now. James said the 9.1 numbers sound good (15 Oct 2026), so the tuning stays as it is. Next is 9.2.

## 14. Simulation results (Stage 9.1, 15 October 2026)

`npm run space:sim -- --games 5000` played 5,000 bot games (Pilots) for every board, mode (Cosmic and Classic) and number of rockets (2, 3, 4): about 330,000 games. Every game ended. No game ever looped, the safety stop was never reached, and the bots never sent a move the rules refused.

**Minutes are a guess:** about 6 seconds a turn for tapping, the dice and the hops, plus a bit more for each square that acts, each choice and each item. Real classes may be slower.

### How long a game lasts (Cosmic mode, the default)

| Board | 2 rockets | 3 rockets | 4 rockets | Longest of 5,000 (4 rockets) |
|---|---|---|---|---|
| Inner Solar System (gentle) | 18 rounds, ~4 min | 16 rounds, ~5 min | 16 rounds, ~7 min | 28 rounds |
| Nebula (medium, the default) | 18 rounds, ~4 min | 16 rounds, ~5 min | 15 rounds, ~6½ min | 37 rounds |
| Deep Space (chaotic) | 17 rounds, ~4 min | 15 rounds, ~5 min | 13 rounds, ~6 min | 38 rounds |
| Asteroid Belt (quick, 50 squares) | 11 rounds, ~2½ min | 10 rounds, ~3 min | 10 rounds, ~4 min | 18 rounds |
| Random Galaxy, 100 squares (3 tried) | 18–23 rounds, 4–5 min | 16–20 rounds, 5–7 min | 15–19 rounds, 6½–8½ min | 40 rounds |
| Random Galaxy, 50 squares (2 tried) | 11–12 rounds, ~2½ min | 10–11 rounds, ~3½ min | 10 rounds, ~4½ min | 22 rounds |

Classic mode is about 10–40% longer (most on Deep Space) (4 rockets: 17–19 rounds, ~7–8 min on the big boards). 1 game in 20 takes about 1½ times the average.

**Against the target** (8–15 min on the big board, 3–6 on the quick one): the quick board is on target. Big-board games come out a bit shorter, about 6–8 minutes for 4 rockets and 4–5 for 2. I've left them like that because the minutes are a guess and a short game is easier in a lesson. If you'd like longer games, the easy fix is more or longer black holes.

### Fairness

- **Going first:** in a 4-rocket game the first rocket wins 25–29% of games (25% would be perfectly fair); with 2 rockets, 50–54%. That's normal for a race game. Classmates games shuffle the turn order, and bot games take it from the seed.
- **Coming back:** the rocket in last place at halfway goes on to win 5–16% of 4-rocket games. Catch-up help makes this a bit more likely in Cosmic than in Classic (Nebula: 16% against 13%).
- **Bot levels:** in a 4-rocket game the Commander wins 27–29% and the Cadet 17–25% (usually about 21%), with Pilots in between. It's mostly luck, as it should be, but better choices do help.
- **The mission clock** almost never ends a game: 0% in most setups, at most 1.4% (Deep Space, Classic, 2 rockets).
- **The chain cap** (3 squares a move) stops a chain in about 1% of Deep Space games and up to 4% on one of the Random Galaxies tried. It never happens on the other designed boards.

### How often things happen (Nebula, Cosmic, 4 rockets, per game)

About 5 wormhole rides, 3½ black holes (and nearly 1 more blocked by a Force Field), 6 items from stars, under 1 gate or mystery-station visit, and 2 heavy-gravity hits. Hinders used per game: Tractor Beam 0.5, Space Mine 0.4, Quantum Swap 0.3, Gravity Anchor 0.2. Rescue Beacons: about 2½ a game (3½ on Deep Space).

### What I changed because of the simulation

1. **Gate pairs are now 8–20 squares apart** (5–12 on the quick board). At first a pair went from the bottom half to the top half, which made it a giant free wormhole: Cosmic games on gate boards were about twice as fast as Classic. Now Cosmic and Classic are about the same length.
2. **Rescue Beacons go only to the rocket in last place** (still 30+ squares behind the leader), at most **once every 8 rounds** (the plan said 5). At first rockets were getting nearly 4 a game.
3. **The mission clock counts rounds for 4 rockets**: 40 rounds (45 on Deep Space, 25 on the quick board), plus 5 more rounds for each empty seat, because rounds with fewer rockets go faster. A 2-rocket Nebula game gets 50.
4. **Random Galaxy boards are checked for length** as they're made: one rocket must need about the same number of rolls on average as on the designed boards (26–38 on 100 squares, 13–18 on 50). Without that, random boards ranged from very short to twice as long.
5. **"At least 2 squares between special squares" became "never side by side"**: a 100-square board has about 33 special squares, and with 2 squares between each they wouldn't fit.

### Rule details the engine settled (not in the plan)

- Squares act when **your own** rocket lands on them, including after a Warp Key, a Rescue Beacon, a mine, a supernova or the mystery station. Being pushed by someone else (Tractor Beam, pulsar, supernova, Quantum Swap) never sets off the square you land on.
- **Matariki:** everyone with room gets an item. If your own pockets are full, you get the usual swap choice. If someone else's are full, they miss out (no one else gets a pop-up on your turn).
- **Mystery station:** the card you pick takes you +3, +5, +8 or +12, or −3 or −6 squares (forward is more likely). It's drawn after you pick.
- **Binary star:** on timeout you get the higher die. With a Navigator, the binary star waits for your next turn.
- **Order of roll changes:** Navigator picks the number, then doubles (Hyperdrive, slingshot), then halves rounded up (heavy gravity, Gravity Anchor), then pluses (Booster, low gravity, solar wind). Never less than 1.
- **The designed boards are fixed data now.** They were drafted by the generator and tuned with the simulation. Then I changed a few stars by hand so each board has Matariki, a blue giant and the stars that suit its feel (Deep Space got its supernova). Changing the generator later can't change them.

### Code (Stage 9.1)

`shared/space/`: `engine.ts` (rules), `board.ts` (board shape and fairness rules), `boards.ts` (the four boards), `galaxy.ts` (Random Galaxy and galaxy codes), `items.ts`, `bot.ts` (Cadet, Pilot, Commander), `replay.ts` (bot games from a seed, and the server's replay check), `random.ts` (seeded dice), `sim.ts`. Run the simulation with `npm run space:sim` (add `-- --games 20000`, `-- --board nebula` or `-- --json`). Space facts (`facts.ts`) move to 9.5, where they're written and checked.

## 15. Stage 9.3 results: saving and points (15 October 2026)

Built on branch `stage-9`. **Nothing is live yet**: the new migration and the updated `save-bot-game` function go live with the rest of Stage 9, after James says yes.

### How a bot game is saved

1. When the student presses **Launch**, the page asks `save-bot-game` for a seed (`{ game: "space", start: true }`). The server makes a fresh one (`s1-<time>-<random>`) and stamps it: an HMAC of the seed and the student's ID, with a key made from the server's own key. Nothing new to set up.
2. The game plays in the browser from that seed, exactly as in 9.2.
3. The moment the rules say the game is over, the page sends the seed, the stamp, the settings and the student's actions (short text like `roll`, `choose:1`, `use:tractor-beam@2`). The server checks the stamp is its own and for this student, that the seed is less than 12 hours old, and replays the whole game (10–30 ms). Then it saves the place it worked out itself.
4. A student who leaves part-way (Settings, New game, closing the tab) after doing something gets the game recorded as **left early**, earning nothing, like chess.
5. No seed within 5 seconds (no Wi-Fi)? It's a **practice game**, and the page says so in the mission log and on the podium.

### Changes from the plan

- **The seed comes from `save-bot-game`, not a new `space-game` function.** Bot games then need only the one function, as chess and checkers do, and `space-game` (9.4) is only for classmates games.
- **A game counts after 5 turns, not 10.** A quick-board game is only about 10 rounds, so "10 turns" would have left about half of them earning nothing.
- **Each seed is saved once** (a unique index), instead of chess's "same moves" check: two space games can have the same actions (just rolling) but never the same seed.
- **Won** means 1st place (ties too); every other place is **lost**. The website shows the place ("2nd"), never "Lost", for space games.

### Database (migration `20261015000600_space_points.sql`)

- `bot_games`, `scored_games`, `achievement_types` allow `space`. `ratings` doesn't. `bot_games.space` keeps the seed, board, settings, place and what the student did; `scored_games.space` keeps the counts the achievements use.
- `record_space_bot_game()`: server only, school lock, once per seed, the same 300-a-day flood limit.
- `score_bot_game()`: space games earn `space_bot_points()` = 2, inside the shared 40-a-day bot cap. Chess and checkers points are unchanged.
- Six achievements: First launch, Finish a game with classmates (0 until 9.4), Ride 25 wormholes, Block a black hole with a Force Field, Land on every kind of star (9), Dock at the station 10 times.
- `progress_rules()` has a `space` part (2, 4, 6 a day, 5 turns), read by **How points work**. `teacher_student_detail()` has a space line (no badge).
- New season and deleting a student already clear space games (tested).

### Website

- **Podium:** "Saved! You earned points for taking part." (or "too short", the server's error, or "Practice game").
- **Dashboard:** space games in Recent games with their place and "+2"; a "🚀 Wormholes & Black Holes: 3 games, 1st place 1 time" line under My stats.
- **How points work:** a space section. **Profile:** the six space achievements. **Teacher:** space games in a student's detail and recent games.

### Checked

- 33 new database tests (`space_points.test.sql`) and one more security test; all 303 database tests pass, also after rebuilding the local database from scratch.
- 10 new server tests: seeds, a full game replayed and saved, left-early, forged stamps, other students' seeds, old seeds, changed games and settings, Random Galaxy boards, the daily limit.
- 3 new screen tests: saving, practice games, leaving part-way.
- In a real browser against the local database and the real function: 5 whole games at Chromebook and tablet sizes (designed board and a Random Galaxy, exact finish, roll again on 6, cosmic events), each saved once with 2 points; a closed tab saved as left early with 0; no Wi-Fi gave a practice game; First launch and Force Field achievements earned. No page errors.

## 16. Stage 9.4 results: playing classmates (15 October 2026)

Built on branch `stage-9`. **Nothing is live yet**: migration `20261015000700_space_classmates.sql` and the new `space-game` function go live with the rest of Stage 9, after James says yes. `multiplayer` and `save-bot-game` don't change (their built files are identical).

### How it works

- **Lobby:** "Start a game" has Wormholes & Black Holes (2–4 players) next to chess and checkers, with a board (the four designed boards or Galaxy of the day) and Cosmic/Classic. Other settings come from the student's saved bot-game settings. Open space games show "Nebula, Cosmic. 2 of 4 joined". The **Join with a code** box asks chess/checkers first, then space.
- **Waiting room** (`/#/space-game/<id>`): the code, four seats, and for the host **Fill empty seats with bots?** (0 to the empty seats; bots are Pilots) and **🚀 Launch!** (needs 2 students). Others see "Waiting for … to launch" and **Leave**.
- **Playing:** the same board, animations and panels as the bot game (shared code now: `useEventPlayer.ts`, `parts.tsx`). The server rolls; each change arrives live with its events. A missed stretch (reload, closed lid) is read back from `space_game_log` and played, or the board jumps if more than 8 changes were missed. The mission log is refilled from the log after a reload.
- **Timers:** 30 s a turn, 15 s a choice, plus animation time (up to 25 s). A ring timer shows the last 10 s. Pages send "time's up" (the next student 0.5 s after the deadline, others 3 s apart, the slow student's own page last); the server checks its own clock.
- **Autopilot:** 3 timed-out turns in a row, leaving, being hidden by the teacher or deleted. The student can **Take the controls** back; it still counts as left for them. If every student has left, the game stops (no points). The tidy-up job ends games with nothing happening for 10 minutes.
- **Rematch:** the first to press it hosts a new waiting game with the same board; everyone else's button says **Join the rematch**.
- **Reactions:** teacher switch "Emoji reactions in space games" (off to start). 6 emoji, one every 5 s, 20 a game, on the game row via `space_add_reaction()` (doesn't move the version, so it never blocks a move). Pops over the sender's rocket for 2 s; 🙈 hides them on that device.
- **Points:** 4 per finished game for each student who stayed with 5+ turns, if at least 2 students stayed; first 6 a day. Never ratings. Shows on Dashboard (Recent games "with classmates", the space stats line, "still going"), Teacher detail (space "Friends" row and recent), and achievements ("Finish a game with classmates" now works).

### Changes from the plan

- One log row per server request (not per action): it holds every action in it, including bots and autopilot.
- Bots in a classmates game are always Pilots, and the host can only add them at launch.
- Hidden or deleted students are put on autopilot the next time anyone in the game acts (the request that notices says "the game changed", and the page looks again).
- Codes: a new space code is checked against waiting chess/checkers codes. The chess/checkers function doesn't check space codes (unchanged), so a clash is possible but about 1 in 5 million per waiting game.

### Checked

- Unit: 12 shared tests (`live.test.ts`), 23 server tests (`space-game/handler.test.ts`), 8 screen tests (`SpaceLive.test.tsx`), 5 more lobby tests. All 451 pass.
- Database: 51 new tests (`space_classmates.test.sql`) and 7 more security tests. All 361 pass.
- Real browser against the local database and function, at 1366×768 and 768×1024 (mouse and touch): 2 students with a reload part-way (57 s, both +4); 3 students + 1 bot on Nebula, where one closed the lid, timed out 3 times, went on autopilot, came back and took the controls (others +4, her 0); 4 students with reactions on (bubbles seen), then a rematch everyone joined, launched and left (ended "everyone left", no points). Lobby, Dashboard and Teacher pages checked. No page errors.

## 17. Stage 9.5 results: polish (15 October 2026)

Built on branch `stage-9`. Website only: no database or server changes, so nothing new to put live beyond Stage 9.3 and 9.4.

### What's new

- **How to play** (`Guide.tsx`): a pop-up with a picture and one line for every square, star, gravity square and item, the catch-up and fair-play rules, Classic vs Cosmic, and the keys. Opens from the settings screen, the game (button or the `?` key) and the waiting room. Focus stays inside it, Escape or ✕ closes it, and focus goes back to the button. While it's open, the game's keys (Space to roll...) do nothing.
- **Space facts** (`shared/space/facts.ts`): 19 facts, one per star type plus Earth, the space station, wormholes, black holes, comets, nebulae, asteroids and the three gravity squares. Year 4–6 wording, checked against NASA, ESA and Te Ara. A fact card pops up the first time your own rocket lands on that kind of square, and tapping a square on the board shows its fact too.
- **Star chart** (second tab of the same pop-up): every fact you've found ("You've found 7 of 19"), the rest shown as locked. Kept on the device only (`starChart.ts`, localStorage), not in the database.
- **Cosmic events:** a full-width banner with an emoji, a title and one line ("🌀 Wormhole shift! The wormhole on 9 now goes to 32."), held a little longer so it can be read, plus the mission log line.
- **Sounds** (still off until the student turns them on): dice rattle, a soft hop per square, wormhole whoosh up, black hole slide down, item chime, zap (aimed items), shield, and a three-note cosmic event chord. All made in the browser, no files.
- **Accessibility:** the game pages have a heading for screen readers, cosmic event banners are announced once, through the mission log (the banner itself is hidden from screen readers), and the fact card is a labelled note ("Space fact: Neutron star"), and every new button works with the keyboard.
- **README** has a Wormholes & Black Holes section (boards, modes, points, classmates games, teacher switches, why it can't be faked), and **CLASS-LAUNCH** has a space game check for the day before, a space lesson plan, what to watch for, the new messages a student might see, space games in the lookup query, and a box on the problem slip.

### Checked

- Unit: new tests for the facts (every star has one, none repeat, at most 3 sentences each), the Star chart, the square info text, and How to play / Star chart / `?` in the game. All 461 pass. Typecheck clean.
- Real browser on the stand-alone preview at 1366×768 (mouse) and 768×1024 (touch), Deep Space with cosmic events and sound on, played to the end: axe accessibility scan clean on settings, How to play, Star chart, game and podium at both sizes; focus trapped in the pop-up and returned on close; `?` opens help and Space behind it doesn't roll; all three cosmic events seen; fact cards shown and saved to the Star chart. No page errors.
- Real browser against the local database and function: 2 students (with a reload part-way) and 4 students with reactions, then a rematch everyone left. Waiting-room How to play opens and closes, axe clean, both +4 points, no page errors.
- The CLASS-LAUNCH lookup query runs on the database.

## 18. Stage 9.6 results: pass-and-play (16 October 2026)

Website only: no database or server changes.

- **Settings:** a new **Who's playing** choice: **Me vs bots** or **Pass-and-play**. Pass-and-play swaps the bot choices for **Players** (2, 3 or 4) and a name box for each (14 letters at most; blank means the student's own name for player 1 and "Player 2" and so on for the rest). The first name goes first. Names and choices are remembered on the device only.
- **Playing:** every rocket is a person, so whoever's turn it is gets the Roll button, their own items (keys 1–3 still work) and the status line by name ("Mia's turn! Roll the dice."). Fact cards pop up for whoever landed. No bots, no worker, no server.
- **Never saved, never points:** no seed is asked for, nothing is sent at the end or when leaving part-way, the mission log says "Pass-and-play: not saved", and the podium says "Mia docked first!" with "Pass-and-play games aren't saved."
- **Code:** `startPassRun` in `soloRun.ts` (a `passAndPlay` run where every seat is a person), `passNames` in `prefs.ts`, a `heading` on the podium. The bot game is unchanged.

### Checked

- Unit: a whole 4-person game in the engine (everyone moves, no bot turns) and a whole 4-person game on the page (names, turns, podium, nothing saved or recorded as left, choices remembered). All 463 pass. Typecheck clean.
- Real browser on the stand-alone preview: 4 players at 1366×768 (mouse and Space key) and 2 at 768×1024 (touch), both played to the podium. axe clean on settings, mid-game and podium. No page errors.


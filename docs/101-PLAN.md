# 101: plan

Stage 10 of School Games Hub: James's family card game, against bots or 2–4 classmates.
Written 16 October 2026 from the brief in [prompts/game-101.md](prompts/game-101.md), after reading the code on `main` (Stages 1–9 live).
**Status: rule questions answered by James on 16 October 2026 (section 12); agreed rules in [101-RULES.md](101-RULES.md). Stage 10.1 done 16 October 2026 (results in section 13). Next: 10.2, playing bots on screen.**

Where this plan and the brief disagree, this plan wins once James approves it.

## The short version

- **A new game card on the dashboard**, added with one line in `src/games/registry.ts`. Chess, checkers and the space game don't change.
- **One rules engine in `shared/card101/`** runs the whole game, in the browser, the bots and the server. Give it the same shuffled deck and the same choices, and it always gives the same result.
- **The big new idea is hidden cards.** Every player gets their own **view** of the game, made on the server by one small function, `viewFor(game, seat)`. A view holds only what that player is allowed to know. Browsers only ever receive views, never the whole game.
- **Against bots:** played in the student's browser from a stamped seed (exactly how the space game does it). The server replays the whole game before saving it. Bots are only ever handed their own view, so they can't cheat.
- **Against classmates (2–4 players):** two **new tables** and a **new server function**, `card-game`. The server shuffles with proper secure randomness, deals, and referees every move. `mp_games` and `space_games` aren't touched.
- **Points:** small points, never ratings, badges or leaderboards (section 6).
- **Cost:** about 230 function calls per classmates game. A class playing it three lessons a week adds roughly 30,000 calls a month, against 500,000 (section 9).

## 1. What the brief says vs what's built now

| Brief says | Now | What I'll do |
|---|---|---|
| Check where Stage 7 is up to | **Done and live** since 15 Oct, and Stages 8 and 9 too | 101 plugs into Stage 7's points and achievements (section 6). Nothing collides |
| Decide: stretch `mp_games` or a new table | The space game (Stage 9) already chose a new table for 2–4 players, and it works live | Same choice, for the same reasons, plus one more: `mp_games` lets each player read the **whole** row, which would leak cards (section 5) |
| Bot games: small, capped points | Bot games share one 40-points-a-day cap | 101 bot games share that cap too |
| Teacher's "games against friends" switch, hidden students | Live | The new function checks both, the same way |
| Presence ("who's here") channel | Stage 8 made it presence only (no hidden chat) | 101 gets the same kind of channel, covered by the same rule and test |
| Card faces from `@letele/playing-cards` | (new) | **Licence checked: CC0 1.0** (public domain), version 0.1.0, last changed August 2023. I'll copy the SVGs in with a NOTICE file, like the chess pieces (section 7) |

## 2. The rules (as written by James)

The agreed rules are in [101-RULES.md](101-RULES.md) (James's answers in section 12), and the in-game **How to play** panel is made from it.

In short: 4 face-down cards in a 2×2 square; peek at your bottom two once; each turn take the top discard or the top of the stack, then swap it in (it goes face up and stays) or throw it away; or knock instead. After a knock everyone else gets one last turn. Lowest hand wins the round; totals add up; the game ends when someone reaches 101 and the lowest total wins. Kings 0, Aces 1, 2 and 4–10 face value, Jacks and Queens 10, a 3 is 0 and cancels your highest card, a pair cancels out, three of a kind makes the whole hand 0.

## 3. Hidden cards: how nothing leaks

This is the most important part of the plan.

### Who may know what

| Card | Who may see it |
|---|---|
| The stack (its order and every card in it) | **Nobody**, ever |
| The top card of the discard pile, and every card thrown on it | Everyone (it's face up) |
| A card you just drew from the stack | **Only you**, while you hold it. Then everyone: thrown away or swapped in, it ends up face up |
| Your bottom two cards | **Only you**, during the peek, then never again |
| Any card swapped into a hand | **Everyone**: it goes in face up and stays put (rule 12, section 12) |
| Your dealt cards still face down | **Nobody**, not even you (you have to remember your peek) |
| Everyone's cards at the end of a round | Everyone (they're turned face up) |

So the memory part of the game is your two peeked cards and what's still face down; everything swapped in is on show.

### How it's enforced

1. **One function makes every view.** `viewFor(game, seat)` in `shared/card101/view.ts` turns the full game into what one seat may know. It's the only way out of the server for card information. Function replies, live updates and the bots all go through it.
2. **The full game sits in a locked table** (`card_games`). Students have no permission to read it at all: no row rules, no table permission, not in Realtime. Only the server function and the database's own scoring code can touch it.
3. **Each player has their own small row** (`card_game_seats`: one row per player per game) holding just their view. The database's row rules let a student read only their own row. When the game changes, the server rewrites every seat's row in one go, so each browser gets its own new view live, through Realtime.
4. **Events are filtered too.** "Speedy Otter drew from the stack" goes to everyone, but the card's name goes only to Speedy Otter while they're holding it. Once it's swapped in (face up) or thrown away, everyone sees it.
5. **The deal happens after the game starts**, and every round's shuffle uses the server's secure random numbers (`crypto.getRandomValues`, with a fair Fisher–Yates shuffle). The browser never shuffles a classmates game. This avoids boardgame.io's known trap (sending the starting hands to everyone).

### Why per-seat rows, not "something changed, come and ask"

The brief suggests a readable "something changed" row, after which each browser asks the server for its view. That works, but every move would then cost one extra server call **per player**. Writing each player's view into their own row costs nothing extra, and it's the same live-update method chess and checkers already use (Realtime only sends a row to people allowed to read it). It's simpler and cheaper, with the same safety: the secret table is never readable.

### The peek

- When a round is dealt, each player's view shows their bottom two cards, with a big **I've remembered them** button and a 15-second countdown.
- The peek ends for you when you press the button or the time runs out. The server then removes the two cards from your view, for good. Asking again, reloading, or rejoining shows nothing.
- If you reload *during* those 15 seconds, you see them again only for what's left of the 15 seconds. That's the same peek, not a second one.
- Play starts when everyone has pressed the button or time is up.

### Bot games (the honest limit)

A bot game runs in the student's browser, so the shuffled deck is in the browser's memory. A student with developer tools and a lot of effort could find it. That's acceptable because bot games earn only small, capped points (as with chess, where a student could secretly use another chess program). Classmates games, which are the competitive ones, are dealt on the server and never leak.

## 4. Single player (against bots)

- The student picks **1–3 bots** and one level for all of them: **Very Easy**, **Easy** or **Medium**.
- **Bots play fair.** A bot is only ever given its own seat's view plus its own memory of what it has seen. It's never given the full game. A test proves this: change every card the bot couldn't have seen, and its choice must not change.
- **How the levels differ:**
  - **Very Easy** forgets things: it keeps a card only if it's low, swaps it into a random spot, and knocks at random after a few turns.
  - **Easy** remembers its own cards, swaps out its highest known card, and knocks when its hand looks low (about 10 or under).
  - **Medium** remembers everything it has seen (its peek, every discard, what others took), works out the chances for its unknown cards, goes for pairs and 3s, and knocks when it's probably lowest.
  - Tests play hundreds of games and check that each level beats the one below it, like the checkers tests.
- Bots "think" for about a second and run in a Web Worker, so the page never freezes.
- **Saving:** when the game starts, the page asks `save-bot-game` for a stamped seed (`{ game: "101", start: true }`), as the space game does. At the end it sends the seed, the stamp and the student's choices. The server replays the whole game (the deal comes from the seed, and the bots' choices are worked out again) and saves only what it worked out itself. No seed (no Wi-Fi)? It's a practice game and says so.

## 5. Playing classmates (2–4 players)

### A new table, not a bigger `mp_games`: why

- `mp_games` is strictly two players, and its scoring, tidy-up job, lobby and rematch all assume that. Changing it risks chess and checkers.
- More importantly, `mp_games` lets each player read the **whole** game row. That's fine for chess, where nothing is secret, but it would hand every player everyone's cards.
- The space game already showed a separate table works well for 2–4 players. 101 copies its patterns (codes, lobby, waiting room, rematch, retry) and adds the hidden-card parts.

### How a game runs

1. **Start:** **Play friends → 101 → Start game**, pick **2, 3 or 4 players** and whether it's listed in the lobby. You get a 5-character code, same letters as now.
2. **Join:** by code or from the lobby. The **Join with a code** box already asks chess/checkers then space; it will ask 101 third. New codes are checked against all three so they don't clash. Same rules as now: one waiting game each, waiting games expire after 10 minutes, you can't join your own or a full one.
3. **Starting:** the game **starts by itself when it's full**. The host can also press **Start** early once at least 2 have joined, so nobody waits forever for a fourth player who isn't coming. The server picks who goes first at random; each later round starts with the next player along (see question 11).
4. **Each turn:** draw (stack or discard) → the server sends the drawn card to you only → you tap one of your four cards to swap, or **Throw away**. Or press **Knock** instead of drawing. Every request is checked: your game, your turn, game not over, move legal, and "save only if nothing changed" (the same `version` check as now), so double taps and out-of-turn moves are refused.
5. **Knock:** a big **Last turn!** banner, and the knocker's cards get a "knocked" badge. Each other player gets one more turn.
6. **End of round:** all cards flip over and the scoring plays step by step for each player (section 7). Totals go up, and the bars showing how close each player is to 101 move. **Next round** deals again after a short pause (or when everyone taps Next).
7. **The end:** a podium with every player's place and total, and **Rematch** (works the same as the space game: the first to press hosts, the others join).

### Someone walks away (the fair, simple rule)

| Situation | What happens |
|---|---|
| Your turn and you don't act for **60 seconds** | Your turn is **skipped**. If you'd drawn a card, it goes on the discard pile. A ring timer shows for the last 10 seconds |
| **3 skipped turns in a row** | You're **out**: your cards leave the table, you don't score any more, and it's a loss that earns nothing |
| You press **Leave** | Same as being out |
| Hidden or deleted by a teacher | Out, the next time anyone in the game acts |
| Only 1 player left | The game ends. That player wins, and it earns points only if at least 2 full rounds were played |
| Nothing happens for 10 minutes | The tidy-up job ends the game with no points for anyone |
| Peek not finished in 15 seconds | The peek just ends (not a skip) |

Nobody has to press a "skip" button. As in the space game, when the server's clock says time's up, the other players' pages send a quiet "time's up" request; the server checks its own clock, so nobody can hurry anyone. The skip happens automatically, which avoids arguments. Draw offers don't apply.

### Reconnecting

Reloading, closing the lid or losing Wi-Fi just means the page reads its own seat row again when it comes back. That row never contains your peek cards after the peek has ended, so rejoining can't show you your cards. Live updates work like chess: Realtime, checking every few seconds if that drops, and the Stage 8 retry.

### Safety, same as everywhere else

- No chat and no free text. Names and avatars only. No emoji reactions in 101 (they could be added later behind a teacher switch, like the space game).
- The server works out who's asking from their sign-in token, never from the request.
- Hidden students can't start or join. The teacher's switch stops starting, joining and playing, but leaving still works.
- Same rate limits: 20 games started an hour, 10 code tries a minute, 60 requests a minute.

## 6. Points (decided: small points, no rating)

**Why no rating or badge:** a rating compares two players: "I beat you, so I take some of your points." 101 can have 4 players, and the cards you're dealt matter a lot, so a rating wouldn't be fair. So 101 never changes ratings, badges, leaderboards or "most improved", like the space game (`ranked: false`).

| 101 game | Points | Limit |
|---|---|---|
| Against bots, lost | Very Easy 1, Easy 2, Medium 3 | Shares the existing 40-a-day bot cap with chess, checkers and space |
| Against bots, won (lowest total) | Very Easy 3, Easy 5, Medium 8 | Same as chess and checkers |
| Against classmates, finished | 4 | First 6 classmates games a day earn points |
| Against classmates, won | 8 | Same |
| Left, out, or **fewer than 2 full rounds** | 0 | "Very short" for 101 means fewer than 2 full rounds |

- Bot games use the same table as chess and checkers because 101 has real skill in it (remembering cards, knowing when to knock), unlike the space game.
- **Achievements** (10 points each, earned on the server from checked games): 🃏 First game · 🏆 First win · 👫 Win against classmates · 0️⃣ Perfect zero (a hand worth 0) · 🎰 Triples! (three of a kind) · ✊ Knock and win the round · 3️⃣ Saved by a 3 (a 3 cancels a 10-point card) · 🔟 10 games finished.
- The **How points work** page gets a 101 section, read from the database like the rest. Teacher detail shows 101 games; **New season** and **Delete student** clear them (tested).

## 7. Look, feel and accessibility

- **Table:** green felt, your 2×2 square big at the bottom, other players' squares round the table with their avatar and name, stack and discard pile in the middle. A glowing ring and "Your turn!" show whose turn it is.
- **Your held card** floats above your square, big, with **Swap** (tap a card) and **Throw away**.
- **Scores always visible:** each player's total and a bar filling towards 101 (green, then amber after 75, then red after 90).
- **End-of-round scoring** (the maths bit): cards flip one player at a time; matching pairs slide together and show "0"; a 3 zaps the highest card ("3 cancels your Queen: 10 → 0"); triples light up the whole hand; then a written sum like **K 0 + 7 + 7 → 0 + 5 = 5**, and the total ticks up. A small celebration for the round winner, a bigger one for a 0 hand. A **Skip** button for students who want to get on.
- **Cards:** Adrian Kennard's CC0 faces copied into `src/games/card101/cards/` with a NOTICE file. Our own card back (hub colours and a big "101"). I'll check them at Chromebook size in 10.2. If the corners are too small to read, I'll draw our own simple, big faces instead (big rank and suit, no fussy pictures). No outside fonts.
- **Colour-blind safe:** suits use shape and the usual red/black; nothing relies on colour alone.
- **Keyboard:** S = take from stack, D = take discard, K = knock, arrow keys move round your four cards, Enter swaps, T throws away, Escape closes panels. Big tap targets. Every event is read out through an `aria-live` region.
- **Accessible names**, for example "Your card, top left, face down", "Discard pile: 7 of hearts", "Speedy Otter's card, bottom right, face down".
- **Sounds** use the existing sound module and mute setting (off by default): a soft flick for drawing, a tap for swapping, a knock-knock, and a little fanfare for a round win.
- **Sizes:** Chromebook 1366×768 (table in the middle, scores on the right) and tablet 768×1024 (table on top, scores below). Tested with mouse, touch and keyboard.

## 8. How it's built (the technical part)

### Rules engine (`shared/card101/`)

- `cards.ts` (the deck, ranks, values), `score.ts` (scoring a hand, returning each step so the screen can show the working), `engine.ts` (`play(game, seat, action) → { game, events }`, pure: no clock, no network, no `Math.random`; the shuffled deck comes in from outside), `view.ts` (`viewFor`), `bot.ts` (the three levels, which take a view and a memory, never the game), `replay.ts` (seed → deck → replays a bot game for the server), `sim.ts` and `scripts/101-sim.mjs` (thousands of bot games to measure game length and check the levels).
- Game id `101` throughout.

### Database (two migrations, applied live only after James says yes)

- **`20261016000800_101_points.sql`:** `bot_games`, `scored_games`, `achievement_types` allow `'101'` (`ratings` doesn't); `bot_games.card101` for the seed and choices; `record_101_bot_game()`; scoring for 101 bot games inside the shared cap; the 8 achievements; updates to `progress_rules()`, `my_progress()`, `teacher_student_detail()`, `rebuild_progress()`.
- **`20261016000900_101_classmates.sql`:** `card_games` (the locked full game: deck, hands, log; no student access at all), `card_game_seats` (one row per player: their view, readable only by them, in Realtime), `card_lobby_games()`, `card_tidy()` on a 5-minute scheduled job, scoring trigger for finished games, `is_player_in` extended for `card-game:` presence channels (still presence only).
- `security.test.sql` lists updated by hand, plus a new `card101.test.sql`.

### Server functions

- **New `card-game` function:** `create`, `join`, `cancel`, `start`, `peek-done`, `draw`, `place`, `knock`, `times-up`, `next-round`, `leave`, `rematch`. A testable `handler.ts` with its Supabase calls passed in, a thin `entry.ts`, built by `npm run build:functions`. Each reply carries only the caller's view.
- **`save-bot-game`:** accepts `game: "101"` (seed start and save). Chess, checkers and space are handled exactly as now.
- **`multiplayer` and `space-game`:** not changed (their built files must come out identical).

### Website

- `src/games/card101/`: table, cards, scoring show, settings, How to play, bot Web Worker. One line in `registry.ts`, `ranked: false`.
- `src/card101/useCardGame.ts`: keeps a classmates game up to date from the seat row, like `useSpaceGame`.
- Lobby: 101 in the Start list (2–4 players) and in the open games list ("2 of 3 joined"). Route `/#/card-game/:id` for the waiting room and table.

## 9. Free-tier cost (estimate, using the 10.1 simulation)

| | Per game | A class (30 students, 3 lessons a week, groups of 3, ~1 game a lesson each) |
|---|---|---|
| Function calls, classmates | ~80–160 turns (section 13) × ~2 calls (draw, then swap or throw), plus a peek per player per round and joining/ending: **~200–400** | ~30 games a week × ~300 ≈ 9,000 a week, **~40,000 a month** |
| Function calls, bots | **2** (seed + save) | small |
| Realtime messages | each change rewrites every seat row, each sent to 1 player: **~600–1,200** | ~120,000 a month, against 2 million |
| Data sent out | views are about 1–2 KB: **~1.5 MB** | ~0.2 GB a month, against 5 GB |
| Database | a few KB per game | tiny; New season clears it |

With chess, checkers and the space game (~105,000 calls a month at this class size), that's about 145,000 of 500,000. Sign-in is still the real classroom limit (Stage 8 notes), not this game.

**One thing to watch: game length.** A game to 101 takes about 15–30 minutes (section 13), so the Quick game (to 50) matters for lessons.

## 10. Tests

- **Rules:** every scoring rule and every combination from section 12, turn order, knocking and the last turns, the stack running out, the end at 101, ties.
- **Hidden cards:**
  - A "what does each seat know" checker plays thousands of random games and checks every view, after every move, contains only cards that seat is allowed to see. This is the strongest test, because it covers every route that uses `viewFor`.
  - pgTAP: a student can't read `card_games` at all, can read only their own seat row, can't call server-only functions, can't write anything, and the lobby function returns no cards.
  - Server tests: every reply carries only the caller's view; the peek can't be asked for twice.
  - Real browser: one student subscribes to every seat row through Realtime and receives only their own.
- **Refereeing:** out-of-turn moves, illegal moves, double taps, moves after the game ends, joining a full or started game: all refused.
- **Bots:** only legal moves; the "change the hidden cards, the choice doesn't change" fairness test; each level beats the one below over hundreds of games.
- **Screens:** turn flow, the peek, knocking, the scoring show.
- **Real browser, local accounts:** full bot games at each level; classmates games with 2 and with 3 players in separate browser windows, with a reload, a knock and a player walking away; screenshots at Chromebook and tablet sizes; chess, checkers and space still play and save.

## 11. Stages

Each stage ends with `npm run check` and the database tests passing, a browser check where there's something to see, and a short report.

1. **10.1 Rules, scoring, views, bots, simulation.** Plus `docs/101-RULES.md`. I report game length and bot level results.
2. **10.2 Playing bots in the browser** (table, cards, peek, scoring show, keyboard), not saved yet. A private phone preview like the space game's, if you'd like it.
3. **10.3 Saving bot games and points** (migration 0800, `save-bot-game`).
4. **10.4 Playing classmates** (migration 0900, `card-game` function, lobby, waiting room, timers, walk-away rule, reconnecting, the hidden-card tests).
5. **10.5 Polish and go-live:** sounds, How to play, accessibility pass, README, CLASS-LAUNCH, PLAN.md design and cost sections. Then, after your yes (and outside auto mode, which always blocks live changes), apply both migrations, deploy `save-bot-game` and `card-game`, check them from outside, record the migrations in the PLAN.md `migration repair` note, and merge to `main`.

All on branch `stage-10`. Nothing goes live or into `main` before your yes.

## 12. Rule decisions (James, 16 October 2026)

| Question | Decision |
|---|---|
| 1. Pairs | **Any two matching cards anywhere** in the hand |
| 2. Four of a kind | Two pairs, so **0** (follows from 1) |
| 3a. A 3 and a pair | **Pairs and triples first**, then each 3 cancels the highest card still counting (3, 9, 9, 5 → 0) |
| 3b. A pair of 3s | **Each 3 cancels a card** (3, 3, 9, 7 → 0) |
| 3c. Two cards tie for highest | The 3 cancels **just one** |
| 4. Taking the face-up discard | **You can put it straight back** (a change from my suggestion) |
| 5. Stack runs out | **Reshuffle** the discard pile, except its top card |
| 6. Knocking | **Not until everyone has had one turn** in the round |
| 7. Ties | Round: both win the round (no effect on scores). End of game: **share the win** |
| 8. The end | **101 or more** |
| 9. Most players | **4** |
| 10. Shorter option | **Yes: Quick game, first to 50**, as a setting; 101 stays the normal game |
| 11. Who starts each round | Random in round 1, then **the next player along** each round |
| 12. (added later the same day) Swapped-in cards | A card you swap in goes **face up** for everyone to see, and that spot is **locked** for the rest of the round (so each spot is swapped at most once a round). With all four face up you can only throw away or knock |

## 13. Stage 10.1 results: rules, views, bots and simulation (16 October 2026)

Built on branch `stage-10`, in `shared/card101/`. No screens yet, nothing saved, nothing live.

### What's built

- `cards.ts` (the pack, values, names), `score.ts` (scores a hand and returns each step of the working), `engine.ts` (the rules as a pure function), `view.ts` (`viewFor` and `eventsFor`: what each player may see), `bot.ts` (the three levels), `solo.ts` (bot games from a seed, and the server's replay), `sim.ts` and `npm run 101:sim`, `random.ts` (seeded shuffles for bot games, `secureDice` for classmates games).
- The rules follow [101-RULES.md](101-RULES.md) exactly, including all of James's answers in section 12.

### Rule details the engine settled (not in the rules)

- A skipped turn counts as a turn for the "everyone has had a turn" knocking rule.
- If the knocker leaves, the knock still stands. If someone who owes a last turn leaves, the round ends without them.
- If the stack is empty and the discard pile has only its top card, you can't draw from the stack, but you can still take the face-up card. (With 52 cards and at most 4 players this never happened in 24,000 simulated games: the stack never even ran out once in bot games, only in deliberately long random test games.)
- When a student leaves a bot game, the game simply stops and is saved as left early. The bots don't play it out.

### How long a game lasts (1,000 games each)

Minutes assume 8 seconds a turn, plus 25 seconds a round for the deal, peek and scoring show, as if every seat were a student.

| Players play like… | Players | To 101: rounds | To 101: minutes (1 in 20 longer than) | Quick game (to 50): rounds | Quick: minutes |
|---|---|---|---|---|---|
| Easy bots | 2 | 12.5 | 15 (21) | 6.1 | 7 (11) |
| Easy bots | 3 | 11.0 | 16 (21) | 5.3 | 8 (12) |
| Easy bots | 4 | 10.1 | 17 (23) | 4.8 | 8 (12) |
| Medium bots | 2 | 20.6 | 30 (43) | 10.0 | 15 (24) |
| Medium bots | 3 | 15.8 | 28 (40) | 7.5 | 13 (22) |
| Medium bots | 4 | 13.4 | 27 (38) | 6.2 | 13 (20) |

So a careful group of students will take **about half an hour to reach 101**, and a Quick game takes 8–15 minutes. Careful players take longer because they score lower each round (Medium averages 4–6 points a hand, Easy 7–8), so it takes more rounds to reach 101.

### Fairness and how things play out

- **Turn order doesn't matter:** each seat wins about equally often (for example 33%/34%/35% with 3 players).
- **Shared wins** (a tie for lowest total at the end): 0–3% of games.
- **Zero hands are common:** about a quarter of Easy hands and over a third of Medium hands score 0 (pairs and 3s do a lot of work). Good for the scoring show.
- **Knocking:** the knocker has the lowest hand 58–76% of the time with Medium, 42–65% with Easy.

### Bot levels (2-player games, 600 each)

| Match | Stronger level wins |
|---|---|
| Easy vs Very Easy | 88% |
| Medium vs Easy | 71% |
| Medium vs Very Easy | 99% |

The biggest difference between Easy and Medium turned out to be **when to knock**. Knocking only on a really low hand (about 5 or less) beat every other setting I tried, so Medium does that. Easy knocks once its hand looks 9 or less. Very Easy knocks at random once it's allowed to, which makes it easy to beat.

Medium takes about 2 thousandths of a second per decision, so it won't slow a Chromebook down. Replaying a 3-Medium-bot game on the server will take roughly 0.1–0.2 seconds of computer time, well inside the free plan's limit per request.

### Checked

- 75 new tests, all passing (538 in total, all passing):
  - **Scoring (16):** every example in the rules, pairs anywhere, two pairs, four of a kind, triples, 3s with pairs, a pair of 3s, ties for highest, and over 1,000 hands checked for sensible totals.
  - **Turns and rounds (36):** drawing, swapping, throwing, putting the face-up card straight back, out-of-turn and illegal moves refused, knocking (not before everyone's had a turn), last turns, scoring, the start moving along, reshuffling, the end at 101, exactly 101, the Quick game at 50, shared wins, skips, 3 skips and you're out, leaving at every stage, the last player left, and secure shuffling.
  - **Hidden cards (7):** 300 random games (over 20,000 moves, with skips, players leaving and reshuffles), checking every player's view and events after every move: **no card ever leaked**. Plus the peek (shown, then gone for good), stack draws, discard draws, and face-up hands at the end of a round that are hidden again once the next round is dealt. A check also proves the leak test would catch a leak.
  - **Bots (7):** legal moves at every level with 2–4 players; the fairness test (move every card a bot can't see, and its view and choice stay exactly the same); memory; each level beats the one below.
  - **Replay (9):** the replay rebuilds exactly the same game; games left part-way; made-up, changed, too-long and unknown move lists refused.
- Type check and production build pass.
- **Not tested yet** (they don't exist yet): screens, saving, the server function, the database and Realtime. Those come in 10.2–10.4.

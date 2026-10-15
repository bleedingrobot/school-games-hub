# Brief: "Wormholes & Black Holes" — a space-themed snakes and ladders for School Games Hub

You're adding a new game to the School Games Hub repo (this repo). It's a space-themed take on snakes and ladders for Year 4–6 students, playable single-player (against bots) and multiplayer (against classmates). Working title: **Wormholes & Black Holes** (suggest better names if you have them).

Plan first, build second. Your first job is to read the repo and write a plan, then **stop and wait for my approval** before writing game code.

---

## 1. Read these first

Before planning anything, read and understand how the hub already works, and follow its conventions exactly:

- `README.md`, `docs/PLAN.md`, `docs/BRIEF.md`, `docs/CLASS-LAUNCH.md`
- `src/games/registry.ts`, `src/games/types.ts`, and the `chess/` and `checkers/` folders (board UI, bots in a Web Worker, how a game plugs into the dashboard)
- `shared/` (rules code shared between browser and server)
- `src/multiplayer/` (shared game screen, Realtime updates, reconnecting, "away" detection)
- `supabase/functions/multiplayer/` and `supabase/functions/save-bot-game/` (server referee, `version`-based "save only if nothing changed", rate limits)
- The migrations for `bot_games` and `mp_games`, plus the database tests
- `src/styles.css`, the avatar code, and the sound module

Things the hub already promises that this game must keep: server decides everything in multiplayer, no chat or free typing, word-list names and built avatars only, sound off by default, no outside fonts/images/tracking (everything ships from the repo), works on Chromebooks and tablets with mouse, touch and keyboard, plain-language README written for a teacher, NZ English, `npm run check` passes before anything is pushed.

**Do not change how chess or checkers behave.** If you generalise shared multiplayer code, their existing tests must still pass unchanged.

---

## 2. The game

**Board:** a 10×10 board, squares 1–100, numbered in the classic back-and-forth snake pattern. Players launch from Earth on square 1 and race to a destination on 100 (e.g. a space station or a distant galaxy). Starfield background, planets and nebulae as decoration. Each player is a small rocket wearing their hub avatar.

**Classic core:** roll one die, move that many squares. Wormholes (ladders) carry you up. Black holes (snakes) pull you down. First to 100 wins.

**Target game length:** about 8–15 minutes for 2–4 players. Tune all numbers below with simulations (see section 7) rather than guessing. Every number here is a starting point.

### 2a. Wormholes and black holes
- **Wormholes** go up, with a swirly travel animation through the tunnel.
- **Black holes** go down, with a "spaghettified" stretch-and-spin animation (fun, not scary).
- A black hole's pull is softened by items (Force Field, Escape Pod below).

### 2b. Star squares (land on one to get an effect or item)
Each star type has a distinct look **and shape/icon** (not colour alone) and a one-line real fact shown when you land on it.

| Star | Effect |
|---|---|
| Red dwarf (common) | Gain a common item |
| Yellow star (common) | Gain a random item |
| Blue giant (rare) | Gain a rare item |
| White dwarf | Gain a Force Field |
| Binary star | Next turn, roll two dice and pick one |
| Neutron star (hinder) | Heavy gravity: your next 2 rolls are halved |
| Pulsar (hinder others) | Pulse pushes every other player within 5 squares back 2 |
| Supernova (rare, one-time) | Blasts you forward 5 and pushes others within 10 back 2, then turns into a harmless nebula for the rest of the game |
| Comet | Ride its tail forward to where the tail ends. The comet moves along the board each round |
| Matariki cluster | A sharing square: every player gets a common item. Keep the wording respectful and simple, and flag it for me to check |

### 2c. Items
Players hold up to 3 items. On your turn you may use one item before rolling. Some items trigger automatically. Targeted items let you pick an opponent by avatar and player name.

| Item | Type | Effect |
|---|---|---|
| Booster | help | +2 to your next roll |
| Hyperdrive (rare) | help | Double your next roll |
| Navigator (rare) | help | Choose your roll, 1–6 |
| Force Field | help, automatic | Blocks the next black hole you land on |
| Escape Pod | help, automatic | A black hole only drops you half as far |
| Repair Kit | help | Removes a gravity effect from you |
| Warp Key | help | Teleport to the nearest wormhole entrance ahead of you |
| Tractor Beam | hinder | Pull a chosen opponent back 3 |
| Gravity Anchor | hinder | A chosen opponent's next roll is halved |
| Space Mine | hinder | Drop it on your square. The next opponent who lands there goes back 3 |
| Quantum Swap (rare) | hinder | Swap places with a player up to 15 squares ahead of you |

Propose sensible limits so hinder items feel fun, not mean (e.g. a player can't be targeted twice in a row, no hinders on someone already in last place, maybe no Quantum Swap in the last 10 squares).

### 2d. Gravity squares
- **Heavy gravity:** next 2 rolls halved, rounded **up** (never zero).
- **Low gravity:** +2 on your next 2 rolls.
- **Slingshot:** your next roll is doubled.
- Only one gravity effect at a time; a new one replaces the old one. Show active effects as a clear badge on the player.

### 2e. Teleports
- **Paired gates:** land on one and choose whether to jump to its twin (could be better or worse; adds a decision).
- **Mystery coordinates station:** choose one of three destinations shown as hidden cards; flip to reveal.
- Choices need a short timer in multiplayer (auto-pick "stay" if it runs out).

### 2f. Cosmic events (optional setting)
Every few rounds a random event hits everyone, e.g. solar wind (+1 for all), meteor shower (some squares become asteroids for one round, landing on one costs an item or 1 square), wormhole shift (one wormhole moves). Keep it to a small set and make each one obvious on screen.

### 2g. Other rules to include
- **Catch-up help:** the player in last place gets better odds from stars, and a Rescue Beacon item if they fall 30+ squares behind the leader. No one should feel out of the game.
- **Chain reactions** (wormhole → star → teleport...) are allowed but capped (e.g. 3 effects per turn) so loops are impossible.
- **Finishing:** setting for "exact roll to land on 100" (bounce back off the edge) vs "any roll that reaches 100 wins". Default to whichever plays better in simulation.
- **Rolling a 6:** optional "roll again" (max once per turn).
- **Mission log:** a side panel listing every event in plain words ("Speedy Otter 27 hit a black hole and fell from 64 to 22").

---

## 3. Modes and settings

- **Boards:** 3 hand-designed sector maps (e.g. Inner Solar System = gentle, Nebula = medium, Deep Space = chaotic) plus a **Random Galaxy** made by a seeded generator with fairness rules (no black hole on 1–5, no wormhole straight into a black hole's mouth, sensible spacing, balanced numbers). Show the seed so a class can replay the same galaxy.
- **Classic mode:** only wormholes and black holes (for younger students or a quick round).
- **Cosmic mode:** everything on.
- **Quick game:** a 50-square board for short sessions.
- **Optional "Mission Control maths" (off by default, later stage):** answer a quick Year 4–6 maths question to power up a wormhole or earn a bonus item. Design the hooks for it now but build it last.

---

## 4. Single player

- 1 student vs 1–3 bots, using the hub's bot levels (Very Easy, Easy, Medium) with space names if you like (Cadet, Pilot, Commander).
- The dice are luck, so bot skill is about **item and choice decisions**: Very Easy uses items randomly, Easy uses them sensibly, Medium uses them well (saves Force Fields, targets the leader, picks good teleport options).
- Bots "think" for about a second like the existing bots.
- Ask me whether you should also build **pass-and-play** (2–4 students sharing one Chromebook).
- Save single-player results the way `save-bot-game` does. Because dice are random, propose how the server can still check the game (e.g. the server hands out a random seed when the game starts and replays the whole game from it when it's saved). Bot games never count toward rankings, same as now.

---

## 5. Multiplayer

- **2–4 players.** The current `mp_games` design assumes exactly two players, so propose how to support up to 4 (extend the table, or a new table for this game) and explain the trade-offs in plain words before doing it.
- Same joining flow as chess and checkers: game code or open lobby, plus a **Launch** button for the host once at least 2 players are in (host can launch with fewer than 4).
- **The server rolls every die** using secure randomness, and resolves every effect with the shared rules engine. The browser only ever *asks* ("roll", "use item", "choose teleport", "choose target") and never sends dice values or positions.
- Use the same `version` check so double-taps and simultaneous requests can't cause double moves.
- **Timeouts (dice games need different rules from chess):** if a player doesn't act within about 30 seconds, the server auto-rolls for them (no item used). If they're away for several turns in a row, a bot takes over their rocket so the game continues for everyone, and it's recorded as abandoned for them. Propose exact numbers.
- Respect the teacher's existing "pause games against friends" switch.
- Rematch with everyone who presses it.
- Reloading or losing Wi-Fi must never lose a game, same as now.
- Check the free-tier cost (server function calls per game, Realtime messages) in the same way `PLAN.md` does for chess, and include it in the plan.

---

## 6. Look, feel and accessibility

- Draw everything with SVG and CSS. No external images or fonts.
- Animations step by step from the server's event list: dice tumble → rocket hops square by square → wormhole/black hole travel → star sparkle → item card. Keep each step short; add a speed setting.
- Respect `prefers-reduced-motion`, plus an in-game "less motion" toggle.
- Use the existing sound module; sound stays off by default.
- Colour-blind safe: every square type has its own icon and shape.
- Keyboard play (roll with Space/Enter, arrows to pick targets), big tap targets, screen-reader announcements of each event via an `aria-live` region.
- Test at Chromebook (1366×768) and tablet sizes.
- A short "How to play" screen with pictures of each square type and item.
- Space facts: short, accurate, written for Year 4–6 reading level.

---

## 7. Engineering

- Put the rules in `shared/` as a **pure, deterministic engine**: `(state, action, rng) → (new state, list of events)`. The same code runs in the browser, the bots and the server function. Randomness only comes from the rng passed in, so games can be replayed and tested.
- The UI animates the event list; it never works out results itself.
- **Simulation script:** play thousands of bot-vs-bot games per board and mode, and report average game length (turns and estimated minutes), how often each square/item fires, win rates by turn order, how often the last-place player recovers, and that no game ever loops. Use it to tune the numbers, and put a short summary of the final numbers in the plan.
- Thorough unit tests for every square, item, gravity rule, chain cap, finishing rule and edge case; server function tests; database tests for any migration.
- Bots in a Web Worker so the page never freezes.
- Register the game with one line in `src/games/registry.ts`, same as chess and checkers.

---

## 8. Points and results

Stage 7 (points, badges, ratings) isn't built yet. This game is mostly luck, so it should **never count toward competitive ratings**. Save results with `counts_for_points` the same way as the other games, and suggest how it might earn small participation points later. Ask me before deciding.

---

## 9. How to work

1. **Explore and plan.** Read section 1's files, then write `docs/SPACE-GAME-PLAN.md` in the same plain style as `PLAN.md`: rules summary, square/item numbers, board designs, data model, database and server function changes, multiplayer design, timeouts, free-tier cost, stages, and a list of questions for me. **Then stop and wait for my approval.**
2. Suggested stages after approval (adjust if you have a better order):
   1. Rules engine, board generator, simulations, tests
   2. Single-player board UI with bots and animations
   3. Saving single-player results
   4. Multiplayer (database migration, server function, lobby support for 2–4)
   5. Polish: events, How to play, facts, accessibility pass, sound
   6. Optional: Mission Control maths, pass-and-play
3. At the end of each stage: `npm run check` passes, then tell me what you finished, what you tested in a browser, and anything I need to do.
4. **Never apply migrations or deploy server functions to the live Supabase project without telling me exactly what will change and getting a yes first.** Run `npm run build:functions` after changing a handler or `shared/` rules.
5. Update `README.md` and `docs/PLAN.md` as you go, in the same plain language for a teacher who isn't a full-time developer.

## 10. Questions to put in the plan for me

- Final name for the game
- Max players in multiplayer (I'm thinking 4)
- Build pass-and-play or not
- Exact-roll finish or not
- Points: participation only, or none
- Whether to add a small set of preset reactions (e.g. 🚀 👏 😮), off by default with a teacher switch, or keep it with no reactions like chess and checkers
- Anything else you think I've missed — and add as many fun features as you can think of, as long as they fit the rules above

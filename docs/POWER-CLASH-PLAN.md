# Tic-Tac-Toe: Power Clash — plan

Noughts and crosses where each player picks three once-a-match powers (freeze a square, swap two symbols, blow one away, place twice). Written 17 October 2026 from the brief in [prompts/power-clash.md](prompts/power-clash.md) and the code on `main` (Stages 1–10 live, Gem Keep live).
**Status: APPROVED by James 17 Oct 2026 (section 8 answered, all my picks; queue spot = alongside the other games). P.1 engine, P.2 screens, P.3 polish and P.4 bots + saving DONE (on branch `power-clash`, nothing live); P.5 (classmates) next.**

## The short version

- **A new game folder on the hub**, not the standalone site the brief describes. Same sign-in, look (groupmaker style), sounds and points as the other games.
- **Pure rules engine in `shared/power-clash/`** (no screen code, dice passed in), like chess/space/101. The screen only draws what the engine says happened. That is the brief's main rule and it also lets the server replay a bot game before giving points.
- **Pass-and-play first** (two kids, one Chromebook), exactly as the brief. Then bots, then classmates over the internet.
- **First release = four powers**: Double Trouble, Body Swap, Freeze Ray, Board Wipe. The other four (Force Field, Portal Chaos, Wild Card, Time Heist) and Chaos Mode come after.
- **No new database tables until classmates** (stage P.5). Pass-and-play and bots need no server at all except saving bot games for points.

## 1. How the brief changes inside the hub

| Brief says | On the hub |
|---|---|
| Own repo, own Vite project | Folder `src/games/power-clash/` + `shared/power-clash/`, one line in `registry.ts` |
| Dark navy/purple arcade look | Keep it **inside the game board area** (cyan X, magenta O, glow); the page around it uses the hub's groupmaker look so it doesn't feel like a different site |
| No backend, no accounts | True for pass-and-play. Bots and classmates use the hub's existing sign-in and save function |
| Own sound code | Reuse `src/games/sounds.ts` and add the new effects there |
| Reduced-motion + sound switches | The hub already has both; the game follows them |
| Tests in `tests/` | Next to the code, like every other game (`*.test.ts`) |

## 2. The rules, with the gaps filled in

The brief's rules stand as written. These are the places it was silent or ambiguous; **section 8 asks you to confirm them**.

1. **Turn:** optionally use one power, then place one symbol. Double Trouble lets you place two. If the first symbol wins, there is no second.
2. **Winner check after every board change**, including right after a power (a Body Swap can finish a line before you place).
3. **Both players have a line at once** (a Body Swap can do this): **the player whose action caused it wins.** Never decided any other way. This is the brief's own suggestion.
4. **Freeze Ray:** the opponent can't place on that square on their **very next turn** only, then it thaws. A frozen square still counts as empty for a draw (the board isn't "full").
5. **Stuck turns:** if every empty square is frozen for the player to move, they **skip placing** and the freeze thaws (so nobody is ever locked out).
6. **Body Swap:** you pick one of your symbols and one of theirs; they trade squares. Needs at least one of each on the board, otherwise the power can't be chosen (and isn't used up).
7. **Board Wipe:** removes any one symbol (yours or theirs). Can't remove a protected one (later power). It can't win the game by itself, but it can open the board back up after it was full.
8. **No legal target = can't use it,** the card greys out with the reason ("needs one of each symbol on the board") and the charge stays.
9. **Draw:** board full and nobody has three in a row.
10. **Best of five:** first to three round wins. Round starter alternates. Between rounds players may change their three powers (brief: optional). I'd make the **default "keep the same three"** with one tap to change.
11. **Powers are secret?** No. Both players' three cards are visible at all times (brief's layout), so it is about outplaying, not guessing.

## 3. Modes

| Mode | When | Notes |
|---|---|---|
| Power Clash (2 players, one screen) | P.2 | The core game |
| Best of five + instant rematch | P.2 | |
| Against a bot (Very Easy / Easy / Medium) | P.4 | Same picker as other games |
| Against a classmate (game code / open lobby) | P.5 | Server refereed |
| Chaos Mode | P.6 | Random events, separate button so kids know what to expect |

## 4. Bots (P.4)

Small search (the board is tiny, a few thousand positions per move even with powers), run in the page, no worker needed.

- **Very Easy:** random legal moves, uses a power now and then.
- **Easy:** blocks and takes an obvious win, uses powers a bit randomly.
- **Medium:** looks a few moves ahead including powers (picks its three by a fixed good set), still beatable.
- Tuned with a simulation like chess/101 so Medium beats Easy beats Very Easy by a clear margin, and a game takes 2–5 minutes.

## 5. Playing classmates (P.5)

New table + function, copying how 101 and the space game did it (the last two are the model):

- `power_games` table (two seats, board, powers left, frozen state, score, version for safe updates), moves via a new `power-clash` Edge Function that runs the **same shared engine**, so the server can't disagree with the screen. Nothing hidden here, so no per-seat view rows needed (simpler than 101).
- Join with a game code or the open lobby, 60 second turn timer, rematch, same tidy-up cron.
- Needs two migrations applied live and one function deployed (needs you out of auto mode, as before).

## 6. Points (decided to match the space game, change if you disagree)

- **Not ranked** (`ranked: false`): luck and chaos powers make Elo meaningless, so no rating or leaderboards.
- Taking-part points: **2** for a finished bot game, **4** for a classmate game (first 6 a day), inside the existing daily caps.
- A handful of badges (e.g. "Used all three powers in one match", "Won with a Body Swap", "Win without using a power").

## 7. Stages

| Stage | What | Live? |
|---|---|---|
| **P.1** | Engine: types, win check, the 4 powers, history snapshots, full tests (all 8 lines, draws, each power, illegal targets, charges only used on success, same-time wins, no moves after a win) | No |
| **P.2** | Playable screens: setup (pick 3 powers each), board, power cards with target highlighting, best of five, rematch, keyboard play, hidden route `/#/power-clash` | Hidden |
| **P.3** | Polish: animations per power, particles, screen shake, funny messages, sounds, How to play | Hidden |
| **P.4** | Bots + simulation, saving bot games and taking-part points (one migration, `save-bot-game` change) | Dashboard card |
| **P.5** | Classmates (migration, new function) | Live |
| **P.6** | Force Field, Portal Chaos, Wild Card, Time Heist, Chaos Mode | Live |

I stop for your review after P.2 (you play it), after P.3, and before anything goes to the live database.
Browser testing as before: Chromebook (1366×640 usable), tablet touch, keyboard-only, and an accessibility scan.

## 8. What I need from you

1. **OK to go ahead with this plan,** and to put it in the order above (pass-and-play first)?
2. **Simultaneous lines:** is "the player who did the move wins" right (section 2, point 3)?
3. **Freeze Ray:** one turn only, and a skipped turn if every square is frozen (points 4–5). OK?
4. **Board Wipe:** may a player remove their *own* symbol? I'd say yes (it can clear a blocked spot), but it's your call.
5. **Between rounds:** keep the same three powers by default (point 10)?
6. **Points:** taking-part only, not ranked (section 6)?
7. **Where on the dashboard / which queue spot?** Gem Keep, Mission Control maths and monsters are all in progress; do you want this before or after them?

## 9. Decisions (James, 17 October 2026)

All recommended picks accepted: pass-and-play first; the mover wins if both have a line; Freeze Ray one turn; Board Wipe any symbol; keep the same three powers between rounds with one tap to change; taking-part points only, not ranked; built alongside Gem Keep, Mission Control maths and monsters.

## 10. Stage P.3 results (polish, 17 October 2026)

Website only; nothing live, no database or function changes.

- **Animations** (CSS only, no new packages), all driven by the engine's `events` after the engine has already produced the new state: symbol pop-in with a glow; Double Trouble board flash; Body Swap slide between the two squares; Freeze Ray frost burst and sparks; Board Wipe blast, shake and the symbol flying off; winning line cheer, sparks and shake; draw pulse.
- **Input lock:** squares, power cards and "Miss my go" are disabled while an animation plays (0.9 s; 0.15 s with reduced motion).
- **Reduced motion:** follows `prefers-reduced-motion` (CSS plus a `pc--calm` class): no shake, particles or sliding, just a short fade.
- **Sound:** uses the hub mute button (`useSound`, off by default). New synthesised sounds in `src/games/sounds.ts`: `freeze`, `boom`, `swap`, `draw` (zap, tap, end and win reused).
- **Shouts:** short school-friendly lines per power, win, draw and match win (`SHOUTS` in `text.ts`), shown for under 2 s above the board and picked in turn, not at random. What a power did is also in an aria-live status line.
- **How to play:** `Guide.tsx`, opened by a button or `?`, closed with Escape or the close button, focus returns to the button, Tab stays inside. Covers the goal, one power a turn, once each, the four powers with an example, and both-get-a-line (the mover wins).
- **Accessibility and fit:** axe scan clean at 1366x640, tablet (820x1180 touch) and phone (390x780 touch). Fixed a nested `<main>` (the hub already has one). Board is sized from the screen height; the header fits on one line. No sideways scroll at any size.
- **Tests:** four new component tests (input locked then unlocked, shout and status text, How to play open/close/focus, reduced motion). The earlier tests now use reduced motion so they stay quick. Full run: only the usual flaky tests (Gem Keep, chess) plus four that fail only under whole-suite load and pass on their own (101 save stats, checkers leave-part-way, space `?` help, save-bot-game handler).

Next: P.4 (bots, simulation, saving bot games, taking-part points; needs a migration and a `save-bot-game` change).

## 11. Stage P.4 results (bots, saving, points; 17 October 2026)

Nothing is live. The migration is written but **not applied**, the function is built but **not deployed**, and the dashboard card is **off**.

**Bots** (`shared/power-clash/bot.ts`, pure, randomness passed in). Each bot picks one action at a time, always from the engine's list of legal actions.
- Very Easy: random legal moves, uses a power 12% of the time it can.
- Easy: takes a win it can see (95%), otherwise sometimes uses a random power (22%), otherwise places a symbol that doesn't hand the opponent an instant win (but slips 20% of the time). Random powers.
- Medium: looks 3 actions ahead through placements and powers, with a fixed cap on positions looked at (a count, not a clock, so a replay gives the same answer). Always takes a win. Slips 15% of the time. Fixed powers: Double Trouble, Body Swap, Board Wipe (best of all four sets in Medium-v-Medium play: 62% of decided rounds, against 52%, 47% and 40% for the others).
- Speed: Medium takes about 1 ms on average and 20-130 ms at the slowest. Deeper search (4 actions) was tried and was slower (up to 230 ms) for almost no extra strength, so it was left at 3.

**Simulation** (`npm run power-clash:sim`, 1,000 matches per pairing, the two bots swap X and O each match, round starter alternates):

| Pairing | Rounds won by the stronger | Matches won | Turns a match (both players) |
|---|---|---|---|
| Medium v Easy | 96.4% | 100% | 22.0 |
| Easy v Very Easy | 88.4% (180 drawn rounds) | 99.2% | 27.4 |
| Medium v Very Easy | 99.3% | 100% | 18.9 |
| Medium v Medium | 51.0% | 52.0% / 48.0% | 35.7 |
| Easy v Easy | 50.0% | 50.1% / 49.9% | 35.2 |
| Very Easy v Very Easy | 50.6% | 52.5% / 47.5% | 40.5 |

Both targets are met by a wide margin (Medium over 70% against Easy, Easy over 70% against Very Easy). Equal bots win half each, so there is no first-move or side advantage. Matches last 3-5 rounds. Counting a student's go at about 9 seconds and the bot's at about 2 seconds (think time plus animation), a match is roughly 1.5-4 minutes (Medium v Very Easy at the short end, equal bots at the long end). Against Medium a student who loses 3-0 finishes in about 1.5-2 minutes, a little under the 2-5 minute target: Medium wins fast. I can't measure real children, so whether Medium is "still beatable" for 8-10 year olds needs a class trial. If Medium turns out too hard, the knobs are `MEDIUM_SLIP`, `MEDIUM_MAX_DEPTH` and `MEDIUM_POWERS` in `bot.ts`.

**Screens.** The setup screen now has "Two players, one screen" and "Play a bot" side by side. Play a bot shows the usual level picker, a side choice (X goes first; O means the bot opens) and your three powers. The bot's powers are shown from the start. The bot waits 0.6-1.0 s (a 0.15 s blink with reduced motion) and never moves while an animation is playing; between its own steps in one turn it waits for the animation (0.9 s). On its turn every square and power card is disabled, the prompt says "The Easy bot is thinking...", and the message line (aria-live) says what it did, for example "The bot froze the middle square." A "Leave game" button sits under the bot's panel along with a line saying whether the game will be saved.

**Saving and points.** A bot game is a replayable game: `shared/power-clash/solo.ts` is what both the page and the server play through. The bot's powers and every one of its moves come from the seed (its powers from `seed:powers`, each move from `seed:move:N`), so the browser only sends the seed and stamp, the level, the student's side, both sets of powers and the student's actions (`place:4`, `power:freeze-ray:7`, `power:body-swap:0,8`, `skip`, `next`). `save-bot-game` replays it and refuses: made-up, borrowed, other-game and old seeds, a bot whose powers aren't the seed's, any action that isn't legal, actions left over after the end, and "finished" when it isn't. Same seed sent twice saves once. A match left part-way is saved as left early with no points. Nothing is saved from two-player games. If no seed can be had (no Wi-Fi, or the preview) the match is a practice game and says so.
- `ranked: false`; **2 points** for a finished bot game, win or lose, inside the 40-a-day bot cap shared with every other game.
- Migration `20261017001500_power_clash_points.sql` (built on the latest `score_bot_game`, `progress_counts` and `progress_rules`, from Gem Keep): allows `power-clash` in `bot_games`, `scored_games` and `achievement_types` (not `ratings`), adds the `power_clash` columns, `record_power_clash_bot_game()` (server only), the 2-point rule and the badges. A pgTAP test (`supabase/tests/database/power_clash_points.test.sql`) was written in P.4 but not run then; it was first run in P.5 (see section 12), 19 of 19 pass. If a later migration changes `score_bot_game`, `progress_counts` or `progress_rules` before this is applied, merge the Power Clash lines into those instead.
- **Badges** (small change, so done): "Play a game of Power Clash", "Used all three powers in one match", "Won a round with a Body Swap", "Won a match without using a power".
- Not done: the teacher's per-student table and Recent list were left alone (the bot games do appear in Recent under the game's id); adding Power Clash to the teacher view and the profile page belongs with P.5.

**Switch.** `POWER_CLASH_ON` in `src/games/registry.ts` is `false`. While off, the game has no card and no Profile/leaderboard entries but still opens at `/#/power-clash`. Turning it on puts the card on the dashboard (the card says "Play"; the bot picker is inside the game).

**Browser check** (Chromium; Chromebook 1366x640, tablet 820x1180 touch, phone 390x780 touch): a full match against each level, as X and as O, with powers used; axe found nothing on setup, game or match-over screens at any size; no sideways scroll; the bot answers in 0.5-2.7 s (the longest are Double Trouble turns, which are three steps); a keyboard-only game (Tab, Enter) works and the bot's moves are announced. The game screen is no taller than the two-player one it replaced (the setup screen at 1366x640 scrolls a little, as before). One fix on the way: the header with long bot names made the phone scroll sideways, so the score line says "You" and "Bot". Private preview: https://claude.ai/artifact/5odQT7RHRaZxuhKPuYVx3p (no sign-in, nothing is saved).

**Tests.** 825 pass in the full run. New: bots always legal, take a win, block a loss, repeatable, quick, clearly different in strength; replay and judging; handler tests (valid game saved for X and O, left game, all the refusals, daily limit); screen tests (bot replies, locked on its turn, saves once at the end and what is sent replays, practice game, left early, two-player not saved).

**To go live** (needs James out of auto mode): apply the migration, deploy `save-bot-game` (`supabase/functions/save-bot-game/index.ts`), then set `POWER_CLASH_ON` to `true`, merge and deploy the site. Run `npm run test:db` first if a local Supabase copy exists.

## 12. Stage P.5 results (playing a classmate; 18 October 2026)

Nothing is live. Two migrations and one function are written and tested, but **not applied or deployed**, and the dashboard card is still **off** (`POWER_CLASH_ON = false`).

**How it works.** The new `power-clash` server function (`supabase/functions/power-clash/`) is the referee. It runs the same shared engine as the screens: `shared/power-clash/live.ts` plays an action through `engine.ts` and `match.ts`, keeps the badge stats, and works out the clocks and the result. The browser only sends `place`, `use-power` (with targets), `skip`, `next`, `set-powers`, `times-up`, `leave`, `rematch`; the server checks whose turn it is and that the move is legal, and saves "only if the version is still N". One table, `power_games`, one row per game; both players read the whole row (nothing is hidden), students can't write, teachers can read all.
- **Powers** are picked in the waiting room (`set-powers`), the match starts the moment both have picked, and they can't change after. The other player's picks stay hidden in the waiting room (only "powers picked") so nobody counters; both sets show once it starts. A rematch keeps last game's powers and starts at once when both press it.
- **X and O.** Seat 1 plays X for the whole match. A new game's X is a coin toss by the server; a **rematch** makes last game's O play X, so the other player starts. Round starters alternate as before.
- **Joining:** by code (the lobby's code box tries chess/checkers, space, 101, then Power Clash) or the open lobby. "Your games" in the lobby and "still going" on the dashboard list Power Clash like 101.
- **Clock:** 60 seconds a turn plus time for the animation, 30 seconds between rounds. A turn that runs out is a **skipped placement** (new engine function `timeoutTurn`; a power already played stays played). Three missed turns in a row by the same player end the game as abandoned. 101 has no such rule (it only has the 10-minute idle job), so this is new; a time-out does not count as a real move, so the 10-minute tidy job still spots a game both players have walked away from. Between rounds both press Next (or it starts by itself after 30 seconds).
- **Leaving:** the game ends as abandoned, the other player is told who left, nobody earns anything. A teacher hiding or deleting a student ends it the next time the other player does something.
- **Points:** not ranked. **4 points** for a finished classmates game (win or lose), first **6** games a day, a game left part-way earns nothing for either player. Neither 101 nor the space game has a separate limit for the same two students (only the daily games cap), so none was added. New badge "Win against a classmate"; the four P.4 badges now count classmates games too (the stats are saved per seat). `rebuild_progress()` re-scores them with the same points; `teacher_new_season` clears finished ones.
- **Screens:** `PowerClashLive.tsx` reuses the board, power cards, animations, shouts and sounds from the bot game; the waiting room is `PowerGamePage.tsx`. Names and avatars, the server's countdown (number only, turns yellow in the last 10 seconds, no flashing; a spoken warning at 10 seconds on your own turn), "Waiting for <name>", a banner when the connection drops (the game is kept and reloaded on reconnect), "<name> isn't here right now" when they are away, keys 1-9 place a symbol, a leave confirmation. How to play has a new section; the old line "each power once in the match" was wrong (powers come back each round) and is fixed.
- **Teacher and profile:** the teacher's per-student table, Recent list and the profile achievements now include Power Clash (they were missing in P.4 because the card is off: lists now use `gameLabel` and `ALL_GAMES`). "How points work" has a Power Clash section (shows only once the switch is on).

**Migrations, in order:** `20261017001500_power_clash_points.sql` (P.4; it was `001400`, renamed because the Mission Control maths migration on the `space-maths` branch is also `001400`; it now also keeps that branch's three maths achievement measures and counts, so it is safe with or without it), `20261017001600_power_clash_games.sql`, `20261017001700_power_clash_scoring.sql`. `teacher_new_season` only clears the maths records if that table exists. If the `space-maths` migrations are applied later than these they would overwrite `progress_counts()`; they must go first.

**SQL tests: run this time.** A local Supabase copy turned out to be running (the one in the main checkout, at migration `001400`). I did not touch it: I copied its structure into a scratch database, applied all three migrations to that, ran every pgTAP file, and then deleted it. New `power_clash_classmates.test.sql`: 61 of 61 pass (access rules, scoring, daily limit, badges, rebuild gives the same points, tidy, lobby, codes, presence channel, teacher views, new season). P.4's `power_clash_points.test.sql`: 19 of 19 pass (one expectation changed because the rules now also say what a classmate game earns). I updated `security.test.sql` (new table, functions, live updates; plan +3) and `progress_access.test.sql` (45 achievements became 50). Still failing in that scratch copy, all because of the `space-maths` branch and not this work: `progress_access` expects 50 but finds 53 (3 maths achievements), `security` lists `teacher_set_space_maths`, `space_points` expects 6 space achievements but finds 9. When that branch merges those numbers need updating (53, and its function in the list).

**Tests.** Server handler: 36 (legal move saves; wrong turn, illegal move, outsider, stale version, double tap, finished game all refused; both players get the same row; time-out and three in a row; Next; rematch; leaving; hidden and deleted students; limits). Pure engine reuse: server and a client replay of the same actions end in the same state (6 random whole matches). Screens: 26 for the board, 12 for the page and hook (turn lock, countdown and warning, reconnect banner, one request for a double tap, refusals, rematch), lobby and dashboard. `npm run build:functions` was run. Full run: all pass.

**Browser check** (Chromium, two pages as two students sharing the stand-in server): a whole match to the end and a rematch (the other player started), 1366x640 (board bottom at 584 px; the page is 676 px tall including the preview bar, so it scrolls a little as the bot game's setup does), tablet 820x1180 touch, phone 390x780 touch (no sideways scroll), axe found nothing on the waiting room, match, finished and phone/tablet screens, a dropped connection (banner shown, board kept, a move was refused politely, game carried on after reconnect), a time-out (clock jumped 61 s: the turn passed with nothing placed), and keys 1-9 place a symbol. The Tab-and-Enter path is covered by a screen test, not by the browser run.

**Private preview** https://claude.ai/artifact/5odQT7RHRaZxuhKPuYVx3p: open it in two tabs, pick Ana in one and Ben in the other, and start/join. It uses a **stand-in server in your browser, not the real one** (the real referee code, with localStorage as the database); buttons at the top let you fake a Wi-Fi drop or skip 61 seconds. I could not test it inside Claude's page frame, only as a normal web page.

**To go live** (needs James out of auto mode): apply `20261017001500`, `001600`, `001700` in order (after any `space-maths` migrations), deploy `save-bot-game` and the new `power-clash` function (`npx supabase functions deploy power-clash --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`), switch `POWER_CLASH_ON` on, merge and deploy the site, and check from outside as the 101 launch did (function answers 401 JSON without sign-in; `power_games` closed to signed-out visitors with 42501). Then run one real game between two accounts, because the live Realtime and presence rules have only been proved in SQL, not with a real connection.

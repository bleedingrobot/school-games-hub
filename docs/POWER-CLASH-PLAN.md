# Tic-Tac-Toe: Power Clash — plan

Noughts and crosses where each player picks three once-a-match powers (freeze a square, swap two symbols, blow one away, place twice). Written 17 October 2026 from the brief in [prompts/power-clash.md](prompts/power-clash.md) and the code on `main` (Stages 1–10 live, Gem Keep live).
**Status: APPROVED by James 17 Oct 2026 (section 8 answered, all my picks; queue spot = alongside the other games). Stage P.1 (engine) DONE; P.2 (screens) next.**

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

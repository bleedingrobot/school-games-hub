# Chess: the new look

James, 18 Nov 2026: "a graphical upgrade for chess … a few different sets and boards and kids could unlock them in
different ways … a few different backgrounds … full screen … flashy and entertaining animations."

**Status:** stage 1 live (PR #578: full window, castle hall painting, all the move animations). Stage 2 live (PR #579:
the 🎒 Chess Locker, 6 more backgrounds with their own particles, unlocks worked out on the server, the treasure chest).
Stage 3 live (PR #580, 18 Nov 2026: the 4 painted boards, lively, in the Locker and the chest). Stage 4 live (PR #594,
19 Nov 2026: the 6 painted piece sets on the board, the Locker and the chest). Stage 5 built
19 Nov 2026: painted bots (a chick, a robot, a wizard) that pop in on the start screen and think with bubbles in
the game. Checkers keeps its emoji for now (its own bots would need pictures holding draughts).

## Decisions

- **Each kid sees their own look**, in bot games and classmate games (James, 18 Nov 2026). The opponent's choice
  never shows on your screen.
- **Every unlock can be reached by playing a lot**, not only by being strong. Beating the Medium bot and Champion rank
  open nothing (James: "kids won't ever do this, make it easier").
- Unlocks are worked out on the server from games it already checked (`bot_games` and classmate games), never by the
  browser, and they stay through a New Season.
- Looks only: nothing changes how the game plays or how it is scored.

## What can be unlocked

| Kind | Name | How |
|---|---|---|
| Set | Classic | Everyone |
| Set | Carved Wood | Finish 3 games |
| Set | Bush Birds (kiwi pawns, kererū knights, ruru bishops, tūī rooks, kākāpō queen, takahē king) | Beat the Very Easy bot |
| Set | Ice Crystal | Beat the Easy bot |
| Set | Robot | Play 10 games against classmates |
| Set | Dragon Knights | Beat the Easy bot 5 times |
| Set | Golden | Win 20 games against anyone (any bot or classmate) |
| Board | Classic wood | Everyone |
| Board | Marble | 5 checkmates |
| Board | Beach sand and shell | Win while playing Black |
| Board | Glowing lava rock | Promote 3 pawns |
| Board | Starfield glass | Win 5 games against classmates |
| Background | Castle hall | Everyone |
| Background | Forest clearing | Castle for the first time |
| Background | Wairarapa coast at sunset | Win a game |
| Background | Volcano | Checkmate with a knight |
| Background | Snowy mountain top | Play 25 games |
| Background | Underwater palace | Promote a pawn |
| Background | Space station | Win a game in under 20 of your moves |

## Stages (each goes live on its own)

1. **Full window and animations** (done). `ChessWindow.tsx` is the full-window layer (castle painting, drifting gold
   dust, ⌂ Hub and sound); `chess.css` styles everything inside `.cw`, so checkers keeps the shared look. `Board.tsx`
   slides each move (both pieces when castling), bursts captures (ghost piece, flash, shards, a shake), slams in
   CHECK!, raises a pillar of light on promotion, and on checkmate topples the king with fireworks before the result
   card. Everything stops for devices that ask for less motion. Preview: `npx vite --config vite.chess-preview.config.ts`
   (add `#show` to step through captures, checks, castling, a promotion and a checkmate).
2. **Backgrounds and the Chess Locker** (done). Migration `20261118003300_chess_looks.sql`: `chess_looks` (each
   pupil's chosen set, board and background, plus `unlocked` and `seen`), `chess_look_rules()` (the table above),
   `chess_looks_refresh(who)` counting the pupil's checked games (`chess_look_facts()` walks the moves for castling,
   promotions and the mating piece). Triggers on `bot_games` and `mp_games` write unlocks down the moment a chess game
   is saved, because a New Season deletes the games; `unlocked` only grows. Only games that count (10 of your own
   moves, not abandoned) count. The browser calls `my_chess_looks()`, `set_chess_look(kind, item)` (refuses anything
   locked) and `mark_chess_looks_seen(items)`. Screens: `looks.ts` (names, words, the shared store), `Scenery.tsx`
   (painting plus particles: dust, leaves, spray, embers, snow, bubbles, stars), `Locker.tsx` (Sets and Boards show
   "coming soon" with unlock progress, so pupils can earn them already), `Reveal.tsx` (the chest, after the result
   card, in bot and classmate games). Preview: `#reveal` opens the chest; `preview/chess/fakeLooks.ts` stands in for
   the server. Stages 3 and 4 add their kind to `READY_KINDS` in `looks.ts`; their unlocks are already saved.
3. **Boards** (done). `board/<id>-light` and `board/<id>-dark` in the art config are flat painted textures (`--style t`,
   no chess words). `BoardFace.tsx` gives `Board.tsx` the pupil's board: each square shows its own eighth of one big
   painting (`--c`, `--r`), so veins and cracks run across the board. `boards.css` has each board's frame and what moves:
   a gleam across the marble, paua squares shimmering and sun glints on the beach, lava squares throbbing with rising
   embers, twinkling stars and a shooting star on the starfield. Every board sweeps in square by square. The Locker's
   plinth and shelf and the treasure chest show small real boards. Classic wood is unchanged. The squares were the
   wrong way round before this stage (a1 was light); now a1 is dark. Preview: add `&board=lava` (or marble, beach,
   starfield) to the address.
4. **Piece sets** (done). `docs/chess-art/sets.json` paints `set/<set>/<w|b><P|R|N|B|Q|K>` (72 cut-outs, picks in
   `sets-picks.json`): Carved Wood, Ice Crystal, Robot (glowing eyes), Dragon Knights, Golden (diamonds and rubies) and
   Bush Birds (kiwi pawns, kererū knights, ruru bishops, tūī rooks, kākāpō queen, takahē king). Say "flat open top"
   for rooks and keep "knight" out of the dragon bishops, or the painter puts a king's cross on top. `Board.tsx`
   `pieceImage(colour, type, set)` uses the painted piece, or the drawn one for Classic or anything missing;
   `pieceClass` stands each kind at its own height (pictures are all cut to the same height), and the birds get a white
   or red edge so the sides read apart. `SetFace.tsx` shows a set on the Locker plinth, the shelf and the chest.
   Preview: add `&set=birds` (or wood, ice, robot, dragon, golden).
5. **Bot portraits** (🐣 Chick, 🤖 Robot, 🧠 Wizard as painted characters on the start screen) and polish. Art in
   `docs/chess-art/bots.json`, pictures in `src/games/chess/art/bot/`, shown by `BotPortrait.tsx`.

## Art

All in `docs/chess-art/config.json`, painted with `python scripts/game_art.py chess paint ~/dragon-art-inbox/chess`,
picked in `picks.json`, then `tidy`. Style: bright storybook fantasy, calm middle so the board stands out. Style a's
"no chessboard" words made the painter put a board on the ground for the volcano, underwater palace and space station,
so those three use `--style b` (no chess words). The chest and stand are cut-outs in `docs/chess-art/fx.json`
(`fx-picks.json`), tidied with rembg.

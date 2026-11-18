# Chess: the new look

James, 18 Nov 2026: "a graphical upgrade for chess … a few different sets and boards and kids could unlock them in
different ways … a few different backgrounds … full screen … flashy and entertaining animations."

**Status:** stage 1 done (full window, castle hall painting, all the move animations). Stages 2 to 5 to do.

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
2. **Backgrounds and the Chess Locker:** a migration with `chess_looks` (each pupil's chosen set, board and
   background) and `my_chess_looks()` working out the unlocks from saved games; a 🎒 Locker screen to pick; the other
   6 background paintings; an unlock reveal (a chest bursts open) after the game that earned it.
3. **Boards:** 4 painted boards (kind `texture`) and their unlocks.
4. **Piece sets:** 6 sets × 12 cut-out pieces, keeping the normal chess shapes so they read on small squares. The
   SVG pieces stay as the fallback.
5. **Bot portraits** (🐣 Chick, 🤖 Robot, 🧠 Wizard as painted characters on the start screen) and polish.

## Art

All in `docs/chess-art/config.json`, painted with `python scripts/game_art.py chess paint ~/dragon-art-inbox/chess`,
picked in `picks.json`, then `tidy`. Style: bright storybook fantasy, calm middle so the board stands out.

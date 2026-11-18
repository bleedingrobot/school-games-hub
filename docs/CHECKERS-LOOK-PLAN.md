# Checkers: the new look

James, 19 Nov 2026: give checkers the same kind of graphical upgrade chess got ([CHESS-LOOK-PLAN.md](CHESS-LOOK-PLAN.md)),
but with **its own new paintings** (not the chess ones) and four painted piece sets: pāua and pounamu, biscuits,
pirate coins, fire and ice.

**Status:** planned, 19 Nov 2026. Nothing built yet.

## Decisions

- **Same rules as chess** (James, 18 Nov 2026, for chess): each kid sees their own look, in bot and classmate games,
  never the opponent's. Every unlock can be reached by playing a lot, not only by being strong. Unlocks are worked out
  on the server from games it already checked and stay through a New Season. Looks only: nothing changes how checkers
  plays or scores.
- **Own paintings** (James, 19 Nov 2026): a pirate feel to start from, with its own backgrounds and boards. Nothing
  borrowed from the chess art.
- **Reuse the chess code, not copy it.** Before stage 1, lift the parts that aren't chess-specific (the full window,
  `Scenery.tsx` particles, the Locker showroom, the treasure chest `Reveal.tsx`, `BoardFace.tsx` painted squares) into
  `src/games/shared/look/` taking the game's looks as a prop. Chess must look and behave exactly the same afterwards
  (its tests and screenshots are the check). Checkers gets its own `.kw` styles, so neither game's CSS leaks.
- Only the dark squares are played on, so a painted board's light squares can be plainer and its dark squares are the
  star.

## What can be unlocked

Suggested; James to tweak. All count only games that count (10 of your own moves, not abandoned), like chess.

| Kind | Name | How |
|---|---|---|
| Set | Classic red and white | Everyone |
| Set | Biscuits (choc-chip against pink iced; kings are a stack with a cherry) | Finish 3 games |
| Set | Pirate coins (gold doubloons against silver; kings get a crown stamp) | Beat the Very Easy bot |
| Set | Pāua and pounamu (shell against green stone; kings get a carved crown) | Play 10 games against classmates |
| Set | Fire and ice (glowing lava stones against frosty ice) | Win 20 games against anyone |
| Board | Classic | Everyone |
| Board | Treasure map (parchment and inked squares) | Crown 5 kings |
| Board | Lolly shop (jelly and icing squares) | Win while playing Red |
| Board | Mossy stepping stones | Make a double jump |
| Board | Neon arcade (glowing grid) | Win 5 games against classmates |
| Background | Pirate ship deck | Everyone |
| Background | Tropical lagoon | Win a game |
| Background | Lolly land | Crown your first king |
| Background | Glow-worm cave | Play 25 games |
| Background | Tree-house village | Make a triple jump |
| Background | Moon base | Win with 6 or more of your pieces left |

## Stages (each goes live on its own)

0. **Share the chess look parts** (no change pupils can see). Move the general pieces to `src/games/shared/look/`,
   chess passes its looks in. Chess tests, the test budget and screenshots at 390, 820 and 1280 wide must match before
   and after.
1. **Full window and animations.** Checkers fills the window like chess, on the pirate ship deck. Pieces slide; each
   hop of a multi-jump arcs over the jumped piece, which bursts; a crown drops on with a flash when a piece is crowned;
   fireworks and a big WIN card at the end. Everything stops for devices that ask for less motion.
2. **Backgrounds and the Checkers Locker.** Migration: `checkers_looks` (chosen set, board, background, `unlocked`,
   `seen`), `checkers_look_rules()`, `checkers_looks_refresh(who)` with `checkers_look_facts()` replaying the saved
   moves for kings crowned, double and triple jumps and pieces left. Triggers on `bot_games` and `mp_games` for
   `game = 'checkers'`, so a New Season can't take unlocks away. Browser calls `my_checkers_looks()`,
   `set_checkers_look(kind, item)`, `mark_checkers_looks_seen(items)`. Back-award from games already saved. The six
   backgrounds painted, each with its own particles (sea spray, lolly sparkles, glow-worms, leaves, moon dust). Sets
   and boards show "coming soon" with progress, so pupils earn them early.
3. **Boards.** Four painted boards as textures (`--style t`, no game words), each with its own movement: the map's ink
   shimmering, jelly squares wobbling, moss stones bobbing, neon pulsing.
4. **Piece sets.** Four sets painted from straight above as round cut-outs, men and kings (16 pictures). Classic keeps
   the drawn pieces as the fallback.

## Art

All in `docs/checkers-art/config.json` and painted on the gaming PC's ComfyUI (from the Mac, use a copy whose comfy is
the Tailscale address). Lessons from chess: don't write "no grid / no tiles / no board" (the painter draws them), and
check every cut-out on a contact sheet before picking. Pieces are seen from above, so prompts say "a round flat game
counter seen from directly above".

## Open questions for James

- Are the unlock rules above about right, and is Moon base (6 pieces left) too hard?
- Should the bot portraits (chess stage 5) be shared with checkers?

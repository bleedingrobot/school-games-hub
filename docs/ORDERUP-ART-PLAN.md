# Order Up!: art plan

**Status: config written 13 Nov 2026; first tries being painted.** Words and sizes for every picture are in [orderup-art/config.json](orderup-art/config.json); paint with `python3 scripts/game_art.py orderup paint ~/dragon-art-inbox/orderup-art --tries 3` on a computer that reaches ComfyUI. The tries go on the branch `orderup-art-inbox`, never on `main`. The chosen try for each picture goes in `orderup-art/picks.json`; then `tidy` writes the `.webp` files.

Everything that carries maths (the numbers and signs on the bag, the coloured order card, the lines on the ticket) is drawn in code, on top of the paintings. The pictures have no text, so they never clash with the maths, and the activity works fully without them (game guide 6: drawn stand-ins stay as the fallback).

| Picture | Kind | Where it's used | Stage |
|---|---|---|---|
| `card` | home card, 16:9 | the Activities page card (`src/assets/home/orderup.webp`) | 3 |
| `back-diner` | scene | behind the bag and the ticket | 3 |
| `bag` | cut-out | the take-away bag the expression is written on | 3 |
| `ticket` | cut-out | the order ticket the working is written on | 3 |
| `chef` | cut-out | the kiwi chef who gives the worked example and the hints | 3 |

Later (stage 7, the game layer): customers (4 to 6 kiwi-style birds), dishes for the menu, the diner's unlocks (neon sign, booths, jukebox), the loyalty card and stamps.

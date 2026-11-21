# Bond Match pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts in `docs/bond-match-art/config.json` (painted with `scripts/game_art.py bond-match paint`;
game plan: docs/plans/bond-match-look/PLAN.md). The prompts leave room for numbers; the game draws every number and
word in code.

- Which try of each picture is used: `docs/bond-match-art/picks.json`.
- Cutting out and sizing: `scripts/game_art.py bond-match tidy` removes the white background with the open-source rembg
  tool (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are
  kept whole, with an `-800` copy for small screens. The blue and violet card backs are tinted copies of `card-back`; the silver and bronze starfish are tinted copies of
  `starfish-gold`.
- Not painted: the rock pools, stones, driftwood strips and target pebbles on the picker are drawn in CSS
  (`src/games/bond-match/bond-match.css`); the CSS sky and sand also show if a picture fails to load.
- The repo does not record the licence terms of the Z-Image Turbo model or of rembg, so they are not stated here.
- The ripple and sparkle (in `fx/`) were painted on black; `tidy` turns their brightness into see-through glow.
- The finish (sunset edge, starfish, shell bucket) is in `back/` and `rewards/`.
- Pip the crab (waving, cheering, thinking) is in `pip/`; the players' pink and blue shell badges are in `players/`. The 🦀 and
  the old 🙂 😃 emoji show if a picture is missing or fails to load.
- The game bar's pocket watch and blocks (the timer and fraction-picture toggles) and the shelves' pebble, sea glass and
  clam shell are in `icons/`; the old ⏱️ 🙈 📊 🔢 emoji and the coloured dots show if a picture is missing or fails to load.
- Painted on 21 Nov 2026.

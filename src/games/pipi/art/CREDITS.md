# Pipi's Hidden Shells pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts written in `scripts/pipi-art.py` (game plan: docs/PIPI-PLAN.md and docs/PIPI-ART-PLAN.md). Style: clay (style `c`). The script
fixes each picture's random seed, so a try can be painted again exactly. The scripts leave room for numbers on the pictures;
the game draws the numbers in code.

- Which try of each picture is used: `docs/pipi-art/picks-clay.json` (33 picks).
- Cutting out and sizing: `scripts/pipi-art.py tidy` removes the white background with the open-source rembg tool (run on
  James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept whole,
  with an `-800` copy for small screens.
- The home page card (`src/assets/home/pipi.webp` and `pipi-small.webp`) is painted the same way.
- The first set (4 Nov 2026, 32 pictures) was paper cut-out style, picks in `docs/pipi-art/picks.json`. It was replaced by the clay set on 5 Nov 2026 to match the other Foundational games, and the tide wave was painted the same day.
- The repo records no third-party picture set used here, and it does not record the licence terms of the Z-Image Turbo model or of rembg, so they are not stated here.
- Painted on 4 to 6 Nov 2026 going by the repo history (first commit of this folder: see `git log -- src/games/pipi/art`).

# Weka's Stepping Stones pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts written in `scripts/weka-art.py` (game plan: docs/WEKA-PLAN.md and docs/WEKA-ART-PLAN.md). Style: clay (style `b`, Beanstalk's clay). The script
fixes each picture's random seed, so a try can be painted again exactly. The scripts leave room for numbers on the pictures;
the game draws the numbers in code.

- Which try of each picture is used: `docs/weka-art/picks.json` (27 picks).
- Cutting out and sizing: `scripts/weka-art.py tidy` removes the white background with the open-source rembg tool (run on
  James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept whole,
  with an `-800` copy for small screens.
- The home page card (`src/assets/home/weka.webp` and `weka-small.webp`) is painted the same way.
- The settings for these pictures are also in `docs/weka-art/config.json`, read by `scripts/game_art.py` (same prompts, sizes and seeds as `scripts/weka-art.py`).
- The repo records no third-party picture set used here, and it does not record the licence terms of the Z-Image Turbo model or of rembg, so they are not stated here.
- Painted on 4 to 6 Nov 2026 going by the repo history (first commit of this folder: see `git log -- src/games/weka/art`).

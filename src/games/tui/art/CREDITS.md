# Tūī's Ten Tree pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts written in `scripts/tui-art.py` (game plan: docs/TUI-PLAN.md). Style: clay (style `b`, the same words as Beanstalk's clay so the two look like a pair, as the script's header says). The script
fixes each picture's random seed, so a try can be painted again exactly. The scripts leave room for numbers on the pictures;
the game draws the numbers in code.

- Which try of each picture is used: `docs/tui-art/picks.json` (30 picks).
- Cutting out and sizing: `scripts/tui-art.py tidy` removes the white background with the open-source rembg tool (run on
  James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept whole,
  with an `-800` copy for small screens.
- The home page card (`src/assets/home/tui.webp` and `tui-small.webp`) is painted the same way.
- The repo records no third-party picture set used here, and it does not record the licence terms of the Z-Image Turbo model or of rembg, so they are not stated here.
- Painted on 4 to 6 Nov 2026 going by the repo history (first commit of this folder: see `git log -- src/games/tui/art`).

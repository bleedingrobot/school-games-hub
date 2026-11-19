# Goblin Storm pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the words in `docs/goblinstorm-art/config.json` (art plan: docs/GOBLINSTORM-ART-PLAN.md), painted with
`scripts/game_art.py goblinstorm paint`. The script fixes each picture's random seed, so a try can be painted again exactly.
No picture has text or numbers in it; attacks, effects and numbers are drawn in code.

- Which try of each picture is used: `docs/goblinstorm-art/picks.json`.
- Cutting out and sizing: `scripts/game_art.py goblinstorm tidy` removes the white background with the open-source rembg
  tool (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Ground tiles
  are blended so they repeat with no seam; icons and portraits keep their painted background, with a `-small` copy.
- The home page card is painted the same way. It waits in `card/` until the game is in the hub's game list (the code
  switch PR moves `card/goblinstorm.webp` and `card/goblinstorm-small.webp` to `src/assets/home/`).
- The repo records no third-party picture set used here, and it does not record the licence terms of the Z-Image Turbo
  model or of rembg, so they are not stated here.
- Painted on 19 Nov 2026. Sprites use the high-angle top-down view James picked from a style test that day.

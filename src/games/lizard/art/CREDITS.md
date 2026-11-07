# Lizard's Bundles pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts in `docs/lizard-art/config.json` (run with `scripts/game_art.py lizard`). Style: clay (style `b`,
as Weka, Tui, Pigeon and Parrot). Each picture has a fixed random seed, so a try can be painted again exactly.

- Which try of each picture is used: `docs/lizard-art/picks.json` (14 picks).
- Cutting out and sizing: `scripts/game_art.py lizard tidy` removes the white background with the open-source rembg tool
  (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept whole,
  with an `-800` copy for small screens. The bronze and silver bundles are the painted bundle recoloured by the script.
- The home page card (`src/assets/home/lizard.webp` and `lizard-small.webp`) is painted the same way.
- Lizard, Kiwi, Fantail, Bellbird and Kea (sit pose; Lizard also eating and cheering), the den bundle, the Golden Raft and the
  three forest backgrounds are painted.
- Drawn in code on purpose: the loose sticks, the bundles of ten and the rafts of a hundred a child counts on the mat. A painting
  could not be trusted to show exactly ten, so they stay SVG, and every picture also falls back to its SVG stand-in if a
  painted file is missing.

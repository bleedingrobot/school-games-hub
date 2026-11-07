# Swamp Hen's Reed Rows pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts in `docs/swamphen-art/config.json` (run with `scripts/game_art.py swamphen`). Style: clay (style `b`,
as Weka, Tui, Pigeon, Parrot and Lizard). Each picture has a fixed random seed, so a try can be painted again exactly.

- Which try of each picture is used: `docs/swamphen-art/picks.json`.
- Cutting out and sizing: `scripts/game_art.py swamphen tidy` removes the white background with the open-source rembg tool
  (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept whole,
  with an `-800` copy for small screens. The mud, bronze, silver, green and amber reeds are the painted gold reed recoloured by the script.
- The home page card (`src/assets/home/swamphen.webp` and `swamphen-small.webp`) is painted the same way.
- Swamp Hen, Kereru, Kea, Weka, Tui and Heron (sitting and cheering; eating uses the sitting picture), one reed, the Golden
  Reed Garden prize and the three dawn, misty and sunset backgrounds are painted.
- Drawn in code on purpose: the garden of shoots a child counts, the pile and the lanes. They repeat the one painted reed so the number on screen is exactly right; a painting could not be trusted to show an exact count.
  Every picture also falls back to its code-drawn stand-in if a painted file is missing.
- The flax mat that covers the rows stays drawn in code: every painting of a mat came back with clay lumps on it (they would read as
  counters), so none was used. `art.tsx` shows a painted mat automatically if `paint/garden/mat.webp` is ever added.

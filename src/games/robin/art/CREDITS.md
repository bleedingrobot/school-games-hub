# Robin's Berry Basket pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts in `docs/robin-art/config.json` (run with `scripts/game_art.py robin`). Style: clay (style `b`,
as Weka, Tui, Pigeon, Parrot and Lizard). Each picture has a fixed random seed, so a try can be painted again exactly.

- Which try of each picture is used: `docs/robin-art/picks.json` (15 picks).
- Cutting out and sizing: `scripts/game_art.py robin tidy` removes the white background with the open-source rembg tool
  (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. The forest background is
  kept whole, with an `-800` copy for small screens. The bronze and silver baskets are the painted basket recoloured by the script.
- The home page card (`src/assets/home/robin.webp` and `robin-small.webp`) is painted the same way.
- Painted: Robin (sitting, cheering, laughing), Kiwi, Kea, Weka, Pukeko and Tui (sitting), one berry, the empty basket (plain,
  bronze, silver, gold), the covered plate, the Golden Berry Feast and the forest background.
- Drawn in code on purpose: the number of berries. The one painted berry is repeated by code in the basket's slots, the heap,
  the pile to count and the "one more", so every count on screen is exact. The painted basket is empty and the painted plate is
  a closed cover with nothing visible under it; the number on it is text. Every picture also falls back to its SVG stand-in in
  `../art.tsx` if a painted file is missing.

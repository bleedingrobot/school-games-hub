# Glyph Gates pictures

Everything in `paint/` is a painted picture made by an image AI model (Z-Image Turbo, run through ComfyUI) on James's
gaming PC, from the prompts in `docs/glyph-art/config.json`, read by `scripts/game_art.py`. The script fixes each
picture's random seed, so a try can be painted again exactly. The pictures carry no text; the game draws the glyphs and
numbers in code.

- Styles: the scenes and the home card use style `t` (painted jungle temple). The stones and monkeys use style `c`
  (single object on plain white, for cutting out).
- Which try of each picture is used: `docs/glyph-art/picks.json`. All tries are kept as small previews in
  `docs/glyph-art/tries/`.
- Cutting out and sizing: `scripts/game_art.py glyph tidy` removes the white background with the open-source rembg tool
  (run on James's computer only, never in the site build), trims, shrinks and saves `.webp` files here. Scenes are kept
  whole, with an `-800` copy for small screens.
- The home page card (`src/assets/home/glyph.webp` and `glyph-small.webp`) is painted the same way.
- The repo records no third-party picture set used here, and it does not record the licence terms of the Z-Image Turbo
  model or of rembg, so they are not stated here.
- Painted on 13 and 14 Nov 2026.

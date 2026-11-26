# Toon Flap art

Every picture here was painted for this game in ComfyUI on James's gaming PC (Z-Image Turbo), from the prompts in
`scripts/toonflap-art.py`, in November 2026. Each level borrows the *look* of a well-known cartoon style, described in
words only (docs/TOON-FLAP-ART-PLAN.md section 1a). No show, studio or character is named in any prompt; no screenshots,
fan art or show-trained models were used as inputs; every character and building is our own design.

**Pupils' drawings (26 Nov 2026):** `kids/*.webp`, `flyers/elf-globe-glide.webp`, `flyers/grumpy-santa-glide.webp` and
`trails/baubles.webp` are our own pupils' crayon drawings (Christmas trees, presents, the grumpy Santa, the elf snow globe and a
string of baubles), photographed, cut out and tidied (brighter colours, a white sticker edge). Christmas Coast's
`worlds/11/back.webp` is now Santa's factory by the beach (their idea), painted in ComfyUI from `w11-factory-back` (try 1).

Chosen tries: `docs/toonflap-art/picks.json`. Raw tries: `~/dragon-art-inbox/toonflap-art/` on James's Mac.
Remake: `python3 scripts/toonflap-art.py paint OUT_DIR <names>`, then `~/.cache/rembg-venv/bin/python scripts/toonflap-art.py tidy --force`.

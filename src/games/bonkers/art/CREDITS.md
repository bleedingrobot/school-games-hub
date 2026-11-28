# Smash Quest pictures

Everything in `paint/` (and the home card `src/assets/home/bonkers.webp`) was painted by an image AI model (Z-Image Turbo, run
through ComfyUI) on James's gaming PC on 28 Nov 2026. The prompts are in `docs/bonkers-art/config.json` and the plan is in
docs/BONKERS-ART-PLAN.md. The style is `toon` (bouncy cartoon). Gear and the chest use `toon_item` (no faces), and places use
`toon_place` (nobody in them).

- One try of each picture (`docs/bonkers-art/picks.json`). 46 were repainted on the PC before the pick, with new seeds or new words.
- Cut out and shrunk with `scripts/game_art.py bonkers tidy` (rembg).

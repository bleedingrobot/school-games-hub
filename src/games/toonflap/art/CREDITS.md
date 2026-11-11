# Toon Flap art

Every picture here was painted for this game in ComfyUI on James's gaming PC (Z-Image Turbo), from the prompts in
`scripts/toonflap-art.py`, in November 2026. Each level borrows the *look* of a well-known cartoon style, described in
words only (docs/TOON-FLAP-ART-PLAN.md section 1a). No show, studio or character is named in any prompt; no screenshots,
fan art or show-trained models were used as inputs; every character and building is our own design.

Chosen tries: `docs/toonflap-art/picks.json`. Raw tries: `~/dragon-art-inbox/toonflap-art/` on James's Mac.
Remake: `python3 scripts/toonflap-art.py paint OUT_DIR <names>`, then `~/.cache/rembg-venv/bin/python scripts/toonflap-art.py tidy --force`.

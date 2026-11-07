# Parrot's See-saw pictures

The pictures are painted in plasticine clay style on the gaming PC (ComfyUI) with `python3 scripts/game_art.py parrot paint`, then tidied with `scripts/game_art.py parrot tidy`. The prompts are in `docs/parrot-art/config.json` and the chosen tries in `docs/parrot-art/picks.json`. Painted files are in `paint/` here, and the home card is `src/assets/home/parrot.webp`.

The see-saw plank (the left half of one painting, mirrored) and the home background (the top of one painting, faded into grass) were edited from a painting before tidying. Numbers, weights and the equals sign are always drawn in code over the pictures. The stand-ins drawn in code in `../art.tsx` stay as a fallback for any picture that is missing.

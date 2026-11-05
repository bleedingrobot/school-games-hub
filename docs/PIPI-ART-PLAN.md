# Pipi's Hidden Shells — clay art plan

James, 4 Nov 2026: remake Pipi's art "in the style of the other foundational skills", so it matches Beanstalk, Hop and
Penguin Pairs (clay). The game went live with paper cut-out paintings (PR #193); those stay in the game until the clay
set is painted and tidied over them. Same 32 picture names, same sizes, same seeds, so nothing in the game code changes.

`scripts/pipi-art.py` now paints style `c` (the Beanstalk clay words) into `~/dragon-art-inbox/pipi-art/set/c/`, and
`tidy` reads `docs/pipi-art/picks-clay.json`. The old paper tries stay in `set/b/` and `picks.json` for reference.
The metal shells use Beanstalk's foil wording ("wrapped in shiny crinkled foil"), because clay asked to be metal comes
out matt. The page's shadows are soft (clay) instead of the hard paper edge (`--pp-paper` in `pipi.css`).

## Pictures (32)

| Group | Names | Notes |
| --- | --- | --- |
| Pipi | `pipi/pipi-sit`, `-dig`, `-pop`, `-wave` | cream and pink wedge shell with big eyes and a pink foot |
| Friends | `friends/{pipi,korora,tuatara,weta,kiwi,tui}-{wait,cheer,wave}` | each in its own coloured knitted scarf |
| Shells | `shells/shell-sand`, `-bronze`, `-silver`, `-gold` | the number is drawn on top in code, so the middle stays plain |
| Things | `things/pearl`, `things/pearl-cushion` | the Golden Pearl prize |
| Backs | `back/morning`, `back/afternoon`, `back/sunset` | calm sand across the lower half for the frame and shells |
| Home card | `home/card` | goes to `src/assets/home/pipi.webp` (+ `-small`), Marble Rush card style |

## Painting steps (this evening, on the Mac via Remote Control, ComfyUI on the gaming PC)

1. Check ComfyUI is up: `curl http://100.97.96.115:8188/system_stats` (Tailscale).
2. Style check first: `python3 scripts/pipi-art.py paint ~/dragon-art-inbox/pipi-art/set pipi/pipi-sit shells/shell-gold back/morning --tries 2`.
   Look at them beside `src/games/beanstalk/art/paint/` and Penguin Pairs; they should read as the same clay world.
3. Paint the rest: `python3 scripts/pipi-art.py paint ~/dragon-art-inbox/pipi-art/set --tries 2`.
4. Pick the best try of each into `docs/pipi-art/picks-clay.json` (`{"name": try}`, all 32). Check: numbers' middle
   plain on the shells, silver reads silver (not white), kiwi beak long, no writing anywhere.
5. Tidy over the paper set: `~/.cache/rembg-venv/bin/python scripts/pipi-art.py tidy --force`.
6. `npx vitest run src/games/pipi`, look at the game on a phone and a laptop size, commit, push, merge (goes live on merge).

## Rules for the prompts

- Positive wording only: the model draws whatever is named.
- No numbers or writing in any picture.
- Sprites on plain white so rembg can cut them out.
- Gold foil: say "metallic gold", not "yellow gold" (yellow comes out as yellow clay). Kiwi: "seen from the side", head low on the body, or it grows a neck.

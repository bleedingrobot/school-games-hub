# Circuit Racer: art plan

*Written 23 Nov 2026 from section 6 of [CIRCUIT-PLAN.md](CIRCUIT-PLAN.md) (the painting half of Stage 5). Painted the same day on the gaming PC (ComfyUI).*

**Status: all 24 pictures painted 23 Nov 2026 and tidied into `src/games/circuit/art/` (picks in [circuit-art/picks.json](circuit-art/picks.json)). Not wired into the screens yet:** Stage 3 (maths) was changing `CircuitGame.tsx`, `RaceScreen.tsx`, `renderer.ts` and `circuit.css` at the same time, so the wiring is Stage 5 proper (list below). Words, sizes and file names for every picture are in [circuit-art/config.json](circuit-art/config.json).

## The one rule

The game works with **drawn art** (three.js tiles, chips, cables, racer and sparks; Volt as an SVG). That stays as the fallback for good: a picture that is missing or still downloading never stops a race. The paintings set the mood behind and around the code-drawn road.

## Look

Our own look: a glowing neon circuit-board world inside a giant computer. Deep navy and black, electric cyan, green and gold light, soft bloom, clean shapes, cinematic, painterly digital art. **No text, letters, numbers or logos.** Nothing from SkyRoads or OpenRoads (no roads, art, names or colours of theirs).

| World | Colours |
|---|---|
| Motherboard | deep green board, gold traces, cyan data sparks |
| Graphics Card | hot red and orange, spinning fans, RGB strips |
| Memory Lanes | blue and silver RAM towers |
| The Cloud | white and cyan clouds, sunrise gold |
| Quantum Core | purple and gold, shimmering, glitchy |

## The pictures (24)

All go under `src/games/circuit/art/paint/` unless said. Found by file name, no import lines needed until they are wired.

| Group | How many | Kind | Painted at | Files | Used for |
|---|---|---|---|---|---|
| World backdrops | 5 | scene | 1536 × 864 | `worlds/<world>.webp` (1600) + `-800.webp` | far background behind each world's roads (blurred, slow parallax) |
| World map | 1 | scene | 1536 × 864 | `map/map.webp` + `-800` | the road picker, full window |
| Finish paintings | 5 | scene | 1536 × 864 | `finish/<world>.webp` + `-800` | finish screen per world |
| Dashboard frame | 1 | icon (kept whole) | 1536 × 384 | `dash/frame.webp` + `-small` | painted dash; the code-drawn gauges sit over its three round recesses and middle screen |
| Tile textures | 6 | texture (seamless, blended) | 1024 × 1024 → 512 | `tiles/<tile>.webp` | `trace`, `overclock`, `resistor`, `short`, `gel`, `recharge` road tiles |
| Racer portraits | 4 | icon (dark background) | 768 × 768 → 768 + 256 | `racers/<racer>.webp` + `-small` | racer picker |
| Volt the guide | 1 | cut-out | 768 × 768 → 512 | `volt/volt.webp` | the guide on the dashboard |
| Home card | 1 | card | 1216 × 688 → 1600 + 800 | `src/games/circuit/art/card/circuit.webp` + `-small` | hub home card |

World ids: `motherboard`, `gpu`, `memory`, `cloud`, `quantum` (in world order).

**Racers** (names are ours; the unlock order is a suggestion for Stage 5): **Spark** (cyan, from the start), **Pixel** (green blocks, opens with the Graphics Card), **Byte** (gold, Memory Lanes), **Quark** (purple and gold orb, The Cloud). The racer in a race stays the code-drawn 3D one; Stage 5 can tint it to match the chosen portrait.

**Tiles:** `trace`, `short` and `gel` are blended so the edges wrap. `overclock` and `recharge` are regular patterns, so they are cropped to an exact number of repeats instead (blending doubled the arrows): they come out 451 × 512 and 512 × 503, so set the texture's repeat by its own size. `resistor` is mirrored 2 × 2 (hazard chevrons). Overclock arrows point to the top of the picture (forward along the road).

**Why some kinds differ from section 6:** the racer portraits and dashboard are kept whole on their dark painted background (`icon`), because neon glow does not cut out cleanly from white. Volt is a cut-out (painted on white) so it can sit on any dash.

## Wiring left for Stage 5 proper

Not done in the art PR, because the Stage 3 session owned these files:

1. `renderer.ts`: world backdrop as a far plane or CSS layer behind the canvas (blurred, slow parallax, `-800` on small screens); tile textures mixed into the code-drawn tile materials (keep the neon rims and bloom; fall back to `textures.ts` if a picture is missing).
2. World map screen: `map/map.webp` full window under the road dots.
3. Finish screen: `finish/<world>.webp` behind time, medal and stars.
4. Dashboard: `dash/frame.webp` behind the battery, signal and speed gauges (line the gauges up with its three recesses and middle screen).
5. Racer picker: `racers/*.webp` (and Volt pointing at locked ones).
6. Volt: swap the SVG in `Volt.tsx` for `volt/volt.webp`, keep the SVG as fallback.
7. Home card: Stage 6 (the code switch PR) moves `art/card/circuit.webp` and `circuit-small.webp` to `src/assets/home/`. `src/games/art.test.ts` fails if a switched-off game has a home card picture there, so it waits.

## If a picture needs remaking

1. On the gaming PC: `python scripts/game_art.py circuit paint ~/dragon-art-inbox/circuit-art <name> --tries 4` (check with `--dry-run`).
2. Write the chosen try in `docs/circuit-art/picks.json`.
3. `~/.cache/rembg-venv/Scripts/python scripts/game_art.py circuit tidy --force` writes the `.webp` files.

## Rules for the prompts

- The style words are in `styles` in the config and go in front of every prompt: `neon` (scenes), `tile`, `portrait`, `cutout` (Volt), `dash`, `card`.
- Scenes keep a calmer, darker band across the middle and bottom, so the glowing road and the words on top stand out.
- Never put in a real game's or show's characters, names or logos. Suitable for children aged 8 to 11: bright, exciting, friendly.

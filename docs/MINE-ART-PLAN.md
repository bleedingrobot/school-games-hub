# Mine Runner: art plan

*Written 13 Nov 2026 with [plans/mine-flight/PLAN.md](plans/mine-flight/PLAN.md) stages M4–M5. James paints final art on his gaming PC (ComfyUI) in the evening; the game runs on code colours until then, and they stay as the fallback.*

**Status: all six rock textures painted and live (13 Nov 2026).** Tiled with the script's `blend` mode (no mirror pattern). Weakest: coal (rock-4) still reads as stacked layers; rock-1/3/6 are cobble-ish. Repaint any one with `paint OUT rock-N --tries 4 --force`, pick, then `tidy --force`.

## What the game already draws in code (M4, live)
Lit block rock in each mine's colours, warm lantern glow in rooms, glowing crystals in each mine's colour (pounamu green, gold, embers, lava), a glow-worm ceiling in the glow-worm caves (a few elsewhere), dust in the headlamp, bloom on bright things, and a chase-camera ship. All in `src/games/mine/renderer.ts`, `decor.ts`, `walls.ts`, `palette.ts`.

## Stage A: rock textures (ready to paint)
Six seamless rock pictures, one per mine, `kind: texture`, mirrored 2×2 so they tile, saved as `src/games/mine/art/rock/<1-6>.webp` (1024 px). `art/art.ts` finds them by name; `renderer.ts` lays one repeat every 4 blocks on every face, tinted by the mine's room/tunnel colours.

| # | Mine | Picture |
|---|---|---|
| 1 | Greenstone Hollow | grey-green rock with pounamu veins |
| 2 | Otago Diggings | sandy gravel and clay, gold dust |
| 3 | Coromandel Gold Tunnel | cut quartz rock, gold specks |
| 4 | West Coast Coal Seam | layered coal and shale |
| 5 | Glow-worm Caverns | damp blue-grey limestone |
| 6 | Volcanic Deep | dark basalt, glowing cracks |

Prompts are in `docs/mine-art/config.json` (style "rock"). Check: `python3 scripts/game_art.py mine paint OUT --dry-run`. Paint 2 tries each, record picks in `docs/mine-art/picks.json`, then a thread runs `tidy` and checks the look (if the tint makes a mine too dark or too bright, change `wallMaterial.color.setScalar(1.7)` in `renderer.ts`).

## Later (not wired yet)
- Level picker cards (one painted scene per mine, `kind: scene`).
- Robot and ship skins (painted textures on the code-made shapes).
- Daylight shafts with a painted sky (draw-only).

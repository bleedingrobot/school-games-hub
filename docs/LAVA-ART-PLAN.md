# Floor is Lava: art plan

**The game draws stand-ins until each painting arrives. Nothing waits on art.** `painted(folder, file)` in `src/games/classlive/paintedArt.ts` returns null for a missing picture and the drawn version shows. Painted pictures go in `src/games/classlive/art/paint/<folder>/<file>.webp` (scenes also get `<file>-800.webp`).

Style: *bold storybook illustration, rich colour, warm light, painterly digital art, no text*. Every prompt is in `docs/lava-art/config.json` (34 pictures, same fields as `docs/corners-art/config.json`). Painted on James's PC (JamesGaming, `C:\Users\Giant\Games Hub`) in ComfyUI, driven by Remote Control; the thread fetches the files itself:

- `python3 scripts/game_art.py lava paint ~/dragon-art-inbox/lava-art/set --tries 3` (check first with `--dry-run`)
- Picks go in `docs/lava-art/picks.json`; `~/.cache/rembg-venv/bin/python scripts/game_art.py lava tidy` writes the `.webp` files (rembg for cut-outs).
- Add a `CREDITS.md` in each new art folder (`lava`, `lava-fx`) and keep `src/games/art.test.ts` green.

## Pictures (path under `src/games/classlive/art/paint/`)

| File | Kind | Size | Used for |
|---|---|---|---|
| `lava/lake-volcano`, `-dragon`, `-forge`, `-planet` | scene | 1536 × 1536 | the lava under the floor (LavaBoard), even all over, nothing floating |
| `lava/tile-<map>` | scene | 1024 × 1024 | one rock tile texture, repeated on all 64 tiles; the glow and cracks are drawn in code |
| `lava/raft-<map>` | cut | 512 | the raft panel on the big screen (log raft, bone raft, iron cauldron-boat, rescue pod) |
| `lava/back-<map>` | scene | 1536 × 864 | backdrop behind the floor (big screen and pad) |
| `pick/lava` | scene | 1536 × 864 | Class Live picker card |
| `lava-fx/<map>-bubbles`, `-crust`, `-fireball` | cut | 512 | map mechanics, names from `LAVA_WORDS` |
| `lava-fx/power-boots`, `-freeze`, `-speed`, `-double`, `-rope` | cut | 512 | the 5 `LAVA_POWERS` |

Total 34: 4 lakes, 4 tiles, 4 rafts, 4 backdrops, 1 pick, 12 mechanics, 5 powers.

## Notes

- Backdrops: say "an empty open middle with nothing in it" (Four Corners lesson) so ComfyUI doesn't paint a board or grid there; the floor is drawn on top.
- Lakes and tiles must look the same all over (they are textures). If a lake paints a shore or rocks, repaint rather than crop.
- Dragon's Lair: friendly, not scary (sleepy cartoon dragon, cartoon bones).
- Prompt fixes go here after the first run.
- First run (25 Nov): the tiles said "a square slab", so ComfyUI painted one slab on a background. Now they say "a seamless close-up texture of rough … rock … covers the entire picture right out to every edge and corner, no slab outline" (+ negative slab, tile edge, outline, background). tile-forge (riveted plate) was fine as it was.
- lake-forge painted molten metal in a pan/crucible with a rim. Reworded twice: now "a seamless repeating texture of flowing … molten metal, long wavy streaks … no whirlpool, no spiral, no centre, no container, no rim" (+ negative pot, crucible, rim, whirlpool, spiral, dark corners).
- dragon-crust gold coins came out stamped with letters and $ signs: now "plain smooth gold coins with blank faces and no markings".
- power-rope ring buoy had a logo-like emblem in its middle: now "a plain red and white striped ring buoy with an empty hole in the middle".

## Music (later)

One looping track per map, moods `lava-volcano`, `lava-dragon`, `lava-forge`, `lava-planet` (and `-hot` for the last minute). Until then `classLiveTrack` falls back to `boss` / `boss-hot`. Same CREDITS.json format as Four Corners.

# Four Corners: art plan

**The game draws stand-ins until each painting arrives. Nothing waits on art.** `painted(folder, file)` in `src/games/classlive/paintedArt.ts` returns null for a missing picture and the drawn version shows. Painted pictures sit in `src/games/classlive/art/paint/<folder>/<file>.webp` (scenes also get `<file>-800.webp`).

Style: *bold storybook illustration, rich colour, warm light, painterly digital art, no text*. Every prompt is in `docs/corners-art/config.json` (41 pictures, same fields as `docs/showdown-art/config.json`). Painted on James's PC in ComfyUI:

- `python3 scripts/game_art.py corners paint ~/dragon-art-inbox/corners-art/set --tries 3`
- Picks go in `docs/corners-art/picks.json`; `~/.cache/rembg-venv/bin/python scripts/game_art.py corners tidy` writes the `.webp` files (rembg for cut-outs: transparent, painted on plain white).
- Check first with `--dry-run`. Keep `src/games/art.test.ts` green (use `NOT_PAINTED_YET` for anything not yet painted).

## Pictures (path under `src/games/classlive/art/paint/`)

| File | Kind | Size | Used for |
|---|---|---|---|
| `corners/map-snow`, `map-jungle`, `map-castle`, `map-space` | scene | 1536 × 1536 (square) | board backdrop. Red top-left, blue top-right, green bottom-right, yellow bottom-left, open calm middle. Players, hazards, items drawn on top. |
| `corners/jail-snow`, `jail-jungle`, `jail-castle`, `jail-space` | scene | 1536 × 512 (wide strip) | jail strip: igloo, vine cage, dungeon, space brig (`MAP_WORDS[map].jail`) |
| `pick/corners` | scene | 1536 × 864 | Class Live picker card (same as `pick/stars`, `pick/serpent`, `pick/mural`; NOT in folder `corners`) |
| `corners-fx/power-shield`, `power-speed`, `power-key`, `power-crystal`, `power-jump`, `power-double`, `power-ghost` | cut | 512 × 512 | the 7 `POWERS` (shared/classlive/corners.ts) |
| `corners-fx/snow-storm`, `-ice`, `-hole`, `-roller`, `-teleport` and the same for `jungle-`, `castle-`, `space-` | cut | 512 × 512 | hazard markers: names follow `MAP_WORDS` (snow: Blizzard, Ice patch, Cracked ice, Giant snowball, Ice portal; jungle: Sandstorm, Mud slide, Quicksand, Rolling boulder, Vine swing; castle: Ghost mist, Slippery moss, Collapsed floor, Rolling barrel, Magic mirror; space: Meteor storm, Zero-g zone, Black hole, Rolling asteroid, Warp pad). Fog and gate are drawn in code. |
| `corners-fx/dice-red`, `-blue`, `-green`, `-yellow`, `-star` | cut | 512 × 512 | dice faces (star = the lucky roll) |

Total 41: 4 maps, 4 jails, 1 pick, 7 powers, 20 hazards, 5 dice.

## Notes

- Maps: no characters, nothing in the middle, no writing; corner colours must be clear from the back of the room. If a map comes out with weak corners, repaint with the colours stronger (e.g. "huge" roofs) rather than editing.
- Castle: spooky but friendly for ages 7-11 (cute candles, purple moonlight, no gore).
- Cut-outs are painted on plain white then made transparent. Check edges of glows (storm, portal, black hole) on a dark and a light background; hazards are drawn top-down and may be shown semi-transparent in code.
- Dice faces: a plain single pip or star; the code draws the corner colour label and tumbling.
- Prompt fixes go here after the first run, as in the other plans.
- First run (25 Nov 2026, 3 tries each): `space-ice` (Zero-g zone) painted a big "0" every time, so its words now say "anti-gravity zone" instead of "zero-g". `jungle-teleport` (vine swing) kept white inside the ring after rembg; its near-white was made see-through by hand after tidy, so redo that if it is re-tidied with `--force`.

## Music to find later (not yet fetched)

One looping CC0 upbeat chase track per map from OpenGameArt: snow, jungle, castle, space. The cloud blocks opengameart.org, so fetch on James's PC via Remote Control into the `classlive-music-inbox` branch as before. Files `src/games/classlive/music/<mood>.ogg` (+ `.mp3`), moods `corners-snow`, `corners-jungle`, `corners-castle`, `corners-space` (check the exact names Stage 2 uses). Add an entry per track to `src/games/classlive/music/CREDITS.json` in the existing format: `mood`, `file`, `title`, `author`, `source_url`, `licence` ("CC0"), `notes` (used whole or cut, loudness -18 LUFS, 96 kbps, 44.1 kHz, length). Search ideas: snow = upbeat sleigh or winter adventure; jungle = bongo, tribal chase; castle = playful spooky/Halloween chase; space = fast synth chase. Check the licence on each page is CC0 (not CC-BY).

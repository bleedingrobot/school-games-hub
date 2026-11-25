# Colour Clash: art plan

**The game draws stand-ins until each painting arrives. Nothing waits on art.** `painted(folder, file)` in `src/games/classlive/paintedArt.ts` returns null for a missing picture and the drawn version shows. Painted pictures sit in `src/games/classlive/art/paint/<folder>/<file>.webp` (scenes also get `<file>-800.webp`). Paint splats and tile colours are drawn in code, so no splat pictures are needed.

Style: *bold storybook illustration, rich colour, warm light, painterly digital art, no text*. Every prompt is in `docs/clash-art/config.json` (36 pictures, same fields as `docs/corners-art/config.json`). Painted on James's PC in ComfyUI:

- `python3 scripts/game_art.py clash paint ~/dragon-art-inbox/clash-art/set --tries 3`
- Picks go in `docs/clash-art/picks.json`; `~/.cache/rembg-venv/bin/python scripts/game_art.py clash tidy` writes the `.webp` files (rembg for cut-outs: transparent, painted on plain white).
- Check first with `--dry-run`. Keep `src/games/art.test.ts` green (use `NOT_PAINTED_YET` for anything not yet painted).

## Pictures (path under `src/games/classlive/art/paint/`)

| File | Kind | Size | Used for |
|---|---|---|---|
| `clash/map-park`, `map-rooftops`, `map-beach`, `map-space` | scene | 1536 × 1536 (square) | the floor of the 24 × 24 paint board. Plain, bright, low detail, one even colour, no splats, no grid, nothing on it: team paint is drawn over it in code. |
| `clash/back-park`, `back-rooftops`, `back-beach`, `back-space` | scene | 1920 × 1088 | wide backdrop behind the board (Paint Park, Graffiti Rooftops, Splash Beach, Space Paint Lab). Calm empty middle, detail round the edges. |
| `pick/clash` | scene | 1536 × 864 | Class Live picker card (same as `pick/corners`; NOT in folder `clash`). There is no separate home card, as for Four Corners. |
| `clash/win` | scene | 1920 × 1088 | win screen: paint fireworks and confetti, empty middle for the podium |
| `clash-fx/power-brush`, `power-speed`, `power-mega`, `power-cross` | cut | 512 × 512 | the 4 `POWERS` (Big Brush, Speed Shoes, Mega Bomb, Rainbow Cross; shared/classlive/clash.ts) |
| `clash-fx/goo-<map>`, `slip-<map>`, `roller-<map>`, `fountain-<map>` for park, rooftops, beach, space | cut | 512 × 512 | hazard markers, names follow `MAP_WORDS`. park: Sticky mud, Wet paint, Paint roller, Fountain; rooftops: Tar puddle, Oil slick, Rolling barrel, Water tower; beach: Soft sand, Wet rocks, Beach ball, Rock pool; space: Gloop, Zero-g (painted as an anti-gravity ring), Rolling asteroid, Reactor. |
| `clash-fx/portal` | cut | 512 × 512 | the one portal picture used on every map (rainbow swirl) |
| `clash-fx/golden` | cut | 512 × 512 | golden tile (counts 3) |
| `clash-fx/team-red`, `team-blue`, `team-green`, `team-yellow` | cut | 512 × 512 | team banners (paint flags) for the lobby, scoreboard and count-up reveal |

Total 36: 4 maps, 4 backdrops, 1 pick, 1 win, 4 powers, 16 hazards, 1 portal, 1 golden, 4 team banners.

## Notes

- Maps (`map-*`): the board is drawn on top with team colours, so the floor must stay pale and even. If a floor comes out with detail or colour patches, repaint with "plain" stressed; do not edit.
- Backdrops: never say "a game board sits on top" in a backdrop prompt (Four Corners lesson: the painter draws the board). The prompts say "an empty open middle with nothing in it" instead.
- Zero-g: like Four Corners' "zero-g" problem (painted a big "0"), `slip-space` says "anti-gravity ring", not "zero-g".
- Cut-outs are painted on plain white then made transparent. Check edges of glows (portal, reactor, anti-gravity ring) on a dark and a light background; hazards are drawn top-down and may be shown semi-transparent in code. Team banners use only their own colour and white, so they stay readable for colour-blind pupils with the team name beside them (drawn in code).
- The splat sticker per team colour is drawn in code, not painted.
- Prompt fixes go here after the first run, as in the other plans.

## Music to find later (not yet fetched)

One looping CC0 upbeat track per map from OpenGameArt (park, rooftops, beach, space), fetched on James's PC as for Four Corners. Moods `clash-park`, `clash-rooftops`, `clash-beach`, `clash-space` (check the exact names stage 2 uses), with an entry per track in `src/games/classlive/music/CREDITS.json`.

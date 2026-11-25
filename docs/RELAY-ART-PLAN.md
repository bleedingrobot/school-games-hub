# Toon Flap Relay: art plan

**The game draws stand-ins until each painting arrives. Nothing waits on art.** `painted(folder, file)` in `src/games/classlive/paintedArt.ts` returns null for a missing picture and the drawn version shows (emoji icons, drawn bunting, the night sky). Painted pictures go in `src/games/classlive/art/paint/<folder>/<file>.webp` (scenes also get `<file>-800.webp`).

Style: *bold storybook illustration, rich colour, warm light, painterly digital art, no text*. Every prompt is in `docs/relay-art/config.json` (15 pictures, same fields as `docs/lava-art/config.json`). Painted on James's PC in ComfyUI, driven by Remote Control; the thread fetches the files itself:

- `python3 scripts/game_art.py relay paint ~/dragon-art-inbox/relay-art/set --tries 3` (check first with `--dry-run`)
- Picks go in `docs/relay-art/picks.json`; `~/.cache/rembg-venv/bin/python scripts/game_art.py relay tidy` writes the `.webp` files (rembg for cut-outs).
- Add a `CREDITS.md` in the new `relay` folder and keep `src/games/art.test.ts` green.

## Pictures (path under `src/games/classlive/art/paint/`)

| File | Kind | Size | Used for |
|---|---|---|---|
| `relay/back` | scene | 1536 × 864 | backdrop behind the lanes (big screen) and the helpers' iPads |
| `pick/relay` | scene | 1536 × 864 | Class Live picker card, setup card, How to play |
| `relay/bunting` | cut | 1536 × 256 | the flags along the top of every lane (`relayDraw.ts`), repeated sideways |
| `relay/fx-shield`, `-wide`, `-slow`, `-tailwind`, `-magnet`, `-ghost`, `-mini`, `-clear` | cut | 512 | the 8 perks (`FxIcon`: iPad buttons, lane chips, toasts, How it works) |
| `relay/fx-wind`, `-fog`, `-wall`, `-narrow` | cut | 512 | the 4 troubles |

Total 15: 1 backdrop, 1 pick, 1 bunting, 12 effect icons.

## The Stadium Sky (later, bigger job)

James picked "one new relay stadium sky" for the lanes. The lanes are drawn by Toon Flap's own renderer, so a new sky means a new Toon Flap world (its layered backdrop, wall posts and ground, the way `docs/TOONFLAP-ART-PLAN.md` paints worlds 1 to 5) plus `RELAY_DEF.n` in `shared/classlive/relay.ts` pointing at it. Until then the lanes use world 1 (Toon Garden) with the bunting on top. Do it as its own stage after the 15 pictures above.

## Notes

- Backdrop: say "an empty open middle with nothing in it" (Four Corners lesson); the lanes cover most of it.
- Bunting must run edge to edge in a straight line so it can repeat; if it curves or droops, repaint rather than crop.
- The perk icons read green and the troubles red in the game (the chips' colours), so the pictures themselves can be any colour.
- Prompt fixes go here after the first run.

## Music (later)

One looping track, moods `relay-stadium` and `relay-stadium-hot` (last minute), a bouncy sports-day march. Until then `classLiveTrack` falls back to `skyclimb` / `skyclimb-hot`. Same CREDITS.json format as Four Corners.

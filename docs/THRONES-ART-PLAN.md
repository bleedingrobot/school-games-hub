# Musical Thrones: art plan

**The game draws stand-ins until each painting arrives.** `painted(folder, file)` (src/games/classlive/paintedArt.ts) returns null for a missing picture. Prompts: `docs/thrones-art/config.json` (39 pictures). Paint on James's PC as Four Corners (docs/CORNERS-ART-PLAN.md): `python3 scripts/game_art.py thrones paint ~/dragon-art-inbox/thrones-art/set --tries 3`, picks in `docs/thrones-art/picks.json`, then `tidy`.

| File (under `src/games/classlive/art/paint/`) | Kind | Size | Used for |
|---|---|---|---|
| `thrones/back-castle`, `back-ice`, `back-jungle`, `back-pirate` | scene | 1920 × 1088 | page backdrop on both screens |
| `thrones/hall-<hall>` | scene | 1536 × 1536 | the square floor the game is drawn on (no thrones painted in it) |
| `thrones/court-<hall>` | scene | 1536 × 512 | courtyard strip below the hall |
| `pick/thrones` | scene | 1536 × 864 | picker card |
| `thrones-fx/throne`, `throne-gold`, `tile` | cut | 512 | thrones and the dance tile |
| `thrones-fx/power-steal`, `-shield`, `-speed`, `-ear`, `-double`, `-seat`, `-ghost` | cut | 512 | the 7 power-ups |
| `thrones-fx/<hall>-storm`, `-ice`, `-roller`, `-teleport` | cut | 512 | hazards (names in `HALL_WORDS`) |

## Music

Per hall, a calm and a "-hot" looping dance track: `src/games/classlive/music/thrones-castle.mp3`, `thrones-castle-hot.mp3`, and the same for `ice`, `jungle`, `pirate`. Made on James's PC with ACE-Step like the other Class Live tracks (prompts in `music/MAKING.json`). They must be bouncy party music with no long quiet intro, because the track restarts every round and is cut dead when the music stops. Until they exist, halls borrow boss, skyclimb, serpent and island.

## Notes

- First run (25 Nov 2026, 3 tries each, picks in `docs/thrones-art/picks.json`).
- `hall-*`: every try painted chairs or thrones round the edges (naming "no chairs, no thrones" in the prompt drew them in). The prompts now describe only a flat floor texture filling the picture edge to edge, with seats, benches, barrels, walls and pillars in the negative. The repaints have no furniture; the castle carpet has a little perspective.
- `tile` painted a disco ball every time; its prompt now asks for a flat square glass-panel dance tile ("not a ball, not a sphere").
- `pirate-storm` (sea spray) painted orange balls and once a block with a "1"; its prompt now asks for a crashing wave of foam, with ball/sign/numbers in the negative.
- `jungle-teleport` had a rope running off the top edge; its prompt now asks for a closed vine ring with nothing hanging from it.
- `ice-teleport` and `jungle-teleport` kept white inside the ring after rembg; the near-white centre was made see-through by hand after tidy, so redo that if they are re-tidied with `--force`.

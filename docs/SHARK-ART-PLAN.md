# Shark Bay: art plan

**The game draws stand-ins until each painting arrives.** `painted(folder, file)` (src/games/classlive/paintedArt.ts) returns null for a missing picture. Prompts: `docs/shark-art/config.json` (46 pictures, same layout as docs/corners-art/config.json). Paint on James's PC: `python3 scripts/game_art.py shark paint ~/dragon-art-inbox/shark-art/set --tries 3`, picks in `docs/shark-art/picks.json`, then `scripts/game_art.py shark tidy`.

| File (under src/games/classlive/art/paint/) | Kind | Size | Used for |
|---|---|---|---|
| `shark/map-lagoon`, `map-reef`, `map-pirate`, `map-icy` | scene | 1536² | board: a round bay, jetty in the middle, open empty water (quarters, ropes, boats drawn in code) |
| `shark/back-<bay>` | scene | 1920 × 1088 | big screen and pad backdrop, empty open middle |
| `shark/cave-<bay>` | scene | 1536 × 512 | the Shark's Cave strip (jail) |
| `pick/shark` | scene | 1536 × 864 | Class Live picker card and How to play |
| `shark-fx/power-<power>` | cut | 512² | the 7 power-ups (Shark cage, Dolphin dash, Rescue ring, Periscope, Jet ski, Pearl, Ink cloud) |
| `shark-fx/<bay>-storm`, `-ice`, `-roller`, `-teleport`, `-boat`, `-dock` | cut | 512² | hazards, boat and jetty per bay (`BAY_WORDS`) |
| `shark-fx/fin`, `shark-fx/shark` | cut | 512² | Chomper's fin circling, and the leap |

Notes: maps must have no boats, characters or writing; the quarter colours are drawn in code. Boats are seen straight down, pointing up (the code turns them). Chomper is goofy, never scary, no blood.

## Music

`shark-<bay>` and `shark-<bay>-hot` (calm run / strike), original ACE-Step tracks made on James's PC like Four Corners' (prompts in src/games/classlive/music/MAKING.json). Until they exist the game plays Four Corners' tracks.

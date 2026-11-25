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

`shark-<bay>` and `shark-<bay>-hot` (calm run / strike), original ACE-Step tracks made on James's PC like Four Corners' (prompts in src/games/classlive/music/MAKING.json). Made 25 Nov 2026 (take 2, seed 42424, for all eight).

## First run (25 Nov 2026, 3 tries each, picks in docs/shark-art/picks.json)

- `map-pirate` painted a pirate ship every time ("shipwreck on the shore"): that phrase is gone and "no ships, no shipwrecks" added.
- `map-icy` painted penguins every time ("a few cute penguins"), and still slipped one in after rewording to "a frozen winter bay" with penguins in the negative. The kept try had one small penguin on the corner ice, filled in by hand with the surrounding ice; redo that if it is re-tidied with `--force` from a new try.
- `cave-lagoon` put a realistic shark in the cave ("shark's cave" draws a shark despite "no characters"): all four caves now say "an empty friendly underwater sea cave" with sharks/fish in the negative.
- `power-shield` drew a toothy shark inside the cage: now "an empty glossy silver diving cage".
- Cut-out water hazards drift to brown wooden discs and rims: `lagoon-ice`, `reef-ice`, `pirate-ice` (was a galaxy), `icy-ice` (was a playground slide), `icy-roller`, `icy-teleport` and `lagoon-roller` (was a bullseye target) now say "only water, nothing solid" or similar, with wood/disc/rim/brown in the negative.
- `shark` (the leap) had rows of sharp teeth: now rounded blunt teeth, tongue out, googly eyes.
- `power-key` (rescue ring) kept white in its hole after rembg; the middle was made see-through by hand after tidy, so redo that if re-tidied with `--force`.
- `cave-icy` first came out as a plain rocky sea cave. Repainted (James asked, 25 Nov 2026) with a prompt that names ice walls, icicles and a snowy floor and bans rock, seaweed and sand.

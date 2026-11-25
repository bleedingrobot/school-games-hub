# Saboteur Crew: art plan

**The game draws stand-ins until each painting arrives.** `painted(folder, file)` (src/games/classlive/paintedArt.ts) returns null for a missing picture, and `CrewBoard`, `CrewScene`, `CrewPad` and `CrewHelp` fall back to emoji and a drawn factory floor. Prompts: `docs/crew-art/config.json` (30 pictures). Paint on James's PC as Four Corners (docs/CORNERS-ART-PLAN.md): `python3 scripts/game_art.py crew paint ~/dragon-art-inbox/crew-art/set --tries 3`, picks in `docs/crew-art/picks.json`, then `tidy`.

| File (under `src/games/classlive/art/paint/`) | Kind | Size | Used for |
|---|---|---|---|
| `crew/map-factory` | scene | 1536 × 1536 | the square factory floor the game is drawn on (no machines painted in it; the Canteen rug in the centre) |
| `crew/back-factory` | scene | 1920 × 1088 | page backdrop on both screens |
| `pick/crew` | scene | 1536 × 864 | picker card, How to play sheet |
| `crew-fx/machine-<key>` | cut | 512 | the 8 machines, working (keys: assembly, paint, boiler, sorter, battery, control, packer, recycler) |
| `crew-fx/machine-<key>-broken` | cut | 512 | the same machine sparking |
| `crew-fx/canteen` | cut | 512 | the meeting table in the middle |
| `crew-fx/drone` | cut | 512 | a voted-off pupil's helper drone |
| `crew-fx/power-boots`, `-camera`, `-toolkit` | cut | 512 | the 3 power-up crates |
| `crew-fx/role-crew`, `role-glitch` | cut | 512 | How it works page |
| `crew-fx/sparks`, `meeting`, `dark`, `belt` | cut | 512 | How it works page |

Machine positions are in `MACHINES` (shared/classlive/crew.ts): the floor painting must leave those spots and the centre clear, so its prompt asks for an empty floor with things only round the edges.

## Music

A calm and a "-hot" looping track: `src/games/classlive/music/crew-factory.mp3` and `crew-factory-hot.mp3` (hot plays while 3 or more machines spark). Made with ACE-Step like the other Class Live tracks; add the takes kept to `music/MAKING.json`. Until they exist the game borrows island.

- `crew-factory`: "playful friendly robot factory groove, bouncy synth bass, clanky metallic percussion, marimba, little robot bleeps, sneaky but cheerful, 116 bpm, instrumental, no vocals, video game soundtrack, kids game music, bright, friendly, loopable, steady tempo"
- `crew-factory-hot`: "urgent playful robot factory alarm groove, fast synth bass, pounding clanky drums, rapid marimba, alarm-like synth stabs, not scary, very energetic, starts immediately at full volume, 150 bpm, instrumental, no vocals, video game soundtrack, kids game music, loopable, steady tempo"

## Notes

- Nothing painted yet (25 Nov 2026).

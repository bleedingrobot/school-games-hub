# Glitches (was Saboteur Crew): art plan

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

A calm and a "-hot" looping track: `src/games/classlive/music/crew-factory.mp3` and `crew-factory-hot.mp3` (hot plays while 3 or more machines spark). Made with ACE-Step like the other Class Live tracks; add the takes kept to `music/MAKING.json`. The game borrows island if a file is missing.

- `crew-factory`: "playful friendly robot factory groove, bouncy synth bass, clanky metallic percussion, marimba, little robot bleeps, sneaky but cheerful, 116 bpm, instrumental, no vocals, video game soundtrack, kids game music, bright, friendly, loopable, steady tempo"
- `crew-factory-hot`: "urgent playful robot factory alarm groove, fast synth bass, pounding clanky drums, rapid marimba, alarm-like synth stabs, not scary, very energetic, starts immediately at full volume, 150 bpm, instrumental, no vocals, video game soundtrack, kids game music, loopable, steady tempo"

## Notes

- Painted 26 Nov 2026 on James's PC, 3 tries each; picks in `docs/crew-art/picks.json`.
- `map-factory` repainted: the first prompt painted machine-like boxes and robots inside the hazard border (right where `MACHINES` sit) and a table instead of a rug. New prompt describes only a seamless floor texture, a thin hazard border at the picture's edge and one round rug in the centre; machines, crates, pipes, furniture went into its negative. Kept try 3 (empty floor, rug just above centre).
- `back-factory` repainted: the first prompt put big robot characters in the foreground. New prompt says "empty hall with nobody inside" and robots/figures/faces are in the negative. Kept try 2.
- `belt` try 1 had a letter on it and try 2 painted a book; kept try 3 (a conveyor belt).
- `canteen`: rembg left white between the stools; large enclosed near-white areas were made see-through after tidy (cups and bowl kept).
- Music: `crew-factory` take 1 (seed 11117). Both `-hot` takes 1-2 opened quietly for several seconds, so takes 3 (31337) and 4 (77777) were made too; kept take 4, which starts at full volume. Fade-in is 0.05 s (no quiet intro). Whisper found no voices in any take.
- Repaint 26 Nov 2026 (branch `crew-art-repaint`), asked for by James:
  - All 8 `machine-<key>-broken` pictures: the first set didn't look like their working machines and had smoke puffs, star sparkles and (battery) green cells. New prompts are the working prompt word for word plus "broken and switched off, no green light: bright yellow-white electric sparks and zig-zag lightning zaps, one red warning light"; the battery's cells are "dark, flickering red and orange", and the recycler says "funnel hopper on a square box base, not a wheelie bin". Plain painting from words still changed the machines' shapes, so the kept pictures (try 4 in the inbox, `picks.json`) were painted over each machine's working picture in ComfyUI (img2img, denoise 0.85-0.92, same model and 8 steps); the config prompts are those words. Painting the config again with `game_art.py` gives word-only versions, not these.
  - `map-factory`: a more interesting flat floor plan: diamond-plate and riveted panels, yellow walkway ring with arrows, hatches, grates, teal/orange/purple zone squares, light pools, hazard border and the round rug in the exact centre (radius ~13%). Kept try 1 of a second batch whose prompt says "orthographic, like a floor plan, nothing beyond the floor" (the first 4 tries had walls and cabinets round the edges). Checked against every `MACHINES` spot and `CANTEEN`.
  - Note: the graph's negative is `ConditioningZeroOut` (cfg 1), so the config `negative` lists don't change the painting; only the prompt words do.
- Music recheck 26 Nov: `crew-factory-hot` take 4 was steady but ~170 bpm, not 150. Made takes 5 (seed 15015) and 6 (seed 60606); kept take 5: ~158 bpm, steady (155-160 in every 11 s window by librosa beat tracking), full volume from the start, no drop-outs, no vocals. Take 6 opened quietly.

# Class Showdown: art plan

Style: *bold storybook fantasy, rich colour, dramatic light, painterly digital art, no text*. Our own original creatures, not from any existing game. Every prompt and negative prompt is in `docs/showdown-art/config.json` (style key `s` for scenes and the card, `c` for cut-outs). Painted on the gaming PC with ComfyUI: `python3 scripts/game_art.py showdown paint ~/dragon-art-inbox/showdown-art/set [names] --tries 3`. Picks go in `docs/showdown-art/picks.json`; `tidy` (rembg for cut-outs) writes the `.webp` files into `src/games/showdown/art/` (cut-outs in the folder named in the config, e.g. `src/games/showdown/art/bosses/river-titan-1.webp`; scenes also get an 800 px copy). Home card: `src/assets/home/showdown.webp` (about 1600 px) and `showdown-small.webp` (about 640 to 800 px). Add `CREDITS.md` in the art folder and keep `src/games/art.test.ts` green (use `NOT_PAINTED_YET` for later-stage pictures until painted). Drawn stand-ins stay as the fallback.

## Paint order and pictures

Paint in this order. Stage 3 needs the first block, so do it first.

| Picture | Kind | Size | Used for | Stage |
|---|---|---|---|---|
| river-titan-1, -2, -3 | cut | 1536 × 1536 | River Titan, calm / angry / furious and broken | 3 |
| back-river-valley | scene | 1536 × 864 | behind the River Titan | 3 |
| fx-hit-burst, fx-shield-dome, fx-shield-crack, fx-heal-sparkles, fx-weak-spot, fx-daze-stars, fx-golden-flash | cut | 512 × 512 | hit numbers, shield, heal, weak spot, daze, golden question (copy Goblin Storm's painted fx idea) | 3 |
| lobby | scene | 1536 × 864 | "Join now!" screen | 3 |
| role-striker, role-guard, role-healer | cut | 768 × 768 | role picker on the iPad | 3 |
| banner-red, -blue, -gold, -green | cut | 768 × 1024 | team corners | 3/4 |
| controller-frame | scene | 1024 × 1536 | frame round the iPad question | 3 |
| victory, so-close | scene | 1536 × 864 | recap | 3 |
| badge-top-score, -last-hit, -longest-streak, -most-damage, -best-comeback, -shield-wall, -best-healer, -golden-moment, -most-careful, -hard-worker | cut | 512 × 512 | recap shout-outs (10 kinds) | 3 |
| storm-kraken-1..3, clockwork-colossus-1..3, comet-wyrm-1..3 | cut | 1536 × 1536 | the other 3 bosses, 9 paintings | 5 |
| back-stormy-sea, back-clock-tower, back-night-sky | scene | 1536 × 864 | their backdrops | 5 |
| card | card | 1600 × 900 | hub home card (`src/assets/home/showdown.webp` + `showdown-small.webp`) | 5 |
| back-gold-rush, gr-seam-gold, gr-seam-gem, gr-seam-rich, gr-cave-in | scene + cut | 1536 × 864 / 512 × 512 | Gold Rush map, seams, cave-ins | 6 |

Total 50 pictures: 12 bosses, 4 backdrops, lobby, 3 roles, 4 banners, 2 recap scenes, 10 badges, 7 fx, controller frame, Gold Rush map, 4 Gold Rush cuts, 1 card.

## Boss phases

Each boss has 3 paintings in the same pose and framing so the phase change can cross-fade: 1 calm and proud, 2 angry (glowing cracks, steam, lightning, flames), 3 furious and broken (chunks missing, sparks, one arm hanging). Never gory or frightening for children; the damage is cracks, dents and glow. Roster: River Titan of Riverstone (boulders and water), Storm Kraken (storm cloud and tentacles), Clockwork Colossus (brass and gears), Comet Wyrm (star-dust serpent).

## Cut-out notes

- Paint cut-outs on plain pure white, the whole subject visible with a margin, then `tidy` removes the background. Check hair-thin edges (tentacle tips, banner tassels, fx glows) against both a dark and a light background; glows may need the `max` size and a soft edge.
- Bosses: keep the same centring and feet position in all 3 phases; pick the closest match of phase 2 and 3 to phase 1 rather than the prettiest.
- Fx are drawn to sit on any colour; the team-coloured flash on iPad hits is tinted in code, so paint fx in neutral white-yellow-blue.
- Banners: emblem only, no letters. Team names, hit numbers, health bars, the question and answers are always drawn in code, never painted.
- Controller frame: paint the middle as flat pale parchment; the code lays the question panel on top.
- No pupil likeness: role portraits are generic cartoon heroes.

## Animation and sound (from the plan, section 7)

Names flying in, hit numbers bursting off the boss, screen shake on big hits, boss breathing and flinching, phase-change transform, shield dome with a crack, confetti finish, award cards flipping in; every iPad hit gets a small burst and a team-coloured flash. Projector sounds: boss roars and hits per boss, shield clang, heal chime, countdown drums, crowd cheer, victory fanfare.

## Announcer voice (Bella, `af_bella`)

Lines go in `src/games/showdown/voiceLines.ts` as `allVoiceLines()`, no pupils' names (names are shown, never spoken). Clips via `python3 -I scripts/voice-clips.py showdown`.

- "Join now!"
- "Three, two, one, fight!"
- "The boss is winding up! Shield up!"
- "Shield held!"
- "The shield broke!"
- "Weak spot!"
- "Golden question!"
- "The boss is changing!"
- "Thirty seconds!"
- "The boss is beaten!"
- "Time's up!"
- "So close!"
- Hub banner: "Class Showdown is starting! Join in!"

Team-winner lines such as "And the last hit goes to... Team Gold!" use only the team colour, composed from the same word function as the screen.

# Class Live: art plan

**Painted 24 Nov 2026 NZ (all 14, picks in picks.json).** Style: *bold storybook illustration, rich colour, warm light, painterly digital art, no text*. Every prompt is in `docs/classlive-art/config.json`. Painted on the gaming PC with ComfyUI: `python3 scripts/game_art.py classlive paint ~/dragon-art-inbox/classlive-art/set --tries 3`. Picks go in `docs/classlive-art/picks.json`; `tidy` writes the `.webp` files into `src/games/classlive/art/paint/` (scenes also get an 800 px copy) and the home card into `src/assets/home/classlive.webp` + `classlive-small.webp`. The code finds pictures by file name (`src/games/classlive/paintedArt.ts`), so a picture not painted yet falls back to the drawn stand-in.

| Picture | Kind | Size | Used for |
|---|---|---|---|
| mural-whale, -volcano, -castle, -rocket, -kiwi, -dragon, -lighthouse, -octopus, -treehouse, -pirate | scene | 1536 × 1024 (3:2, the 12 × 8 grid) | Mystery Mural's hidden pictures, on the projector and the pupils' guess cards |
| back-star-sky | scene | 1536 × 864 | Star Web's night sky, behind the drawn stars and lines |
| back-jungle-temple | scene | 1536 × 864 | Serpent Chain's temple, behind the drawn serpent |
| back-gallery | scene | 1536 × 864 | Mystery Mural's gallery, round the grid |
| card | card | 1216 × 688 | hub home card |

Notes:
- Mural pictures: the subject big and filling the frame with bright distinct colours everywhere, so a few flipped tiles already give a clue. No text, nothing frightening; the pirate ship has a plain flag.
- Backdrops are dark and calm in the middle: the stars, the serpent and the grid are drawn in code on top, with a dark wash so they stay readable from the back of the room.
- Star Web's creature stays line art (it is drawn by the class's constellation lines).

## Serpent makeover (24 Nov 2026 NZ)

James asked for a painted serpent and a better-looking Serpent Chain page. Nine more pictures were painted on the gaming PC (picks in picks.json):
`serpent/head-asleep`, `head-awake` (painted heads, crossfaded when the serpent wakes), `coil` (lobby), `tail` (the tip, behind the START tablet), `plate` (each box), `tablet` (START), `skin` (a pattern along the body), `burst` (a glow when it wakes and when someone reaches the head), and `back/jungle-awake` (the glowing temple that fades in when it wakes).
The page adds light shafts, drifting mist, fireflies, falling leaves, a gold "life" line that runs up the body as far as the furthest pupil, and a head that bobs (faster when awake). SerpentScene.tsx finds every piece with `painted('serpent', ...)` and falls back to the drawing for any piece that is missing.
Prompt fixes after the first run: no "dragon-like" on the sleeping head (it gave antlers), the tail says "no head, not a whole snake", and the awake temple says "no statues".

## Picker page (24 Nov 2026 NZ)

James asked for a painted picker page. Four more pictures in `pick/`: `hall` (the page backdrop, a games hall under a starry dome) and `stars`, `serpent`, `mural` (the picture across the top of each game card). Each card falls back to its game's `back/` picture if its own is missing. Hall prompt: say "no writing anywhere" (it painted big made-up titles in the sky otherwise). Sleeping serpent: describe the eyes as "gentle curved sleepy lines" and put open eyes, idols and carved faces in the negative list.

## 30 more mural pictures (24 Nov 2026 NZ)

James asked for way more Mystery Mural pictures. 30 more (40 in all), painted on the gaming PC: elephant, penguin, giraffe, lion, panda, dinosaur, unicorn, robot, balloon, train, submarine, helicopter, snowman, pyramid, windmill, cupcake, icecream, pizza, sunflower, cactus, butterfly, beehive, turtle, shark, owl, frog, tractor, fireengine, guitar, pumpkin. Each has a riddle in `CLUES` (shared/classlive/mural.ts). Fire engine prompt: "plain panels with no writing, numbers or badges" (it painted made-up lettering on the cab).

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

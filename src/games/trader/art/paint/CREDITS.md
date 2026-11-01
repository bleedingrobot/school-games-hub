# Star Trader pictures

The painted pictures in this folder were made for this game by James (the teacher who runs School Games Hub) with the
Z-Image Turbo image model in ComfyUI on their own PC, in October 2026, in the "Cinematic" style James chose on 27 Oct.
Each picture's prompt is saved inside the original PNG (kept on the homeserver in `~/dragon-art-inbox/trader-art`). They
were then shrunk, cut out and seam-blended with `scripts/trader-art.py` (ships were cut out with the open-source rembg
tool, run on the server only). They were not copied from any game, artist or art pack. The planet names are real; the
paintings are our own impressions.

`docs/trader-art/picks.json` records which try of each picture is used.

| Folder | What | Made |
|---|---|---|
| planets/ | A flat surface map (1024 × 512, left and right edges blended) for each of the 24 planets and Your moon, each with a 256 × 128 -small copy | 27 Oct 2026 |
| ships/ | The 6 trader ships and 3 pirates, side-on facing right and cut out (512 px), each with a 160 px -card copy | 27 Oct 2026 |

Where a picture isn't there, the game draws its own version in code (`src/games/trader/art/`).

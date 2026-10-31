# Star Trader: painted pictures plan

How Star Trader swaps its drawn-in-code art for paintings in the **Cinematic** style, made in ComfyUI on James's gaming PC. It follows the way Dragon Maths and Clan Quest were done (`docs/CLANS-ART-PLAN.md`), so most of the tools already exist.

Written 27 October 2026 for James.
**Status: G.0 under way (first batch of ships and planet maps being made). Nothing in the game uses paintings yet.** Branch `trader`.

## The short version

- **James chose the Cinematic style** (27 Oct) from five tries: https://claude.ai/artifact/Sjtog8qpxLevEsGUQ2iKTy. It is film concept art: hard starlight, scuffed and weathered metal. It is also the closest of the five to the gritty Dragon Maths look.
- **Everything with a picture gets painted:** the 24 planets and "Your moon", the 6 trader ships and 3 pirates, and about 16 backgrounds. That is about 50 paintings in all.
- **Planets still spin, and look better doing it.** Each planet is painted as a flat surface map. The game wraps it round a ball, so craters and storms curve over the edge as it turns (section 3).
- **Code keeps the movement:** warp, lasers, shields, sparks, explosions, engine flames, the starfield, and the star chart's grid. Fights stay animated.
- **Every painting is optional**, as in Clan Quest. A missing painting falls back to today's drawn version, so the paintings can go in one screen at a time.
- **One try of each picture** (James, 27 Oct). Claude checks each one, remakes only the bad ones, and shows James the set on a review page.

## 1. What gets painted

| Group | How many | Shape | Where it shows |
|---|---|---|---|
| Planet surface maps | 25 (24 planets + Your moon) | 2304 × 1152 flat map, wrapped round a ball in the game | Planet scene, star chart icons, planet cards, the moon screen |
| Trader ships | 6: Flea, Gnat, Firefly, Bumblebee, Beetle, Termite | Side-on, facing right, cut out | Planet scene, warp, fights, shipyard cards |
| Pirates | 3: scrappy, raider, captain (`ships.ts`) | Side-on, facing right, cut out | Fights |
| Backgrounds | about 16 | 2016 × 1152 wide | Behind each screen (below) |

**Backgrounds:** a market hall for each of the 9 governments (pirate haven, merchant guild, class vote, scientists' council, temple, peace garden, star navy, robot council, farming co-op), the shipyard, the bank, the title screen, buying your moon, customs, a friendly trader, the space junk field, and the escape pod after a wreck. The pirate fight happens in open space over the planet, so it uses the planet scene rather than a background of its own.

**Stays in code:** engine flames, damage smoke, shield ripples, laser bolts, sparks, explosions, tumbling cargo crates, warp streaks, the 3-layer starfield and nebula, planet rings, atmosphere glow, the day/night edge and city lights. The star chart's grid, axes and coordinates also stay in code: pupils read x and y off them, so they must stay crisp.

## 2. How the pictures get into the game

The same three parts as Clan Quest:

1. **`scripts/trader-art.py`**, a copy of `scripts/clans-art.py`. It reads `~/dragon-art-inbox/trader-art` and writes `.webp` files into `src/games/trader/art/paint/<group>/<name>.webp`.
   - **Ships:** white background removed with rembg (`~/.cache/rembg-venv`), trimmed, 512 px long plus a 160 px copy for cards.
   - **Planet maps:** the left and right edges are blended so the seam never shows as it turns, then saved at 1024 × 512 plus a 256 × 128 copy for the star chart.
   - **Backgrounds:** 1600 px wide, plus 800 px for phones.
   - About 8 MB in the repo; a screen only downloads what it shows.
2. **`src/games/trader/art/paint.ts`** looks a painting up by the game's own name (`shipArt('Beetle')`, `planetMap('Io')`) and returns nothing when it's missing. Pictures load in the background, and the drawn version shows until they arrive.
3. **`src/games/trader/art/paint.test.ts`** checks that every planet, ship, pirate and government has its painting, and that every painting is used.

Generating is done by `~/dragon-art-inbox/tools/trader-art.py` (groups `ships`, `planets`, later `scenes`). Each PNG carries its prompt, so any single picture can be remade by naming it.

## 3. Spinning planets

Today a planet's surface is a strip that slides sideways inside a circle. That reads as a flat picture moving rather than a ball turning.

**New:** the painted map is wrapped round a real ball.
- For each planet size, the game works out once which point of the map every pixel inside the circle shows (a lookup table).
- Each frame, it shifts the longitude and fills the circle from the table. Features near the edge squash and slow down, and features in the middle move fastest, the way a real globe looks.
- Code-drawn light still goes on top: the bright side, the soft edge into night, the atmosphere rim, city lights on busy worlds, and rings in front and behind. Clouds get a second, faster-turning painted layer where the planet has them (Earth, Venus, Titan).
- **Chromebook-safe:**
  - The big scene planet is about 250 px across, so roughly 200,000 pixels a frame from a ready-made table. It is redrawn at 30 frames a second at most, into its own small canvas.
  - "Simpler graphics" (switched on automatically when frames are slow) goes back to today's sliding strip with the painted map.
  - Reduced motion shows the planet still.
  - Star chart icons are drawn once, still.
- Measured on a slow-Chromebook setting in G.2 before anything else uses it.

## 4. Stages

Each stage ends with tests passing, screenshots for James (laptop and phone width), and a commit on `trader`. Nothing goes live until the game itself goes live (TRADER-PLAN T.7).

**G.0 First batch (Claude).** One try of the 9 ships and the 25 planet maps. Child-safety check, remake the bad ones, then a review page for James.

**G.1 Tidy-up script and loader (Claude).** `scripts/trader-art.py`, `paint.ts`, `paint.test.ts`, the cut-outs and sizes from section 2, `art/paint/CREDITS.md`. Nothing on screen yet.

**G.2 Spinning planets (Claude).** The ball-wrap in `art/planets.ts`, with the old strip as fallback. A preview page of all 25 planets turning, checked for speed. **James looks.**

**G.3 Ships (Claude).** Painted ships in the planet scene, warp and fights, with engine-flame, gun and shield points measured for each painting (a small table beside `MUZZLE` in `ships.ts`). Pirates painted in fights. Shipyard cards. **James looks at a fight.**

**G.4 Backgrounds (Claude, one try each, bad ones remade).** The ~16 backgrounds from section 1, then each screen's background in place behind the existing dark panels (which already meet 4.5:1 contrast).

**G.5 Checks.**
- Every painting has screen-reader text.
- Slow-Chromebook check: the first screen under 2 MB, no stutter in fights.
- Phone width (844 × 390) and keyboard only.
- The preview republished for James.

## 5. Notes

- **Children:** every painting is checked for 8 to 11 year olds before it goes in (pirates menacing but nobody hurt, no gore, people fully dressed).
- **Planet names are real** but the paintings are our own impressions, as the game already says on the star chart.
- **Known Z-Image limits:** it sometimes draws a globe when asked for a flat map, and it doesn't make left and right edges match. The tidy-up script blends the seam. A map that came out as a globe is remade.

## Credits to carry over

- Paintings made by James with Z-Image Turbo in ComfyUI, October 2026.
- Fallback art: drawn in code (`src/games/trader/art/`).

# Star Trader: painted pictures plan

How Star Trader swaps its drawn-in-code art for paintings in the **Cinematic** style, made in ComfyUI on James's gaming PC. It follows the way Dragon Maths and Clan Quest were done (`docs/CLANS-ART-PLAN.md`), so most of the tools already exist.

Written 27 October 2026 for James.
**Status: G.0 to G.3 done (1 Nov 2026); G.3 (painted ships) waits for James to look at a fight.** Branch `trader-art`, from `main` after Star Trader went live (the old `trader` branch is merged and gone).

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

Each stage ends with tests passing, screenshots for James (laptop and phone width), and a commit on `trader-art`. Star Trader is live now (TRADER-PLAN, "Went live"), so each screen's paintings go live when they merge: merge `origin/main` into `trader-art` at the start of each stage, and keep the drawn fallback working.

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

## 4a. Results

**G.0 (27 Oct 2026, on the homeserver):** one try of the 9 ships and the 25 planet maps, checked, bad ones remade (`docs/trader-art/picks.json` says which try and why), shown to James on the "Star Trader Paintings" page (https://claude.ai/artifact/8h2LBjDZ7chMHRgCxtkMQW). Tidied into `src/games/trader/art/paint/` (68 files, 1.3 MB) but never committed; brought over to `trader-art` on 1 Nov.

**G.1 (1 Nov 2026):** `src/games/trader/art/paint.ts` finds a painting by the game's own name: `planetMap('Io')` (and `planetMap(MOON)`), `shipArt('Beetle')`, `pirateArt(tier)` (0 scrappy, 1 raider, 2 captain, the order of `PIRATE_TIERS`), each with its small or card copy, and nothing when it's missing. `paint.test.ts` (6 tests): every planet, your moon, ship and pirate has its painting and copy; every file is a name the game uses and under its size (planets 120 KB, ships 60 KB); a missing name gives nothing. `art/paint/CREDITS.md` added. Nothing imports `paint.ts` yet, so nothing is downloaded. Typecheck, build and `test:all` (331 files, 5,781 tests) pass.

**G.2 (1 Nov 2026): spinning planets, waiting for James to look.**
- `art/globe.ts`: the lookup table (which map pixel each pixel of the ball shows; side-on view, north at the top, a quarter turn either side at the edges) and `spinGlobe`, which only shifts the longitude and copies pixels. `globe.test.ts` (5 tests): covers the circle and nothing else, middle and edges in the right place, squashed at the edge, turns left to right and once round comes back, never reads outside the map.
- `art/planets.ts`: once a planet's painting has downloaded (`loadPainting` in `paint.ts`), `drawPlanet` wraps it round the ball instead of sliding the drawn texture; the light, shade, rim glow, city lights and rings still go on top, but the drawn clouds and ice caps don't (the paintings have their own). Each ball is redrawn at most 30 times a second and reused in between; balls up to 128 px use the small map; nothing bigger than 512 px is worked out. **Simple graphics** slides the painted map the old way; **reduced motion** shows the ball still. Until a painting arrives, or if it can't be read, the drawn planet shows as before. Only the last 6 paintings keep their pixels (a full map is 2 MB of them).
- Star chart (`StarMap.tsx`): its icons are drawn once, so it downloads the small maps and draws the icons again when they arrive.
- **Speed** (Node, the same engine as Chrome, on a Mac): a scene planet on a sharp screen (375 px, 111,000 pixels) is 0.18 ms a turn, plus 4 ms once for its table; 250 px is 0.08 ms. Allowing 8× for a slow Chromebook, that is under 2 ms, at most 30 times a second. Not yet measured on a real Chromebook.
- **Looked at:** Earth, Jupiter, Saturn, Mars, Io and Your moon rendered through `globe.ts` at three turns: features curve and squash at the edge, Jupiter's spot turns away, and the map's join (in the middle at half a turn) doesn't show.
- **Preview:** `preview/trader/planets.html` (in `npm run trader:preview`): all 25 planets turning, switches for paintings on/off, simple graphics, reduced motion, ×10 spin, sizes (grid, scene, star chart), and a speed test. Published privately: https://claude.ai/artifact/PBdyxfVvP9RVqU9d4R5TZN
- **Merging this puts painted planets in the live game** (planet scene and star chart). Draft until James has looked.

James looked at the preview on 1 Nov and said it looks good.

**G.3 (1 Nov 2026): painted ships, waiting for James to look at a fight.**
- `art/ships.ts`: once a ship's painting has downloaded (`imageNow` in `paint.ts`), `drawShip` draws it instead of the drawn ship, in the planet scene, warp and fights. `PAINTED` holds what was measured on each painting (engine nozzles, the gun's tip, as shares of the painting's width) and how long it is drawn (Flea 90 up to Termite 130 units; pirates 104, 108, 124). The flames come out of the painted nozzles (blue for traders, red for pirates); the halo, pirate glow, hit flash and damage marks still go on top.
- Fights (`renderer.ts`): lasers start at each painting's gun (`muzzleOf`, mirrored for the pirate, who faces left) and the shield bubble fits the painted ship (`shieldOf`). Until a painting arrives, the old muzzle and bubble are used.
- Ship panel and shipyard (`Panels.tsx`, `trader.css`): the painting (full size in the ship panel, the 160 px card at 120 px in each shipyard row) instead of the drawn canvas when there is one.
- **Checked:** every measured point drawn on the paintings themselves (all on their nozzle or gun; the Flea's lower engine moved up once). A new test checks every ship and pirate has its points, on the painting, engines behind the gun. Typecheck, build and `test:all` pass.
- **Not checked in a browser** (the published preview needs a claude.ai sign-in the in-app browser doesn't have): the flames' size against each nozzle, lasers leaving the gun, and the shield bubble's fit. Preview with buttons for warp, shots, shields and explosions: https://claude.ai/artifact/CCBg81TjMxo5MjNQmqTDM3 (`preview/trader/art.html`).

**Next: G.4**, the ~16 backgrounds (to be painted first).

## 5. Notes

- **Children:** every painting is checked for 8 to 11 year olds before it goes in (pirates menacing but nobody hurt, no gore, people fully dressed).
- **Planet names are real** but the paintings are our own impressions, as the game already says on the star chart.
- **Known Z-Image limits:** it sometimes draws a globe when asked for a flat map, and it doesn't make left and right edges match. The tidy-up script blends the seam. A map that came out as a globe is remade.

## Credits to carry over

- Paintings made by James with Z-Image Turbo in ComfyUI, October 2026.
- Fallback art: drawn in code (`src/games/trader/art/`).

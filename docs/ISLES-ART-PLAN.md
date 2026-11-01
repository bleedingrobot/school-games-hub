# Sky Isles: art plan

*James chose **hand-painted anime** on 1 Nov 2026, from 10 styles painted side by side ([the try-out page](https://claude.ai/artifact/ULgc79JgvwemsydB8Qs2U8), `docs/ISLES-PLAN.md` S.L). Everything is painted in ComfyUI on James's gaming PC (Z-Image Turbo, the same graph as every hub painting) with `scripts/isles-art.py`. Tries go to `~/isles-art-inbox/art/`, never straight into the repo.*

## The style

**Every prompt starts with the same words:**

> Lush hand-painted anime background art in gouache and watercolour, soft fluffy clouds, warm nostalgic sunlight, gentle detailed scenery.

**Lessons from the try-outs:**
- The style is soft and busy. That's fine for backgrounds, but a whole island painted in one go can't grow.
- **So the island is built from pieces** (below), and every piece is painted alone on plain white so it can be cut out cleanly.
- The race try-outs got muddy watercolour blotches when there was too much in the picture. **Race and sky backgrounds stay simple:** clouds, light and a few far islands. The boats are separate pieces on top.

## How the island grows

1. **The island base** is painted at 5 sizes: Little (6 building spots), Growing (8), Big (10), Large (13) and Grand (16). Each base has a flat, grassy top with that many round bare-earth clearings joined by winding paths, and a rocky underside with roots and waterfalls. The game shows the base for the island's size. A clearing not yet claimed just shows as bare earth, with room to grow.
2. **Building pieces:** each kind of building is painted alone at each of its 3 levels, with no slab or patch of land under it, only a few tufts of grass at its foot, so it sits straight on a clearing. The game draws spot n on the base's clearing n, in the order the spots were claimed. A claimed spot with nothing built yet shows a marker post with a blank sign, rope and planks.
3. **Growth shows as bigger buildings.** Raising a building to level 2 or 3 swaps in a bigger, grander picture. There are far fewer, bigger things on the island, so it looks part of the sky and not stuck on.
4. **Spot positions** on each base are placed by hand once the bases are picked, and saved with the picks.
5. **The Lighthouse** stands at the back of the Grand Isle, in 4 stages.
6. **Drawn-in-code fallback:** coloured shapes in the same layout, used until a picture has loaded.

## The first batch (needed before the screens, stage S.L)

34 pictures, 3 tries each.

| Group | Pictures | Painted as | Used for |
|---|---|---|---|
| Island bases | `base-1` … `base-5` (6, 8, 10, 13, 16 spots), each with that many painted clearings joined by paths | 1344 × 768, one island on white, cut out | My island, the class sky |
| Buildings | `bld-farm-1` … `bld-farm-3`, and the same for mine, dock, house, workshop and library (6 kinds × 3 levels = 18) | 1024 × 1024, one building alone on white (no slab or land), cut out | My island |
| Empty spot | `bld-empty` (a marker post with a blank sign, rope and planks) | 1024 × 1024, cut out | A claimed spot not built on yet |
| Sky-boats | `boat-red`, `boat-blue`, `boat-yellow` | 1344 × 768, side-on facing right, cut out | Races, the dock, the sky |
| Pip the sky-gull | `pip-wave`, `pip-point`, `pip-cheer`, `pip-think` | 1024 × 1024, cut out | The guide, tips, the next-step line |
| Sky Keepers | `keeper-b01` … `keeper-b20` (boys), `keeper-g01` … `keeper-g20` (girls), aged about 8 to 17, from many backgrounds | 1024 × 1024 head-and-shoulders portrait on a soft sky background, 2 tries each. The game makes 320 px and 96 px copies, with a round crop for the sky map | Choosing a keeper, My island, the class sky, races, the news, the Hall |
| Backgrounds | `bg-island` (behind My island), `bg-sky` (the class sky), `bg-race` (the race course) | 1344 × 768 painted, game copies 1600 and 800 wide | Behind each screen |

## The second batch (stage S.7, before go-live)

| Group | Pictures |
|---|---|
| Weather cards | rainbow, golden geese, fog, storm, warm breeze, lost traveller (6) |
| Upgrade badges | Better Ploughs, Cool Cellars, Bunk Beds, Welcome Lanterns, Wind Wall, Swift Sails, Sky Bridge, Star Map (8) |
| Lighthouse | stages 1 to 4, cut out (4) |
| Gull Riders | their racing boat, cut out (1) |
| Scenes | the market, the resting island at night ("see you tomorrow"), the season's end celebration, the Hall of the Skies (4) |
| Home page card | the class sky scene, `isles.webp` + `isles-small.webp` (`docs/HOME-ART-PLAN.md`) (1) |

## From tries to the game (stage S.3)

`scripts/isles-art.py tidy` reads the picks in `docs/isles-art/picks.json` and writes `.webp` files into `src/games/isles/art/`:
- **Cut-outs:** white removed with rembg, then trimmed. Buildings at 384 px, bases at 1200 px wide, Pip at 320 px, boats at 480 px.
- **Backgrounds:** 1600 px and 800 px wide.

The art folder also gets a `CREDITS.md` ("Paintings made by James with Z-Image Turbo in ComfyUI, November 2026") and one `art.test.ts` that checks no picture is missing or spare.

## Checks for every picture

- **Right for 8 to 11-year-olds:** nothing scary, no weapons, friendly faces.
- **No mistakes:** no garbled lettering, melted shapes or broken boats.
- **Matches the other pieces:** the same light, a similar grass green, and the same camera angle (seen from slightly above). That way the pieces look like one island once they are put together.

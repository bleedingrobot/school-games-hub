# Sky Isles: art plan

*James chose **hand-painted anime** on 1 Nov 2026, from 10 styles painted side by side ([the try-out page](https://claude.ai/artifact/ULgc79JgvwemsydB8Qs2U8), `docs/ISLES-PLAN.md` S.L). Everything is painted in ComfyUI on James's gaming PC (Z-Image Turbo, the same graph as every hub painting) with `scripts/isles-art.py`. Tries go to `~/isles-art-inbox/art/`, never straight into the repo.*

## The style

**Every prompt starts with the same words:**

> Lush hand-painted anime background art in gouache and watercolour, soft fluffy clouds, warm nostalgic sunlight, gentle detailed scenery.

**Lessons from the try-outs:**
- The style is soft and busy. That's fine for backgrounds, but a whole island painted in one go can't grow plot by plot.
- **So the island is built from pieces** (below), and every piece is painted alone on plain white so it can be cut out cleanly.
- The race try-outs got muddy watercolour blotches when there was too much in the picture. **Race and sky backgrounds stay simple:** clouds, light and a few far islands. The boats are separate pieces on top.

## How the island grows

1. **The island base** is painted at 5 sizes: Little (8 plots), Growing (16), Big (24), Large (32) and Grand (40). Each base has an empty, flat, grassy top and a rocky underside with roots and waterfalls. The game shows the base for the island's size.
2. **Plot pieces:** each kind of plot is a small painted vignette (a building on its own patch of grass, cut out). The game places them on the base's top in a neat staggered grid, in the order they were built. The farthest pieces are drawn first, so nearer ones overlap them.
3. **Upgrades change the look:**
   - Better Ploughs: a richer farm.
   - Tall Houses: a taller house.
   - Bright Docks: a dock with lanterns and bunting.
4. **The Lighthouse** stands at the back of the Grand Isle, in 4 stages.
5. **Drawn-in-code fallback:** coloured shapes in the same layout, used until a picture has loaded.

## The first batch (needed before the screens, stage S.L)

25 pictures, 3 tries each.

| Group | Pictures | Painted as | Used for |
|---|---|---|---|
| Island bases | `base-1` … `base-5` (8, 16, 24, 32, 40 plots) | 1344 × 768, one island on white, cut out | My island, the class sky |
| Plots | `plot-farm`, `plot-mine`, `plot-dock`, `plot-house`, `plot-workshop`, `plot-library`, `plot-empty` | 1024 × 1024, one plot on white, cut out | My island |
| Upgraded plots | `plot-farm-ploughs`, `plot-house-tall`, `plot-dock-bright` | 1024 × 1024, cut out | My island, after the upgrade |
| Sky-boats | `boat-red`, `boat-blue`, `boat-yellow` | 1344 × 768, side-on facing right, cut out | Races, the dock, the sky |
| Pip the sky-gull | `pip-wave`, `pip-point`, `pip-cheer`, `pip-think` | 1024 × 1024, cut out | The guide, tips, the next-step line |
| Sky Keepers | `keeper-b01` … `keeper-b20` (boys), `keeper-g01` … `keeper-g20` (girls), aged about 8 to 17, from many backgrounds | 1024 × 1024 head-and-shoulders portrait on a soft sky background, 2 tries each. The game makes 320 px and 96 px copies, with a round crop for the sky map | Choosing a keeper, My island, the class sky, races, the news, the Hall |
| Backgrounds | `bg-island` (behind My island), `bg-sky` (the class sky), `bg-race` (the race course) | 1344 × 768 painted, game copies 1600 and 800 wide | Behind each screen |

## The second batch (stage S.7, before go-live)

| Group | Pictures |
|---|---|
| Weather cards | rainbow, golden geese, fog, storm, warm breeze, lost traveller (6) |
| Upgrade badges | Better Ploughs, Cool Cellars, Tall Houses, Bright Docks, Wind Wall, Swift Sails, Sky Bridge, Star Map (8) |
| Lighthouse | stages 1 to 4, cut out (4) |
| Gull Riders | their racing boat, cut out (1) |
| Scenes | the market, the resting island at night ("see you tomorrow"), the season's end celebration, the Hall of the Skies (4) |
| Home page card | the class sky scene, `isles.webp` + `isles-small.webp` (`docs/HOME-ART-PLAN.md`) (1) |

## From tries to the game (stage S.3)

`scripts/isles-art.py tidy` reads the picks in `docs/isles-art/picks.json` and writes `.webp` files into `src/games/isles/art/`:
- **Cut-outs:** white removed with rembg, then trimmed. Plots at 384 px, bases at 1200 px wide, Pip at 320 px, boats at 480 px.
- **Backgrounds:** 1600 px and 800 px wide.

The art folder also gets a `CREDITS.md` ("Paintings made by James with Z-Image Turbo in ComfyUI, November 2026") and one `art.test.ts` that checks no picture is missing or spare.

## Checks for every picture

- **Right for 8 to 11-year-olds:** nothing scary, no weapons, friendly faces.
- **No mistakes:** no garbled lettering, melted shapes or broken boats.
- **Matches the other pieces:** the same light, a similar grass green, and the same camera angle (seen from slightly above). That way the pieces look like one island once they are put together.

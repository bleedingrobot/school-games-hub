# Clan Quest: clickable village scene plan

Turn **My Village** (`src/games/clans/MyVillage.tsx`, today a grid of 8 building cards) into a painted village you look down on, where you tap a building to upgrade it and every level makes the building look bigger and grander.
Written 13 November 2026 (NZ) for James. **Status: V1 live 13 Nov 2026 NZ (the tappable scene with placeholders). James chose a new painting for every building level.**
Sketch: project files `clans/village-scene/mock-laptop.jpg`.

## What stays the same

- The rules: 8 buildings, 39 levels (Training Hall 5, Smithy 6, Church 3, Barracks 5, Walls 5, Tower 5, Forge 5, Strongroom 5), cost 50 x level, 2 builds a day plus saved builds, the area and fence questions before an upgrade (`landPlot`), raids knocking levels off.
- No server or migration change. This is a picture and layout change on the pupil side only.
- The "What to do next" line, the Village x / 39 bar, Builds left and the clan purse stay above the scene.

## The new screen

1. **The scene.** One wide painted ground (dirt, grass, a road, a well, trees) seen from above at an angle, the same angle as today's building pictures. 8 plots are marked on it. Each plot shows its building's picture for its level, cut out and standing on the ground. A plot at level 0 shows an empty, roped-off building site with a "Build me" sign.
2. **The Walls go round the village**, not on a plot: level 1 is a wooden fence, level 3 a wooden palisade with a gate, level 5 stone walls with corner towers. This is the most "the whole village changed" upgrade, so it is worth the special case.
3. **Tap a building** to open a small panel beside it (bottom sheet on phones): name, Level x of y, what it does now and what the next level adds, and the Upgrade button with its price. If it can't be upgraded, the reason shows as now ("Your builders have done every job they can..."). Barracks' panel also holds the troops and Buy troops (so the long troops block leaves the main page).
4. **Little signs over the plots:** a gold hammer badge on any building you can upgrade right now (enough gold and a build left), a level number on every building, a crown on fully built ones. Kids can see at a glance where to tap.
5. **The upgrade moment** (after the maths questions): scaffolding and a dust cloud cover the building for about 1.5 seconds with a hammering sound, then the dust clears and the new picture appears with a gold glow and "Level 4!" floating up. The ground plate gets a quick shake. On the level that reaches the top, a little banner unfurls ("Fully built!"). Respects reduced-motion (fade only).
6. **Raid damage:** a building that lost a level to a raid since you last looked has smoke and a few planks on the ground for that day, and the news line says which. Repairing it is just upgrading it again.
7. **The village grows with it:** the ground has 3 looks by Village total: 0-12 bare mud and tents, 13-29 a gravel road, carts and lanterns, 30-39 a paved square, flags, a fountain. Reaching 39 plays the existing "Village complete!" ribbon over a fireworks sky.
8. **Life in the village** (last stage, nice to have): chimney smoke from Smithy and Forge, a flag on the Tower, 2 or 3 villagers walking the road, made in code.
9. **List view** button keeps today's card list for screen readers, keyboard users and anyone who prefers it. Every plot is a real button with a label like "Tower, level 3 of 5, upgrade for 200 gold".

### Fitting each screen

Players are almost all on iPad, Chromebook or iMac.
- Laptop and iPad landscape: the whole village fits, panel opens on the right.
- iPad portrait: the scene fills the width, panel is a bottom sheet.
- Phone: the scene is wider than the screen and scrolls sideways (snap to each building), panel is a bottom sheet.
- Plots are placed in percentages of the ground picture so they line up at every size.

## The art

Painted by James on his gaming PC with ComfyUI in the evening, in the same style and prompt base as today's building pictures (`scripts/clans-art.py`, `src/games/clans/art/buildings/`): dark painterly medieval fantasy, three-quarter top-down view, cut out on a transparent background. Threads fetch the files themselves (Remote Control on the Mac, save into `/Users/jriley/Games Hub`, push to the art inbox branch); James is never asked to drag or upload.

| What | How many | Notes |
|---|---|---|
| A picture per building per level | 34 | Training Hall 5, Smithy 6, Church 3, Barracks 5, Tower 5, Forge 5, Strongroom 5. Paint level 1 first, then each next level **from the level before** (image to image, about 0.55 strength) so it is clearly the same building growing: more storeys, stone over wood, banners, glowing windows, gold trim at the top level. |
| Walls round the village | 5 | Painted as 4 straight pieces and a gate per level so code can lay them round the edge. |
| Empty building site | 1 | Pegs, rope, a pile of timber and a sign. Shared by every level-0 plot. |
| Ground plate | 3 | One per village look (mud, gravel, paved), about 2000 x 1250, with 8 flat empty plots in the same places on all 3. |
| Scaffolding + dust | 1 | Cut-out, laid over any building during the upgrade. |
| Smoke and rubble | 1 | Cut-out, for raid damage. |

About **45 pictures**, two tries each. Until they are painted the scene uses placeholders: today's small/medium/big pictures (3 per building), a ground drawn in code, a code-drawn fence for the Walls, and a gold "+" glow per level so each level still looks different.

What makes each level feel impressive (for the prompts):
- **Level 1:** rough timber, a tarp, a single lamp.
- **Level 2:** a proper roof, a fence, a cart outside.
- **Level 3:** stone base, second storey, a banner.
- **Level 4:** a tower or wing added, glowing windows, more workers and crates.
- **Level 5 (and Smithy 6):** big and grand: slate roofs, gold trim, flags, magic glow, its own little courtyard.

## Stages

Each stage goes live on its own (merging and deploying are pre-approved).

| Stage | What | Needs |
|---|---|---|
| V1 (LIVE) | The scene with placeholders: code ground, 8 plots, tap panel, hammer badges, level numbers, List view, troops inside Barracks. Phone scrolling. | Code only |
| V2 | The upgrade moment (scaffold, dust, glow, "Level 4!"), raid smoke, the 3 ground looks switched by Village total. | Code only |
| V3 | Art brief and paint script `scripts/clans-village-art.py` (level-by-level image to image, cut-out, tidy to WebP, `buildings/<kind>-<level>.webp`). `pickBuildingArt` looks for `<kind>-<level>` first, then today's sizes. | Code; James's PC for painting |
| V4 | Paint, pick the best try of each, swap them in, line the plots up on the painted ground, check on laptop, iPad and phone. | James's PC (evening) |
| V5 | Village life: chimney smoke, flags, walking villagers, fireworks at 39. | Code only |

V1 and V2 can be built now. V4 waits for an evening on the PC.

## Files

- `src/games/clans/MyVillage.tsx` (scene replaces the card list; list kept behind List view)
- New `src/games/clans/VillageScene.tsx` and `villageLayout.ts` (plot positions in %)
- `src/games/clans/art.ts` (`pickBuildingArt` gains per-level names)
- `src/games/clans/clans.css`
- Tests: the scene renders all 8 plots with the right labels, tapping opens the panel, Upgrade still runs the area and fence questions, List view matches today's cards.

## V1 as built

- `VillageScene.tsx` draws the ground, roads, well, trees and the Walls (dashed outline at 0, low fence 1-2, palisade 3, palisade + watch platforms 4, stone walls with corner towers 5) in one SVG, and puts each building on its plot as a button. Name-and-level signs sit in their own layer on top so later buildings never hide them; ⚒ = can upgrade now, ♛ = fully built.
- The panel beside the scene (below it under 760px, sticky at the bottom) shows the picked building, its Upgrade button and the reason it can't be upgraded. Upgrading still goes through the area and fence questions.
- Troops sit in a "Troops (in the Barracks)" fold under the scene, and open fully when the Barracks is picked. The "List view" button shows the old cards, and the choice is remembered on that device (`cq-village-view`).
- On phones the scene is at least 640px wide and scrolls sideways, starting in the middle.
- Screenshots: project files `clans/village-scene/v1/`. Next: V2 (upgrade moment, raid smoke, 3 ground looks).

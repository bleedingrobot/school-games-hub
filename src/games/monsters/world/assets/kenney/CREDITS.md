# Art credits for the Maths Monsters world

All pixel art on the map comes from **Kenney** (https://kenney.nl), released under
**Creative Commons Zero (CC0)**: free for any use, no credit needed (we give it anyway).
Each pack's own `License.txt` sits next to its image. The licence was checked again on
each pack's page on kenney.nl on 17 October 2026 (both say "CC0").

| Folder | Pack | Page | File used |
|---|---|---|---|
| `tiny-town/` | Tiny Town 1.1 | https://kenney.nl/assets/tiny-town | `Tilemap/tilemap_packed.png` (16 px tiles, 12 x 11, no gaps) |
| `tiny-dungeon/` | Tiny Dungeon 1.0 | https://kenney.nl/assets/tiny-dungeon | `Tilemap/tilemap_packed.png` (same layout) |

Tiny Town gives the grass, paths, trees, bushes, fences, houses, signs and flowers. Tiny Dungeon gives the people
(the wizard, villagers, knight and so on). The Roguelike RPG pack was checked (CC0) but not needed.
The water tiles and the long-grass tufts are made in code from these packs' own colours
(`tiles.ts`), because Tiny Town has no water.

## N.5 additions

No new art files were added in N.5. The Roguelike RPG pack was looked at again and **not used**: its sand, snow, lava and cave
tiles would not match Tiny Town's palette, so every new tile is drawn by `scripts/make-monster-extra-tiles.py` from the two
packs' own colours into `../extra-tiles.png` (30 tiles: water, lava, sand, snow, ash, cave floor and rock, long grass for each
area, palms, boulders, stalagmites, crystals, paths, cobbles, ice). The snow pines and snow bush are Tiny Town's own pine and
bush tiles (tile 4, 16, 28 and 5) with the greens swapped for snow colours. Autumn trees (Fire Mountain), the chests (Tiny Dungeon
tiles 90 and 91), the Tower walls and floor, the ladder, banners and shelves are Tiny Town / Tiny Dungeon tiles as they are.

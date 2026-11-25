# Diamond Drop Monster Dig: art plan

*For [DIAMOND-MONSTERS-PLAN.md](DIAMOND-MONSTERS-PLAN.md). Painted by James on the gaming PC (ComfyUI) with the one art script, `scripts/game_art.py`. Nothing here blocks the game: every picture falls back to what shows today.*

## Reused, nothing to paint

- **All 75 monsters, plain and shiny**: Maths Monsters' own paintings (`src/games/monsters/art/painted/monsters/`, 128 px `-small` copies in the field and book, 384 px on the map). Read only, through `monsterPic()`; `src/games/diamond/art/monsters.ts` loads them.
- **Cavern backgrounds until painted**: each cavern borrows a level's painting with its own colour wash (`artLevel()`, `caveTint()` in `art/monsters.ts`): 1 Mossy Burrows ← level 4, 2 Drip Grotto ← 6, 3 Ember Tunnels ← 9, 4 Frost Vault ← 5, 5 Spark Seam ← 4, 6 Boulder Deep ← 7, 7 Mixed Hollow ← 5, 8 to 10 ← level 10. A cavern's own painting replaces this as soon as `paint/levels/<11-20>.webp` exists.
- **Monster claw looks**: drawn in code (`art/draw.ts`: `fractopus-claw`, `squaremander-tail`, `infinity-sparks`) until painted.

## To paint

| Config | Pictures | Goes to |
|---|---|---|
| `docs/diamond-monsters-art/config.json` | 10 cavern backgrounds (`cavern-11` … `cavern-20`, scene), Monster Book cover, the Monster Dig gate, Fractopus Claw (head), Squaremander Tail (rope tile), Infinity Sparks (trail icon) | `src/games/diamond/art/paint/{levels,monsters,heads,ropes,icons}/` |
| `docs/diamond-monsters-art/trophies.json` | Monster Book Trophy bronze, silver, gold; Full Monster Book picture | `src/avatar/art/{trophies,pictures}/` (`monster-book-trophy-*`, `monster-book`; already mapped in `paintedArt.ts` and `earnedPictures.ts`) |

Style: the `story` words in the config (warm storybook, like the level paintings); the trophies use the same `epic` words as the Rare Gem Cup.

## Steps (on James's PC, in the evening)

1. `python3 scripts/game_art.py docs/diamond-monsters-art/config.json paint ~/dragon-art-inbox/diamond-monsters --tries 3`
2. `python3 scripts/game_art.py docs/diamond-monsters-art/trophies.json paint ~/dragon-art-inbox/diamond-monsters-trophies --tries 3`
3. A thread picks the best try of each (writes `picks.json`, `trophy-picks.json`), fetches the files itself from the PC (folder access, never asking James to move them), runs `tidy` for both configs, and checks `npx vitest run src/games/art.test.ts`.
4. The cover and gate show by themselves once their files exist (`paintFile('monsters', 'cover' | 'gate')` in `MonsterBook.tsx` and `LevelMap.tsx`).

## Voice

Diamond Drop has no read-aloud lines yet (the base game never had them), so the Monster Dig adds none. If Diamond Drop gets Bella's voice later, the cavern names, goal lines (`goalWords()`), wriggle lines and tier names are all in code, ready for a `voiceLines.ts`.

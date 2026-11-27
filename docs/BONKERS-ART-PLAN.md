# Smash Quest art plan

**Status:** planned 28 Nov 2026. Nothing has been painted. James said, after playtesting: "you can plan all the art if you like, dont start making it yet". Do not paint until he says go.

- **Style:** `toon` (bouncy cartoon: thick outlines, flat candy colours, googly eyes), picked from the style test (`docs/plans/bonkers-quest/style-test/`).
- **Config:** every picture and its prompt are in [docs/bonkers-art/config.json](bonkers-art/config.json): 127 pictures, 2 tries each = 254 paintings. It was generated from the game's content (names match `shared/bonkers/content.ts` and `season.ts`).
- **Dry run:** `python3 scripts/game_art.py bonkers paint OUT --dry-run`.
- **Pipeline:** the usual one (`docs/game-guide/6-art-voice-cards.md`):
  1. Paint on JamesGaming into `~/dragon-art-inbox/bonkers-art`.
  2. Record the picks in `docs/bonkers-art/picks.json`.
  3. `tidy` writes the `.webp` files to `src/games/bonkers/art/paint/<folder>/`.
- **Fallback:** the emoji stand-ins stay as the fallback for any picture that isn't painted.

## What gets painted

| Folder | Count | What | Size, kind |
|---|---|---|---|
| heroes | 48 | 4 classes x 3 looks (boy, girl, animal: badger, flamingo, parrot, raccoon) x 4 level looks (levels 1-2 homemade, 3-5 a few upgrades, 6-8 shiny with cape, 9-10 golden legendary). Each leaves room above the head for a sticker-shop hat (B.2) | 896x1152 cut |
| monsters | 24 | 3 monsters + 1 big monster for each of the 6 zones | 1024 / 1152 cut |
| trainers | 9 | Coach Crumpet to King Kevin (one per level up) | 896x1152 cut |
| bosses | 7 | 4 Friday bosses (Captain Lost Property, Lunchbox Lurker, Sir Squeaks-a-Lot, Glitter Gremlin) + 3 mega bosses (Mega Mess Monster, Queen Puddle-Splash, Infinite Homework Hydra) | 1152 cut |
| zones | 6 | Fight backdrops, side-on, with flat ground in the bottom third | 1344x768 scene |
| scenes | 1 | Home (Granny Jetpack's cottage) | 1344x768 scene |
| people | 1 | Granny Jetpack, clearly not Pirate Granny | 896x1152 cut |
| gear | 28 | 7 tiers x weapon, shoes, cape, shield (icons; gear shows beside the hero, James Q18) | 1024 cut, kept at 512 |
| ui | 2 | Chest closed and open | 1024 cut |
| home card | 1 | Hero smashing a sock monster, Granny Jetpack overhead | 1216x688 card |

## Painting order

Each batch can go live on its own:

1. **Fight screen first:** zone backdrops, monsters, the 4 classes' level-1 looks (12). This covers what every pupil sees on day one.
2. **Home and chest:** the Home scene, Granny Jetpack, the chest, gear icons and the home card.
3. **Trainers and bosses:** trainers and the season bosses (the boss fights are stage B.3, but the timeline on Home shows their faces already).
4. **Later level looks:** hero looks 2 to 4 (36). Nobody reaches level 3 for about a week.

## Wiring when painted (for the thread that does it)

- Add an `art.ts` that maps ids to the `.webp` imports: hero (`cls`, look, band from level: 1-2 → 1, 3-5 → 2, 6-8 → 3, 9-10 → 4), monster id, trainer, boss, zone, gear `slot-tier`.
- Each screen uses the picture when there is one, otherwise the emoji.
- Monsters face left and heroes face right, so the fight screen needs no flipping.
- Animal looks: `CLASS_INFO[cls].names.animal` gives the animal's name, and the prompts must match it.
- Add `CREDITS.md` in the art folder, and check that `src/games/art.test.ts` passes.

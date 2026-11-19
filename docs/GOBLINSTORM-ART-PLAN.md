# Goblin Storm: art plan

*Written 19 Nov 2026 with [GOBLINSTORM-PLAN.md](GOBLINSTORM-PLAN.md). James paints the final art on his gaming PC (ComfyUI) in the evening. Pupils chose painted top-down art, with the attacks drawn in code.*

**Status: not painted yet.** Words, sizes and file names for every picture are in [goblinstorm-art/config.json](goblinstorm-art/config.json) (81 pictures).

## The one rule

The game is built and goes live with **drawn stand-ins** (shapes and colours drawn in code). Art never holds anything up. The stand-ins stay as the fallback for good: a picture that is missing or not downloaded yet still works. Whenever James paints a picture, a later thread swaps it in, even after the game is live (game guide 6, "Painted art").

## What is painted and what is not

- **Painted:** the home card, the ground for each map, the heroes, the monsters, the level-up icons and the hero portraits.
- **Drawn in code, never painted:** every attack and effect. That means spinning blades, fireballs, lightning, rings, arrows, bubbles, the screen-wipe blasts, gems, gold, health bars, damage numbers and all the maths. Code effects can be many, fast and glowing at once. A painted picture can't do that.
- No text, letters or numbers in any picture.

## Look

Fantasy kingdom. Bright, flat, friendly storybook shapes with a thin dark outline. Cute, not scary. **No blood, no gore, no scary faces.** The stand-in colours are the guide:

| Map | Colours |
|---|---|
| Castle Fields | sunny greens, warm gold |
| Dark Forest | deep greens and browns |
| Haunted Graveyard | grey-green and soft purple |
| Frozen Peaks | white and pale blue |
| Lava Mines | charcoal with glowing orange |

Ground is calm and low contrast, so monsters and attacks stand out. Sprites have a clear edge for the same reason.

## The pictures (81)

| Group | How many | Kind | Size painted | Used at | Goes in `src/games/goblinstorm/art/paint/` |
|---|---|---|---|---|---|
| Home card | 1 | card | 1216 × 688 (made 1600 and 800 wide) | the home page card | `src/assets/home/goblinstorm.webp` and `goblinstorm-small.webp` |
| Ground | 5 | texture (tiles, no seam) | 1024 × 1024, 512 px | the floor of each map | `ground/<map>.webp` |
| Hero sprites | 16 (8 heroes × 2 poses: `stand`, `hurt`) | cut-out | 832 × 832, 256 px | the hero in a run | `heroes/<hero>-<pose>.webp` |
| Monsters | 25 (5 maps × common, fast, tough, mini-boss, boss) | cut-out | 832 or 1024 square, 200 to 512 px | the swarm and the bosses | `monsters/<map>/<monster>.webp` |
| Weapon icons | 8 | icon | 768 × 768, 256 and 128 px | level-up cards, codex | `weapons/<weapon>.webp` |
| Evolved icons | 8 | icon | 768 × 768, 256 and 128 px | Evolve! cards, codex | `evolved/<weapon>.webp` |
| Passive icons | 10 | icon | 768 × 768, 256 and 128 px | level-up cards | `passives/<passive>.webp` |
| Hero portraits | 8 | icon | 768 × 768, 384 and 160 px | the hero picker | `portraits/<hero>.webp` |

Files follow the other games' layout: `art_dir` is `src/games/goblinstorm/art/paint`, found by file name, with no import lines. The script is `scripts/game_art.py`.

**Home card.** Wide, about 1600 × 900, flat storybook, no text, calm dusk sky at the top. In the middle a small knight stands on a castle field with glowing spinning blades in a ring around them. A ring of goblins and slimes comes in from the edges.

**Heroes** (ids as in `shared/goblinstorm/config.ts`): `knight`, `ranger`, `wizard`, `barbarian`, `cleric`, `rogue`, `witch` (Frost Witch), `dragonkid` (Dragon Kid, secret). Top-down, facing down the picture. The game turns and flips them in code, so one `stand` pose and one `hurt` pose each is enough.

**Monsters** (the order in `MAPS`: common, fast, tough, mini-boss, boss):

| Map | Common | Fast | Tough | Mini-boss | Boss |
|---|---|---|---|---|---|
| Castle Fields | `goblin` | `bat` | `slime` (Big Slime) | `troll` | `goblinking` |
| Dark Forest | `mushroom` | `wolf` | `spider` | `giantspider` | `ogre` |
| Haunted Graveyard | `skeleton` | `ghost` | `zombie` | `boneknight` | `lich` |
| Frozen Peaks | `imp` | `frostwolf` | `yeti` | `yetichief` | `icedragon` |
| Lava Mines | `sprite` | `slug` | `magma` | `golem` | `firedragon` |

Small kinds are small in the picture too (max 200 px). Bosses are the biggest (max 512 px).

**Icons.** Each weapon icon matches its attack in code. Each evolved icon is the grander, golden-glow version (Blade Storm, Meteor Storm, Thunder God, Sun Flare, Blizzard, Axe Tornado, Arrow Rain, Spiky Fortress). Passives: Armour, Spiky Shield, Swift Boots, Spell Tome, Crown, Holy Water, Snow Crystal, Gauntlets, Magnet, Heart.

## Order to paint (each can go live alone)

1. **Home card.** The first thing pupils see. Add `goblinstorm` to `NOT_PAINTED_YET` in `src/games/art.test.ts` until it is painted, then take it off.
2. **Heroes and portraits.** The Knight and Ranger first (they are free), then the rest.
3. **Castle Fields:** ground and its five monsters. This is the first map.
4. **Weapon, evolved and passive icons.**
5. **The other four maps:** ground and monsters, one map at a time.

Every picture is optional. A map with some monsters painted and some drawn still plays.

## How James paints

1. On the PC: `python3 scripts/game_art.py goblinstorm paint ~/dragon-art-inbox/goblinstorm-art --tries 3` (check first with `--dry-run`). Never straight to `main`.
2. Pick the best try for each picture and write it in `docs/goblinstorm-art/picks.json`.
3. A later thread runs `tidy` to make the `.webp` files, adds `CREDITS.md` in the art folder, and checks `src/games/art.test.ts` passes (no missing or spare pictures).

## Rules for the prompts

- The style words are in `styles` in the config and go in front of every prompt. Three are for sprites, icons and portraits on a plain background, one for ground, and one for scenes and the card.
- Cut-outs are on plain pure white with space around them, so they cut out cleanly.
- Top-down sprites face down the picture. Keep each hero and each map's monsters in the same style as the first good one (use the first good try as the reference).
- Never put in a real game's or show's characters, names or logos.
- Suitable for children aged 8 to 11: cute, bright, kind.

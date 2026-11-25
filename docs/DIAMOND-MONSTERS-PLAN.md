# Diamond Drop: Monster Caverns (expansion plan)

*Asked for by James, 25 Nov 2026: "an expansion for Diamond Drop. It's going to be catching the maths monsters. We can reuse a lot of the art, finishing first version of game the diamond unlocks it. Lots of monsters that have different chances to appear, filling up a collection book along the way." Branch `claude/project-thread-kmcz6m`. Built on [DIAMOND-PLAN.md](DIAMOND-PLAN.md) and [DIAMOND-RULES.md](DIAMOND-RULES.md); monster data from `shared/monsters/monsterBook.ts`.*

**Status: Stage 0, plan only.** Written on my recommended answers while James answers 10 question cards (25 Nov 2026). Decisions below marked *(rec)* are recommendations until he taps. Next free migration number when written: `20261125000400` (re-check with `node scripts/migration-numbers.mjs`).

## The short version

- Catching the **Heart Diamond** (ever: `lifetime.found > 0`, kept through New Season) opens a gate at the bottom of the level map: **Monster Caverns**, 10 new levels (11 to 20) below the diamond. *(rec)*
- Same claw, same one button. Monsters hide in the rock like gems. **Grab one** and it may **wriggle**: a Hold on! question from the pupil's own maths focus (way A, as now). Right: caught, into the book. Wrong: it wriggles free and burrows deeper, where it can be grabbed again. Rarer monsters wriggle more often. *(rec)*
- Each cavern has a monster **habitat** (one per Maths Monsters type), so the water monsters live by the underground lake and fire ones near magma. Which monsters turn up is a weighted roll from the cavern's seed.
- **The Monster Book**: a page for each of the 75 Maths Monsters forms, plus shiny pages. It shows how many caught and the first date, and is kept for good. *(rec)*
- All monster pictures already exist (`src/games/monsters/art/painted/monsters/`: 75 forms, each with a shiny and a small copy). New painting is only the 10 cavern backgrounds, the gate, a book cover and the trophy.

## Decisions (question cards, 25 Nov 2026)

| # | Question | Recommended | James |
|---|---|---|---|
| 1 | How to catch | grab it, then Hold on! to keep it | |
| 2 | Shape | 10 new Monster Caverns levels | |
| 3 | Which monsters | all 75, shinies as extra pages | |
| 4 | Link to Maths Monsters | book only, with a "caught in both" stamp | |
| 5 | Unlock | found the diamond ever, kept for good | |
| 6 | Pace | one new cavern a day, replays any time | |
| 7 | Book rewards | achievements, trophy, picture, plus monster claw looks | |
| 8 | Shop | Monster Lure and Monster Net boosts | |
| 9 | Moving monsters | rare ones move and the rarest burrow away | |
| 10 | Name | Monster Caverns | |

## Rules (all numbers in `shared/diamond/caverns.ts`, starting guesses for the simulator)

### Rarity and chances

Each monster spot in a field rolls a tier, then a monster from that tier that lives in the cavern's habitat (any type in caverns 17 to 20).

| Tier | Which monsters | Chance per spot | Wriggle chance | Moves? |
|---|---|---|---|---|
| Common | first forms of the 18 families | 55% | 10% | still |
| Uncommon | second forms | 27% | 25% | slow scuttle |
| Rare | third forms, and the 6 rare families | 14% | 40% | scuttle |
| Super rare | the 3 sleeping giants | 3.5% | 55% | pops out, burrows away after 6 s |
| Ultra | the 3 ultra rares | 0.5% (only caverns 18 to 20) | always, twice | pops out, burrows away after 4 s |
| Shiny | any monster, rolled after the tier | 1 in 64 | +10% | as its tier |

Like the rare gems, the game tries the rarest tier first with its own random stream (`STREAM.monster`), so the table is the real odds and the gem part of every field stays exactly as before. The server replays the field from the seed, so a kid can't fake a catch.

### The caverns

| Level | Cavern | Habitat | Goal (tune) |
|---|---|---|---|
| 11 | Mossy Burrows | leaf | catch 3 monsters |
| 12 | Drip Grotto | water | catch 4 |
| 13 | Ember Tunnels | fire | catch 4 |
| 14 | Frost Vault | ice | catch 5 |
| 15 | Spark Seam | spark | catch 5 |
| 16 | Boulder Deep | stone | catch 6, one uncommon or better |
| 17 | Mixed Hollow | all | catch 6 kinds |
| 18 | Giants' Rest | all, giants twice as likely | catch a rare or better |
| 19 | Starlit Chasm | all | catch 8, one rare or better |
| 20 | The Monster Heart | all, ultras twice as likely | catch 10 |

- Gems still sit in the caverns and pay coins as now. Rocks, sacks and crabs as level 9.
- Stars: 1 pass, 2 pass with 15 s left, 3 also a new page in the book this go.
- Hold on! cap stays at 6 a go (8 on cavern 20), counting gems and monsters together. After the cap nothing wriggles.
- Passed caverns replay any time, with a fresh field each replay day so the hunt goes on after cavern 20.

### Shop (Boosts tab, caverns only) *(rec)*

| Boost | What it does | Price |
|---|---|---|
| Monster Lure | rare and better tiers 1.5 times as likely, next go | 30 + 5 × cavern |
| Monster Net | the first wriggle each go is a free catch | 25 + 5 × cavern |

Never a way to buy a monster outright.

### Monster Book

- New tab in the Gem Book: **Monster Book**. Pages in Maths Monsters book order, grouped by type; uncaught pages show a dark outline and the tier; shiny pages hidden until caught.
- Stamp "Caught in Maths Monsters too" when the pupil's Maths Monsters save has that species *(rec)*. Read only; nothing is sent to that game.
- Kept for good (`lifetime.monsters`), never reset by New Season.

### Rewards *(rec)*

- Achievements: First Catch, Monster Spotter (10 kinds), Monster Keeper (30 kinds), Shiny Finder, Giant Tamer (a sleeping giant), Ultra Catch, Full Book (all 75).
- **Monster Book trophy**: bronze 15, silver 40, gold 75 kinds.
- Picture for a full book; monster claw looks (Fractopus claw, Squaremander rope, Infinitail trail) earned at 10, 30 and 50 kinds.

## Server and data

- Same `diamond` function and replay; new field parts behind `level > 10`. New `record` checks the unlock on the server.
- Migration `20261125000400_diamond_monsters.sql`: achievements, trophy, picture, trigger on `diamond_players` as the rare gems did. The save is the existing player JSON (new `lifetime.monsters`, `cavernDeepest`, `cavernStars`).
- Teacher switch: a second switch "Monster Caverns" (on by default when Diamond Drop is on). Progress tab "Other games" column shows deepest cavern.

## Art

- Monsters: reuse `monsterPic(species, shiny, small)` from `src/games/monsters/art/painted.ts` (import only, no change to that game's files).
- To paint on the gaming PC (ComfyUI, `docs/diamond-art/` style): 10 cavern backgrounds, the cavern gate on the map, Monster Book cover, trophy (3 metals), full-book picture, 3 claw looks. Drawn stand-ins until then.
- Bella: about 20 new lines (cavern names, "It's wriggling, hold on!", "New page in your Monster Book!", tier banners).

## Stages

1. **Rules and simulator**: `caverns.ts`, field monsters, wriggle, burrow-away, book; sim tunes goals so cavern 20 lands in about 3 weeks and a full book takes most of a year. 3 rule tests.
2. **Screens**: cavern gate on the map, monsters in the field with painted pictures, wriggle pop-up, Monster Book tab, phone preview artifact.
3. **Server and migration**: replay, unlock check, rewards, pgTAP tests.
4. **Hub fit**: Shop boosts, claw looks, teacher switch and Progress column, How to play, Nugget tips for the caverns.
5. **Art and voice**: ART-PLAN prompts, Bella lines, James paints, thread fetches the files.
6. **Go live**: merge, switch on, What's new line.

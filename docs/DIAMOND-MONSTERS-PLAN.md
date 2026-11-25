# Diamond Drop: Monster Dig (expansion plan)

*Asked for by James, 25 Nov 2026: "an expansion for Diamond Drop. It's going to be catching the maths monsters. We can reuse a lot of the art, finishing first version of game the diamond unlocks it. Lots of monsters that have different chances to appear, filling up a collection book along the way." Branch `claude/project-thread-kmcz6m`. Built on [DIAMOND-PLAN.md](DIAMOND-PLAN.md) and [DIAMOND-RULES.md](DIAMOND-RULES.md); monster data from `shared/monsters/monsterBook.ts`.*

**Status: built 25 Nov 2026 (stages 1 to 5), going live with the PR.** James answered all 10 question cards on 25 Nov 2026 (table below); the *(rec)* marks are his choices except where the table says otherwise. Migration `20261125000400_diamond_monsters.sql`. Rules in `shared/diamond/caverns.ts` and `config.ts` (`CAVERNS`); art in [DIAMOND-MONSTERS-ART-PLAN.md](DIAMOND-MONSTERS-ART-PLAN.md).

## The short version

- Catching the **Heart Diamond** (ever: `lifetime.found > 0`, kept through New Season) opens a gate at the bottom of the level map: **Monster Dig**, 10 new cavern levels (11 to 20) below the diamond. *(rec)*
- Same claw, same one button. Monsters hide in the rock like gems. **Grab one** and it may **wriggle**: a Hold on! question from the pupil's own maths focus (way A, as now). Right: caught, into the book. Wrong: it wriggles free and burrows deeper, where it can be grabbed again. Rarer monsters wriggle more often. *(rec)*
- Each cavern has a monster **habitat** (one per Maths Monsters type), so the water monsters live by the underground lake and fire ones near magma. Which monsters turn up is a weighted roll from the cavern's seed.
- **The Monster Book**: a page for each of the 75 Maths Monsters forms, plus shiny pages. It shows how many caught and the first date, and is kept for good. *(rec)*
- All monster pictures already exist (`src/games/monsters/art/painted/monsters/`: 75 forms, each with a shiny and a small copy). New painting is only the 10 cavern backgrounds, the gate, a book cover and the trophy.

## Decisions (question cards, 25 Nov 2026)

| # | Question | Recommended | James |
|---|---|---|---|
| 1 | How to catch | grab it, then Hold on! to keep it | **chosen** |
| 2 | Shape | 10 new Monster Caverns levels | **chosen** |
| 3 | Which monsters | all 75, shinies as extra pages | **chosen** |
| 4 | Link to Maths Monsters | book only, with a "caught in both" stamp | **no link: the book is its own** |
| 5 | Unlock | found the diamond ever, kept for good | **chosen** |
| 6 | Pace | one new cavern a day, replays any time | **chosen** |
| 7 | Book rewards | achievements, trophy, picture, plus monster claw looks | **chosen** |
| 8 | Shop | Monster Lure and Monster Net boosts | **chosen** |
| 9 | Moving monsters | rare ones move and the rarest burrow away | **chosen** |
| 10 | Name | Monster Caverns | **Monster Dig** |

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

| Level | Cavern | Habitat | Time | Goal (simulator-tuned) |
|---|---|---|---|---|
| 11 | Mossy Burrows | leaf | 70 s | catch 3 monsters |
| 12 | Drip Grotto | water | 70 s | catch 4 |
| 13 | Ember Tunnels | fire | 70 s | catch 4 |
| 14 | Frost Vault | ice | 80 s | catch 5 |
| 15 | Spark Seam | spark | 75 s | catch 5 |
| 16 | Boulder Deep | stone | 80 s | catch 5, one uncommon or rarer |
| 17 | Mixed Hollow | all | 80 s | catch 5 different kinds |
| 18 | Giants' Rest | all, giants twice as likely | 85 s | catch 4, one rare or rarer |
| 19 | Starlit Chasm | all | 85 s | catch 6, one rare or rarer |
| 20 | The Monster Heart | all, ultras twice as likely | 90 s | catch 7 |

- Gems still sit in the caverns (a thinner mix than level 9) and pay coins as now. Rocks, sacks and one crab. Monsters pay coins by tier (5, 10, 20, 40, 80; a shiny twice).
- Stars: 1 pass, 2 pass with 15 s left, 3 also every monster in the cavern caught.
- Hold on! cap stays at 6 a go (8 in cavern 20), gems and monsters together. After the cap nothing wriggles.
- One new cavern a day (its own date, apart from the levels'), unlimited tries, replays any time with a fresh field each go. The teacher's unlimited switch opens caverns too.
- **New Season** sends caverns back to cavern 1 like the levels; the way in (the diamond) and the Monster Book stay.
- Simulator (bots, 60 goes a cavern, 25 Nov 2026): steady pupils pass 58% to 93% of tries, weak 42% to 77%, strong 75% to 100%; about 250 to 400 coins a go.

### Shop (Boosts tab, caverns only) *(rec)*

| Boost | What it does | Price |
|---|---|---|
| Monster Lure | rare and better tiers 1.5 times as likely, next go | 30 + 5 × cavern |
| Monster Net | the first wriggle each go is a free catch | 25 + 5 × cavern |

Never a way to buy a monster outright.

### Monster Book

- New tab in the Gem Book: **Monster Book**. Pages in Maths Monsters book order, grouped by type; uncaught pages show a dark outline and the tier; shiny pages hidden until caught.
- Kept for good (`lifetime.monsters`), never reset by New Season.

### Rewards *(rec)*

- Achievements: First Catch, Monster Spotter (10 kinds), Monster Keeper (30 kinds), Shiny Finder, Giant Tamer (a sleeping giant), Ultra Catch, Full Book (all 75).
- **Monster Book trophy**: bronze 15, silver 40, gold 75 kinds.
- Picture for a full book; monster claw looks (Fractopus claw, Squaremander rope, Infinitail trail) earned at 10, 30 and 50 kinds.

## Server and data

- Same `diamond` function, same replay; levels 11 to 20 are accepted, and `canStart` checks the way in (`lifetime.found > 0`) and the one-a-day rule on the server. The Lure is part of the field, so the replay agrees.
- Save: the existing player JSON. `caves` (this season: deepest, date, stars), `lifetime.monsters` (species → count, first, shiny, shinyFirst).
- Migration `20261125000400_diamond_monsters.sql`: 5 measures in `diamond_counts`, 7 achievements, the Monster Book Trophy (15/40/75 kinds) and the Full Monster Book picture, given by a trigger on `diamond_players`.
- **Teacher:** no second switch (the Monster Dig follows Diamond Drop's switch, and the unlimited switch covers caverns). The Progress tab column still shows the deepest level. "Reset my turns" clears today's new level but not today's new cavern (it would mean re-creating a shared function); a teacher trying caverns can use the unlimited switch.

## Art and voice

See [DIAMOND-MONSTERS-ART-PLAN.md](DIAMOND-MONSTERS-ART-PLAN.md): all monster pictures reused from Maths Monsters; caverns borrow level paintings with a colour wash until James paints their own. No Bella lines: Diamond Drop has none yet.

## Stages

1. **Rules and simulator** (done 25 Nov): `caverns.ts`, monsters in the field (own random stream), wriggles, Net, Lure, burrowing, the book, one test.
2. **Screens** (done): gate and caverns on the map, monsters drawn from Maths Monsters' paintings, wriggle pop-up, Monster Book tab, level end, preview tools (`digTo`, `monsterBook`).
3. **Server and migration** (done): function rebuilt, migration, `supabase/tests/database/diamond_monsters.test.sql`.
4. **Hub fit** (done): Shop boosts by level, 3 earned claw looks, next-step line, How to play, teacher note, What's new.
5. **Art plan** (done): configs in `docs/diamond-monsters-art/`, waiting for the gaming PC.
6. **Go live**: the PR; the game is already on, so the caverns appear to anyone who has found the diamond.

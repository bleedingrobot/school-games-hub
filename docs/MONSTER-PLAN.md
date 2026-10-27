# Maths Monsters: plan

A Pokémon-style adventure for the hub. Walk around a small world, meet wild monsters in the long grass, and battle and catch them. **Every attack and every catch is a maths question.** Each kind of monster stands for a maths topic, so collecting and training a team means practising every topic.
Written 17 October 2026 after a deep dive into [devshareacademy/monster-tamer](https://github.com/devshareacademy/monster-tamer) (James's find) and reading the code on `main` (Stages 1–10 live, Gem Keep live).
**Status: APPROVED 17 Oct 2026, under way** on branch `monsters` (built on `space-maths`, because both change `shared/maths/`). James picked "a world to walk around" and "several maths topics", then answered every question in section 12 and said start now (alongside Mission Control maths).

## The short version

- **Monster Tamer is our blueprint, not our code base.** Its code is MIT (free to copy with credit), but it's plain JavaScript on the Phaser engine, keyboard only, with no maths and very little game yet. Most of its art and music can't go in our public repo (section 1). We borrow its *ideas* and a few small pieces of logic, and write the game in our own style, like Gem Keep.
- **Six monster types = six maths topics.** Fire = times tables, Water = adding and taking away, and so on (section 4). Your monster's attack asks a question from its own topic. A wild monster is caught with a question from *its* topic.
- **Right answers hit hard, fast right answers hit harder, and a wrong answer still does a little damage and shows the right answer.** Nothing is ever lost for getting maths wrong. Losing a battle just sends you back to the healing spot with everything kept.
- **A small world**: a home town plus six areas, one per topic, each with a "Topic Tower" boss. About 6–10 hours to finish, played over many short sessions.
- **One maths engine for the whole hub.** The new topics are built as skill packs in `shared/maths/`, next to times tables. Gem Keep and the space game can use them later for free.
- **Saved on the server**, so a student's team follows them to any Chromebook. Small points inside the shared bot-game cap, achievements, and a teacher view of each topic.
- **This is the biggest game yet**, roughly Gem Keep plus the space game together. Eight stages (section 10), with a test page for James after the battle stage.

## 1. What we found in Monster Tamer (17 Oct 2026)

**What it is:** a YouTube-tutorial game (last updated Dec 2025). A small pixel-art village, a forest and three houses. You walk on a grid, and long grass starts battles. Battles are turn-based (Fight / Switch / Item / Flee), with catching, levelling (exp = level³), a party screen, a bag, signs, NPCs, cut-scenes and save to `localStorage`.

**Size:** about 11,000 lines of plain JavaScript (JSDoc types), Phaser 3.60 from a CDN, maps made in the Tiled editor. 7 monsters, 2 attacks, 4 maps.

**Licences.** The code is MIT. The art and music are a separate download (`all-game-assets-v2.zip`, 71 MB) from different artists:

| Assets | Licence | Can it go in our public repo? |
|---|---|---|
| Kenney UI packs, Kenney font | CC0 (anything goes) | Yes |
| AxulArt tiles and player character | CC BY-SA 4.0, but also says "you may not redistribute it" | **No.** Our repo is public, which counts as redistributing |
| Parabellum Games NPCs | itch.io pack, terms on the store page | No (same problem) |
| Pimen attack effects | itch.io pack, terms on the store page | No (same problem) |
| leohpaz sound effects | "free to use, may not distribute this asset pack" | **No** |
| xDeviruchi music | CC BY-SA 4.0, "don't place copies on websites for download" | Risky. Leave it out |
| The 7 monsters and battle background | **No licence written anywhere**, and they look AI-generated | **No** |

**Other problems for us:**

- **Keyboard only.** There is no touch or mouse anywhere. Tablets couldn't play.
- **Phaser is a second game engine** (~1 MB) that the hub doesn't use. Its scenes, menus and text are drawn on canvas, so screen readers get nothing.
- **No server saving.** Everything is in `localStorage`, and our students switch Chromebooks.

**Worth borrowing (rewritten in TypeScript, MIT credit in the code and the credits screen):**

- the battle "state machine": the order of intro → choose → attack → enemy attack → faint/catch/flee → exp, and how each step waits for its animation
- the catch chance (easier when the monster's health is low) and the exp curve
- grid walking (smooth tile-to-tile steps, turning on the spot, collisions from a Tiled layer)
- how Tiled maps carry signs, NPCs, doors and encounter zones as object layers

## 2. Why our own engine instead of Phaser

- **Gem Keep already does this.** It draws a canvas game with cached sprites at 60 fps on a slow Chromebook, without Phaser. A tile map and walking sprites are simpler than a tower-defence wave.
- **Battles work better as normal web pages.** They're menus, health bars and questions. As React screens they get screen-reader support, the hub's `QuestionModal` and `NumberPad`, and the hub's look for free. Only the monsters and attack effects are animated.
- **Smaller and lazier:** no 1 MB download. The game loads only when opened, like the other games.
- **Same pattern as the rest of the hub:** pure rules in `shared/monsters/` with tests and a simulator, and screens in `src/games/monsters/`.

## 3. The world

- **Home town** (start, healing centre, a teacher character who explains things, your monster box, the monster book).
- **Six areas**, each built around one topic: its wild monsters, its signs and tips, and its **Topic Tower** at the end. Beat the Tower's trainer to earn that topic's badge and open the next path.
- **Areas open in order.** Easy topics first. Each area is "easy, then harder": monsters further from town are higher level and ask harder questions in the same topic.
- **NZ places with English names** (James, 17 Oct): e.g. Kauri Bush, Shell Beach, Fire Mountain, Snowy Peaks, Glowworm Caves, Harbour Town.
- **About 25 × 20 tiles per area**, made in Tiled (free editor) as JSON in `shared/monsters/maps/`, using **Kenney CC0 packs** (*Tiny Town*, *Tiny Dungeon*, *Roguelike RPG*; checked 17 Oct: all CC0).
- **Encounters:** long grass, about one battle every 12–20 steps (tuned so it feels exciting, not annoying). A "Repel" item lets students just walk.
- **People:** a few NPCs per area with one-line tips or jokes, and trainers who challenge you when you walk past.
- **No typing, no chat, no student-made text anywhere** (same safety rule as the rest of the hub).

## 4. Monsters and topics

| Type | Topic | Example questions | Strong against |
|---|---|---|---|
| Leaf | Place value and rounding | 3,406: what is the 4 worth? Round 678 to the nearest 10 | Water |
| Water | Adding and taking away | 47 + 36, 120 − 58 | Fire |
| Fire | Times tables | 7 × 8 (the Gem Keep pack) | Ice |
| Ice | Division | 56 ÷ 7, 35 ÷ 5 | Spark |
| Spark | Fractions | ½ of 18; which is bigger, ⅔ or ¾? (picked from choices, with a fraction bar) | Stone |
| Stone | Decimals and money | 0.3 + 0.5, $2.40 + $1.75 | Leaf |

- **Your monster's attacks ask questions from its type's topic.** So the team you send out *is* the practice you choose. The type wheel ("strong against") gives a reason to train every type, which means practising every topic.
- **Catching** a wild monster asks a question from the wild monster's topic.
- **18 monsters to start**: 3 per type, and each can grow (evolve) twice as it levels up, so 6 × 3 × 3 = 54 entries in the monster book. Rare "shiny" colours make collecting fun.
- **Our own art, built from parts**, like the 101 card faces: a body shape + eyes + horns/fins/flames + a colour per type, drawn as SVG. Bigger and fancier parts when it evolves. That keeps everything ours, scales to any screen, and lets us add monsters cheaply. (A paid or commissioned art set is possible later if James wants a fancier look.)
- **Names**: punny maths names (e.g. *Divvy*, *Fractopus*, *Sumbat*). James to OK the list.

## 5. Battles

1. A wild monster appears. Choose **Fight / Team / Bag / Run**.
2. **Fight**: pick one of your monster's attacks (each has a power and an animation), then answer **one question** from your monster's topic.
   - right: normal hit
   - right *and quick* (under a time set by question difficulty, not a race against classmates): **critical hit**, ×1.5
   - wrong: a small "graze" (¼ damage), and the correct answer is shown for a moment
   - type advantage: ×1.5 (weak: ×0.75)
3. The wild monster attacks back (no question for that; it's just damage).
4. **A wild battle is about 3–6 questions and 1–2 minutes.** Tower trainers have 3 monsters, so 10–15 questions.
5. **Catch**: throw a ball from the Bag, answer a question in the wild monster's topic. A right answer makes the catch chance much higher, and lower health helps too (borrowed from Monster Tamer).
6. **Winning** gives exp. **Losing** ("your team is tired") sends you back to the last healing spot with all monsters and items kept.

**Settings the student can change** (like Gem Keep): *Calm* (no quick-answer bonus, no timer shown) and *Number pad / Multiple choice*.

## 6. The maths engine

- **New skill packs** in `shared/maths/skillPacks/` that follow the existing `SkillPack` interface: `addSub`, `division`, `placeValue`, `fractions`, `decimals`. Times tables already exists.
- **Each pack has difficulty bands**, e.g. adding: within 20 → within 100 → within 1,000 → with regrouping. An area's level sets which bands appear.
- **The Leitner boxes still pick weak questions first**, inside the allowed bands. Fact-style topics (adding, division) track single facts like `add:47+36`. Others (place value, fractions) track question *kinds*, e.g. `pv:round10:3digit`.
- **Curriculum tags** come from James's curriculum alignment tool, as the times-tables pack already does.
- **Answers are saved as answer events** (the per-answer saving from Mission Control stage M.1), so a student's records stay right across games and Chromebooks.
- **Bonus for the whole hub:** Gem Keep and Wormholes & Black Holes can offer these topics later with no new maths code.

## 7. Screens and controls

- **Walking:** arrow keys / WASD; on tablets, tap a tile to walk there (shortest path), plus an optional on-screen D-pad. Space/Enter or tap to talk and read signs.
- **Battles:** big buttons, keyboard numbers 1–4, the hub's `QuestionModal` and `NumberPad`.
- **Fits a Chromebook at 1366 × 640** (the real usable height, as checked for 101) and phones in landscape.
- **Accessibility:** battles, menus and the monster book are normal HTML (screen readers, axe-clean like the other games). The world map is canvas, with signs and talk shown in an HTML box that is read out.
- **Sound:** made in code like `src/games/sounds.ts`, with no sound files. Music is optional later from a CC0 source, off by default in class.

## 8. Saving, points and fairness

- **The save is on the server**: team, monster box, items, badges, map position and monster book. Small (a few KB). Saved at healing spots, after Tower battles and every few minutes. It's also kept on the device until the server has it, like Gem Keep's queue.
- **New tables** (students can't write to them directly, as usual): `monster_saves` (one row per student) and `monster_events` (what happened since the last save). A new `monster` server function checks each save before accepting it. The checks are plausibility checks, not a full replay (same reasoning as Gem Keep): exp gained must match the battles reported, levels can't jump, catches need a right answer, and the number of answers per minute must be humanly possible.
- **Points:** inside the shared 40-a-day bot-game cap. My pick: 1 point per 3 wild battles won, 3 per trainer, 8 for a Tower badge (first time only). The game is `ranked: false` (no ratings).
- **Achievements** (about 8): first catch, 10/25/54 monster-book entries, each badge, all six badges, a "fully evolved" team.
- **Leaderboard: most monsters collected** (monster-book entries, top 10 plus you), like Gem Keep's stars board (James, 17 Oct).
- **New season keeps the adventure** (team, box, badges, monster book) and resets only the points (James, 17 Oct).

## 9. Teacher page

- **Topics on/off** for the school (for example, fractions off until it's been taught). A switched-off topic's questions are swapped for the nearest topic that's on, so no area is ever blocked.
- **Per-topic view:** each student's progress, and the class's hardest questions, using the same panel as Gem Keep's "hardest facts".
- **Game switch:** off/on, like the other games.

## 10. Stages (when picked up)

| Stage | What | Rough size |
|---|---|---|
| **N.1** | Maths: the five new skill packs with bands, tests and curriculum tags. A "maths practice" test page for every topic | Medium |
| **N.2** | `shared/monsters/` battle rules: monsters, types, attacks, damage, catching, exp, evolving, wild/trainer AI. Simulator to tune battle length and levelling | Medium |
| **N.3** | Battle screen + monster art system (SVG parts) + first 6 monsters. **Test page artifact for James** | Big |
| **N.4** | World: tile drawing, Tiled map loading, walking (keys + tap), grass encounters, signs/NPCs, healing centre. Home town + area 1 | Big |
| **N.5** | The other five areas, the Towers and trainers, all 18 monster families, the monster book, bag items | Big (mostly design and tuning) |
| **N.6** | Saving, points, achievements, teacher page (migration + `monster` function). **Go live**, needs James to say so | Medium |
| **N.7** | How to play, accessibility pass, slow-Chromebook check, docs. **Built 19 Oct 2026** (see N.7 results) | Small |

Each stage ends with tests passing and a results section here, and stops for James's review, like Gem Keep. A class trial could start after N.4 with device-only saving (as Gem Keep did).

### N.1 results (done 17 Oct 2026, branch `monsters`)

- **`shared/maths/banded.ts`**: the engine behind every new topic. A topic is a set of question *families* grouped in bands; band = `QuestionContext.level`. Same 60/30/10 focus/review/stretch mix, mastery boxes and repeats as times tables (`pickFromPools`, split out of `pickFact`). Each question is made from its key + a few numbers (`params`), and `rebuild(key, params)` makes it again, so the N.6 server can check answers without trusting the browser.
- **Five new packs** in `shared/maths/skillPacks/` (`index.ts` lists all six with `makePack` and `topicOfKey`):

| Topic | Bands | Records |
|---|---|---|
| Place value and rounding | 4: 3-digit → 4-digit → rounding to 10/100 → rounding to 1000, 5-digit, × 10/100/1000 | 11 kinds |
| Adding and taking away | 4: facts to 10 + 10 → tens and bridging → 2-digit with/without regrouping, pairs to 100 → 3-digit, near-hundreds | 55 facts + 15 kinds |
| Division | 5: ÷ 2/5/10 → ÷ 3/4 → ÷ 6–9 → 2-digit ÷ 1-digit, ÷ 10/100, missing dividend → remainders, 3-digit ÷ 1-digit | 102 facts + 5 kinds |
| Fractions | 4: unit fraction of amount, compare same bottom → non-unit of amount, equivalents, compare same top → add/take away, mixed ↔ improper → compare any, simplify | 10 kinds |
| Decimals and money | 4: tenths → money (adding, change from $5/$10/$20) → hundredths, compare, × 10/100 → rounding, decimal × whole, fractions as decimals | 11 kinds |

- Wrong choices in multiple-choice mode are the real slips (47 + 36 → 73, 0.3 + 0.5 → 0.08, 1/2 = ?/8 → 7, $10 − $3.65 forgetting the borrow...), padded with near misses.
- **Question box** (`src/maths/QuestionModal.tsx`, used by Gem Keep too): fractions drawn top-over-bottom with the blank inside when needed, mixed numbers, a decimal point key, answers up to 6 digits, labelled "which is bigger?" choices, smaller word parts, long questions shrink to fit. Checked at 1366 × 640 and phone size; axe clean on 20 question boxes.
- **Practice page**: `npm run maths:preview` → `dist-preview-maths/` (every topic and band, one example per kind).
- **Curriculum tags are placeholders** (`TODO-...`), like times tables, for James to fill in from his alignment tool.
- Tests: `shared/maths/packs.test.ts` (every family: 400 rolls or every fact ×4 → sound answer, one blank, 4 distinct choices, plain sums re-solved from the screen, rebuild matches, bad numbers refused) + 5 new question-box tests. 165 maths tests pass.
- Known, not ours: `space-maths` has two stale server bundles (`save-bot-game`, `space-game` index.ts still have Mission Boost 3, code says 5). The Mission Control session's next `npm run build:functions` fixes it.

### N.2 results (done 17 Oct 2026, branch `monsters`)

- **`shared/monsters/`**, pure TypeScript, no screens, database or server: `types.ts` (six types, topics, wheel ×1.5 / ×0.75), `monsterBook.ts` (all monster data in one file), `bands.ts` (the easy-to-edit area → question band table, wild levels per area, quick-answer times), `rules.ts` (stats, damage, exp, catching, with every tunable number in one `TUNING` block), `engine.ts` (`play(state, action, random)`), `sim.ts` + `scripts/monsters-sim.mjs` (`npm run monsters:sim`).
- **Engine.** State is plain data and `play` never changes the one it is given. Actions: fight (attack + right / quick-right / wrong), switch, bag item (potions), catch (ball + answer), run. Wild and trainer monsters hit back with no question. A fainted monster is replaced free; losing keeps everything (`healTeam` returns the team full). `questionFor` says which topic and band to ask (attacks: the attacker's topic; catches: the wild monster's topic). `judgeAnswer` decides quick-right from the question's difficulty (topic + band), not a race, and "calm" turns it off. `replayBattle` replays a whole battle from its setup, actions and random numbers (for the N.6 server check).
- **Catching** (idea adapted from Monster Tamer, MIT, credited in `rules.ts`): about 20% at full health up to 60% nearly drained, ×2.2 after a right answer, ×2.8 quick-right, ×0.6 after a wrong one; grown monsters are harder; great balls ×1.6; never above 95%. Trainer monsters can't be caught or run from.
- **Exp and levels.** Monster Tamer's level³ curve made levels 30-40 take six times as many battles as 5-10, so it is level^2.5. Max level 50. Evolving happens by itself on reaching the level (about 15-18 for the first growth, 30-36 for the second). Friends who fought share the exp; trainers give ×1.5.
- **Bug the sim caught:** after choosing a replacement monster the battle stayed stuck in "choose a monster". Fixed, with a test.
- **Tests:** `shared/monsters/engine.test.ts`, 30 tests (the book, the wheel, damage, questions and bands, fights, switch / bag / run, catching, exp and evolving, the AI, replay, bad actions refused).

**Sim results** (`npm run monsters:sim`, 2,000 battles per row; pretend students; 4 s per move plus 8 s per question):

| What | 50% right | 75% right | 90% right |
|---|---|---|---|
| Wild battle, questions (areas 1-6) | 3.8-4.8 | 3.0-3.6 | 2.6-3.2 |
| Wild battle, minutes | about 0.9-1.0 | about 0.7 | about 0.6 |
| Wild battle won, first area (level-5 team) | 100% | 100% | 100% |
| Tower trainer (3 monsters), questions | 11-16 | 9-12 | 8-10 |
| Tower won | 75-94% | 97-100% | 100% |
| Levelling, battles per level gained | 2.0 → 4.8 | 1.9 → 3.9 | 1.9 → 3.4 |
| Whole game, battles in all (grind to each area's top level) | 153 | 129 | 116 |

- Wild fights are a little shorter than the plan's goal (3-5 questions, a bit under a minute of play by this clock); real students are slower than the sim's 8 s a question, so about 1-2 minutes is likely. Tower trainers are 10-15 questions for most students, a bit longer at 50%. A 50% student wins almost every first-area wild battle.
- Levelling is steady (2.6 to 7 battles per level, slowing gently), but the sim student grinds in each area until the lead matches the area's top monster, which first took 30-60 battles in areas 3-5. James chose more exp (yield 11/16/21 → 14/20/27), so it is now about 15-40.
- The sim student is a bit unlike a real one (always picks the best attack, never runs); real play will be messier.

**Monster names for James to OK** (first form → second → last):

| Type | Families |
|---|---|
| Leaf | Digibud → Tensprout → Thousandtree; Roundroot → Nearestree → Rounderoak; Placepetal → Valuebloom → Millibloom |
| Water | Plusplash → Sumsplash → Totalwave; Minnowus → Minusfin → Minusharker; Carrycrab → Regroupcrab → Kingcarrab |
| Fire | Factorch → Factoblaze → Factoinferno; Multipup → Multihound → Multiplosion; Squaremander → Cubemander → Powermander |
| Ice | Divvy → Quotipeng → Emperor Quotient; Remaindeer → Remainstag → Remaindreign; Sharebear → Splitbear → Polarsplit |
| Spark | Fractopus → Fractoshock → Fractostorm; Numeratot → Numerator → Numeratron; Denomibolt → Denomivolt → Denominator |
| Stone | Pebblepoint → Decimound → Decimountain; Coinrock → Dollarock → Goldilith; Centipebble → Centipillar → Centurock |

### N.3 results (done 17 Oct 2026, branch `monsters`)

- **Monster art** (`src/games/monsters/art/`): `MonsterArt` takes a species id and draws it as SVG from parts, no image files. All 54 work. 18 families, each its own shape (a bud, a fish, a crab, a penguin, an octopus, a caterpillar of pebbles...). First forms are small with big eyes and cheeks, grown forms add parts, last forms get angry eyes, grins and crowns / spikes / crystals. Shiny = a different colour set. Idle bob, hurt wobble, faint (sink and fade); all off for reduced motion. Every drawing is labelled with the monster's name.
- **Attack effects**: all 18 ids (`leaf-1` to `stone-3`) in three sizes (leaf swirl, splash and rings, flames, snowflakes, sparks, falling rocks), plus hit flash, "Critical!" pop and floating damage numbers.
- **Battle screen** (`BattleScreen.tsx`, a normal React page): foe top right, your monster bottom left, name / level / type / health (and exp) cards, Fight / Team / Bag / Run (keys 1-4, Run hidden against trainers), `QuestionModal` from `questionFor` + `makePack`, the engine's events played one message at a time with Next and Skip, Team, Bag (potion target list, ball catch question), forced "choose your next monster", evolution moment, results sheet, and settings (Calm, number pad / multiple choice, saved on the device). Losing heals the team and keeps everything.
- **Question box on a phone on its side**: `maths.css` now puts the pad beside the question at heights under 460 px (it ran off the bottom before). Gem Keep benefits too.
- **Test page**: `npm run monsters:preview` builds `dist-preview-monsters/`: monster book (54, shiny toggle, effects gallery) and battle playground (team of up to 6 with type / form / level, wild or trainer of up to 3, area and far side, bag, "almost levels up" and "ready to grow" buttons). Nothing is saved.
- **Not wired into the dashboard or game registry.** No database or server.
- **Checked** in a real browser at 1366 x 640 and 844 x 390: menu, moves, question, team, bag, catch question, evolution, results. axe: 0 problems on the book, playground, message, menu, settings, moves, question, team, bag, catch question and results at both sizes. Two things axe found and fixed (no page heading on the test page, one low-contrast type chip).
- **Tests**: 20 new (`MonsterArt.test.tsx`, `BattleScreen.test.tsx`: all 54 draw and are labelled, 18 effects, a scripted battle: fight right / wrong, keys, Calm, switch, potion, catch, run, win with level-up and evolution, lose with healing, forced switch, trainer, settings). Full suite: 930 pass. Known failures: the two stale server bundles (`save-bot-game`, `space-game`), same family as before. Two more tests (101 stats, chess bot) failed once under load and pass alone; they are random, not ours.

### N.4 results (done 17 Oct 2026, branch `monsters`)

- **Rules** (`shared/monsters/world/`, pure, tested): `mapLoader.ts` (reads Tiled JSON and lists everything wrong with a map), `checkWorld.ts` (every door leads to a real free tile, you can walk from the start to every door, sign, person, trainer and patch of grass), `walking.ts` (blocking, shortest path, tap plan, camera), `encounters.ts` (the `ENCOUNTERS` block: 12-20 steps in long grass, 2-3 with "More battles"; wild levels; trainer sight), `world.ts` (`step`, `interact`, `afterBattle`, battle set-ups), `rng.ts` (seeded). `WorldState` is plain data (map, tile, facing, team, box, bag, beaten trainers, last healing spot, seed, grass counter, repel, steps); a JSON round trip changes nothing, so N.6 can save it as is. A place for Repel is there (`repel` steps left, 0 for now).
- **Maps** (`shared/monsters/maps/*.json`, Tiled format, made by `node scripts/make-monster-maps.mjs`, which is a short list of steps like `path`, `house`, `sign`; edit that or open the JSON in Tiled): **Harbour Town** (24 x 18: healing centre, the teacher with 5 pages, monster box, monster book, 4 signs, a pond, a fisher), **Healing Centre** (10 x 7, inside, Nurse Joy), **Area 1: Kauri Bush** (25 x 20: long grass, 3 people, trainer Ranger Kiri, exit to town, and a rope fence over the gap at the top right marked as the closed path to area 2 / Shell Beach).
- **Wild monsters in Kauri Bush** (first forms): Digibud (Leaf), Plusplash and Minnowus (Water), Multipup (Fire), Divvy (Ice), Pebblepoint (Stone), Fractopus (Spark). Levels 2-4 on the town half, 4-6 on the far (north) half, which also uses the harder question bands. Ranger Kiri has Digibud 4 and Plusplash 4 and always fights at the far-half bands.
- **Art** (see `src/games/monsters/world/assets/kenney/CREDITS.md`): Kenney **Tiny Town** 1.1 (grass, paths, trees, bushes, houses, fences, signs, barrel/box) and **Tiny Dungeon** 1.0 (people, chest, shelf, counter, brick walls, banner, floor), both CC0, licence re-read on kenney.nl on 17 Oct and each pack's `License.txt` kept beside its `tilemap_packed.png`. Roguelike RPG was also checked (CC0) and not needed. Tiny Town has no water or long grass, so `scripts/make-monster-extra-tiles.py` draws those 3 tiles (2 water frames and long grass) from Tiny Town's own colours into `assets/extra-tiles.png`.
- **Screens** (`src/games/monsters/world/`): `WorldGame` (canvas map, HUD with team and Settings, talk box under the map as a polite live region, on-screen arrows, battle in place of the map via the unchanged `BattleScreen`), `controller.ts` (timing: 200 ms a step, 110 ms to turn, so about 5 tiles a second), `render.ts` and `tiles.ts` (each map is painted once, a frame is one scaled copy, whole-number scale, no smoothing, people cached in 4 facings). Keys: arrows / WASD, Space / Enter / E. Touch: tap a tile to walk the shortest way, tap a person or sign to walk up and talk, optional arrows + Talk button (setting, off by default, saved on the device). Settings: Calm, choose answers, on-screen arrows; the first two go straight to the battle.
- **Trainer**: sees you in a straight line up to 4 tiles ahead (not through trees), "!" for 0.7 s, walks up, talks, battles. One fight per visit; leaving the map (or losing) starts a new visit.
- **Losing** wakes you at the last healing spot (the healing centre until you talk to another nurse), team healed, bag, box and everything else kept. Catching: the battle already puts the monster in the team or the box.
- **Test page**: `npm run monsters:preview` gets a third tab, **Walk around** (start box for two types at level 5, Test controls: Teleport to home town / healing centre / Kauri Bush / next to the trainer / next to the long grass / next to the closed path, and More battles). `npm run monsters:single` makes one self-contained HTML file (`dist-preview-monsters/maths-monsters-test-page.html`) that was published as a private Artifact.
- **Not wired** into the dashboard, registry, database or server. Nothing is saved.
- **Checked** in a real browser (Chromium) at 1366 x 640 and 844 x 390 (phone, also with touch and 2x pixels): town, healing centre, bush, a sign, the trainer's "!", the challenge, a trainer battle, a grass battle starting (flash then battle), tap-to-walk and the arrows. axe: 0 problems on the start box, the map, the talk box open, settings open, the map with arrows and the healing centre at both sizes. **Smoothness**: counted `requestAnimationFrame` gaps over 12 s of walking in the bush: 60 fps, 1 gap over 20 ms (one 167 ms hitch at the first draw, now avoided by painting every map when the pictures load), and with the CPU slowed 4 times (a stand-in for a slow Chromebook) no gap over 17 ms; drawing a frame took 0.1 ms on average and 3 ms at worst (0.4 and 11 ms slowed 4 times). A frame is only drawn when something changed.
- **Tests**: 54 new. `world.test.ts` (35: maps load and check, doors, reachability, loader errors, walking, camera, shortest paths, encounter step counts over 60 seeded walks, same seed same walk, levels, More battles, Repel, trainer sight and once per visit, healing, losing, JSON round trip), `controller.test.ts` (13: turn then step, never faster than a step per 200 ms, smooth position, tap walk, tap to talk, locks, trainer "!" and walk up) and `WalkPage.test.tsx` (6: the Walk around page plays a step, a talk, settings, a grass battle won and back on the map, and a loss that ends at the healing centre). Full suite: 985 of 987 pass. The 2 failures are the known stale server bundles (`save-bot-game`, `space-game`). The two random tests (101 stats, chess bot) passed this time.
- **Rough or for James to decide**: (1) each Kenney person has one picture, so left/right only slide the face over and "up" shows the back of the head (looks fine, not like a real 4-direction sprite); (2) the long grass tile is busy and the bush is mostly grass; (3) no sounds on the map yet; (4) no team or bag menu on the map (potions only in battle), box and book say "coming soon"; (5) the area-2 name Shell Beach, the people's jokes and tips, and "Nurse Joy" are my words to OK; (6) walking speed (5 tiles a second) is easy to change in `TIMING`.

### N.5 results (done 18 Oct 2026, branch `monsters`)

- **Five more areas** (25 x 20 each, made by `node scripts/make-monster-maps.mjs`, now split into `scripts/monster-maps/`): **Shell Beach** (Water, sand and sea), **Fire Mountain** (Fire, ash, lava, autumn trees), **Snowy Peaks** (Ice, snow, pines, frozen pond), **Glowworm Caves** (Spark, dark cave, glowing moss, crystals) and **Harbour City** (Stone, cobbles, houses, the harbour). The order and topics match section 4 (area N = type N, badge = the type's name). Each has long grass in the near and far half, 3-4 people (tips and jokes), 1-2 trainers, 4-6 signs, 2 chests, a rest hut with a nurse, and a Tower. Kauri Bush got a Tower, a rest hut (Nurse Pania), a second chest and a real gate too.
- **Topic Towers**: a building you walk into, then two small rooms (hall with a guide and a ladder, top floor with the Tower trainer). The Tower trainer has 3 monsters at the area's top wild level, +1 and +2 (levels 6-8, 12-14, 19-21, 27-29, 36-38, 45-47), always fights at the far-half bands, and gives the badge and a prize (super potion, 2 great balls) the **first time only**. Holding the badge, they just chat. The way on is a rope **gate** that is shut until you hold the badge; it says which badge is missing. `checkWorld` runs with and without badges: with none you reach only the town and Kauri Bush, and each badge opens exactly the next area; with all six the whole world is reachable.
- **Wild lists use families** (`digibud`), so the form follows the level (`formAt`, moved to `monsterBook.ts`); a name written twice turns up twice as often. Trainer teams are `family:level` too.
- **Where each family lives.** Every family's first form can be caught by area 2; its grown forms turn up where its levels are high enough. The area with the family's own type has all three of its families twice as often.

| Type (area) | Families | First forms in | Second forms in | Last forms in |
|---|---|---|---|---|
| Leaf (1 Kauri Bush) | Digibud, Roundroot, Placepetal | areas 1 (common) | 3, 4, 5 | 5, 6 |
| Water (2 Shell Beach) | Plusplash, Minnowus, Carrycrab | 1, 2 (common) | 3, 5 | 5, 6 |
| Fire (3 Fire Mountain) | Factorch, Multipup, Squaremander | 1 and 2 | 3 (common), 4, 5 | 5, 6 |
| Ice (4 Snowy Peaks) | Divvy, Remaindeer, Sharebear | 1, 2 | 3 (a few), 4 (common) | 5, 6 |
| Spark (5 Glowworm Caves) | Fractopus, Numeratot, Denomibolt | 1, 2 | 3, 5 (common) | 5 (common), 6 |
| Stone (6 Harbour City) | Pebblepoint, Coinrock, Centipebble | 1, 2 | 3, 4, 5 | 5, 6 (common) |

  (Exact list per area is the `wild` property in `scripts/monster-maps/*.mjs`; a test lists every species that can be met and checks that all 54 are met or reached by growing.)
- **Monster book** (`MonsterBookScreen`): all 54, met or owned in full, the rest a dark shape with "?" (no name, no tooltip), details with type, topic, family, attacks and growth. **Box** (`BoxScreen`): team 1 to 6, never empty, no typing. `WorldState` gained plain data: `badges`, `seen`, `owned` (sorted arrays), `chests`, `paid` (trainers who already gave their prize). Both screens open from the box and book in Harbour Town and from the menu.
- **Menu** (Menu button, M or Escape): Team (swap order), Bag (potions on a hurt monster, Repel, balls greyed), Monster book, Badges, Settings, same Sheet look as the battle. Walking is locked while it is open.
- **Items**: `repel` added as an item (50 steps in long grass, from the bag menu, found in chests). Prizes are one easy block, `shared/monsters/world/rewards.ts` (`LOOT`). Trainers pay once; each chest opens once.
- **Sounds** in `src/games/sounds.ts` (door, talk blip, wild-battle flash, heal jingle, badge fanfare, chest), on only when the hub's speaker button is on.
- **Battle rules not changed.** One small addition: `'repel'` is a valid `ItemId` (a battle refuses it; the existing "not a healing item" rule covers it), and the battle `BagList` takes optional `items` / `ballNote` for the menu.
- **Test page**: Teleport lists every area (entrance, next to the trainer, long grass, a chest, healing hut, Tower door, gate), every Tower hall and "next to the Tower trainer"; buttons **Give me all badges** and **Give me a full team and bag** (six level-40 monsters, three in the box, full bag).

**Sim** (`npm run monsters:sim`, real wild lists, trainers and Towers; the route student keeps one strong lead and two weaker friends, so it is pessimistic for Towers 5-6):

| What | 50% right | 75% right | 90% right |
|---|---|---|---|
| Whole route, battles | 139 | 120 | 113 |
| Whole route, battling time (sim clock) | about 2.8 h | 1.7 h | 1.4 h |
| Tower won, team ready (3 at the area's top level), areas 1-6 | 95, 96, 94, 90, 82, 83% | 98-100% | 99-100% |
| Tower won, team 3 levels behind | 15-59% | 27-92% | 49-98% |
| Tower fight length (ready) | 10-16 questions, 2.4-3.4 min | 8-12, 1.9-2.6 min | 7-10, 1.7-2.3 min |
| Towers beaten first time on the route | 100, 90, 75, 73, 28, 28% | 100, 95, 90, 83, 50, 68% | 100, 100, 93, 88, 65, 88% |

- **Tuning**: none needed. The Towers are a real step up (three levels behind loses often) but a ready team usually wins, so no number was changed. Tower 5 and 6 are the hardest for a 50% student.
- **Checked** in a real browser (Chromium), 1366 x 640 and 844 x 390: every area, a chest, the nurse, every Tower door, the gate talk, the menu, team, bag, book, badges, settings and box. **axe: 0 problems** on all of them at both sizes (it found two things, both fixed: the book's scrolling detail panel was not keyboard-reachable, and the badges list scrolled with nothing focusable on a phone). **Smoothness** in Fire Mountain (animated lava), 12 s of walking: 60 fps, 0 frames over 20 ms; with the CPU slowed 4 times still 60 fps, 0 frames over 34 ms; a frame took 0.18 ms on average, 4 ms at worst (0.42 and 3.4 ms slowed).
- **Tests**: about 75 new (`areas.test.ts` 27, `routeSim.test.ts` 2, `MapMenu.test.tsx` 11, plus updates). Full suite: 1024 of 1027. The three failures: the two known stale server bundles (`save-bot-game`, `space-game`), and one Wormholes & Black Holes test that failed once under load and passes alone (not ours).
- **Rough, or for James to decide**: (1) the game is short by the sim's clock (1.4-2.8 h of battling, maybe 3-5 h with walking, reading, catching and slower answers, against the plan's 6-10 h): more exp needed per level (`TUNING.expCurve`) or higher wild levels would stretch it; (2) areas 2-6 have only the one outdoor look the packs allow (Kenney persons face the same way, trees repeat); (3) Tower rooms are plain; (4) `closed` objects are still supported by the loader but no map uses them now; (5) names Nurse Pania, Hinemoa, Mere, Aroha, Kowhai, Sina, the Tower trainers (Hemi, Moana, Rangi, Maia, Wiremu, Aroha), and all jokes and tips are my words to OK; (6) trainers who beat you in a Tower reset each visit only if you lack the badge; with it they only chat.

### N.6 results (built 18 Oct 2026, branch `monsters`; NOT live)

- **Merged `main` into `monsters` first** (Mission Control maths is live there; the two branches both changed `QuestionModal`). Nothing was merged the other way.
- **Saving.** New tables `monster_saves` (one row per student: the `WorldState` as JSON, a version number, counts for the board), `monster_events` (one row per accepted save: its battles with actions, maths questions and random numbers, plus counts and points) and `monster_refusals` (short codes for saves turned down). Students can't read or write them; they read their own through `my_monsters()`. Migration `20261018001500_maths_monsters.sql`.
  - Saves are made on a new game, at the nurse, after a Tower battle, on getting a badge, every 3 minutes of play (`AUTOSAVE_MS`) and when the page is hidden or closed. They go in a queue on the device (`src/data/monsters.ts`) with the unsent game and battles ("the tail"), so a Chromebook that loses wifi loses nothing.
  - Opening: the server's save, unless this device is ahead of it (it has saves the server hasn't heard of, or played on since). If another Chromebook saved since, the server's wins. No save anywhere = the new-game screen (pick two starters; no test controls).
- **The server check** (`shared/monsters/save/check.ts`, run by the new `monster` function): each reported battle is replayed with the real rules (`newBattle` / `play`), with every random number and every maths question checked: the question is made again from its key and numbers and marked here, and right / quick-right / wrong has to agree. The monsters you hold (team + box, ignoring order and health) must be exactly the ones you held, with the exp the replayed battles gave plus what you caught, so levels cannot jump. Also: team 1-6, real monsters and items, a tile you can stand on, a heal spot next to a nurse, areas only open with the right badges, a badge needs a won Tower battle, a trainer pays once, a chest opens once, the bag only holds what you had plus new prizes minus what battles used, seen / owned / badges / chests only grow, answers at most 24 a minute and at least 250 ms each, steps at most 6 a second, and wild battles no more often than the steps allow. A save follows the one before it (`seq`), and one that already got through (lost reply) is told "already saved" rather than checked again.
  - A catch needs a checked question. I read "needs a right answer" as: every throw carries a marked question. The rules still allow a throw after a wrong answer (x0.6 chance), so those saves are accepted. Say if you want a successful catch refused unless the answer was right.
  - **What happens to a bad save:** it is refused as a whole; the last good save stays exactly as it was; the website is told "refused" (not why), drops that save and everything queued after it, stops saving for the session and says (not scary): "Your game couldn't be saved this time. You can keep playing, and next time you open Maths Monsters you'll carry on from your last save." The next opening loads the last good save. A code goes in `monster_refusals` (the teacher page lists them with the real name) and the function log (never who). A save from an out-of-date copy ("stale") is treated the same.
  - Answers go in as answer events through `record_fact_answers` (one batch per topic per save, with ids made from the save id so a retry counts once), into the same records Gem Keep and Wormholes use. Those records' key rule was widened to allow the new topics' keys.
- **Points** (inside the shared 40-a-day cap, game is `ranked: false`): one block, `monster_point_rules()` in the migration: **1 point per 3 wild battles won, 3 per trainer, 8 per Tower badge (a badge can only be earned once)**. A normal 20-minute session is about 12-15 battles: roughly **7-10 points**; a 30-minute lesson 10-14; a first Tower badge adds 8. The cap stops it at 40 a day. Trainers can be fought again each visit to a map and pay their 3 points each time; the cap limits that.
- **Achievements (8):** first catch; 10, 25 and all 54 monster-book pages; 1, 3 and all 6 badges; a team of 6 fully grown monsters. Hidden (with the point rules) while the game is off.
- **Leaderboard:** "most monsters collected" (owned book pages, never seen-only), top 10 plus you, a new tab beside Gem Keep's stars.
- **New season** keeps the adventure and resets only points (all Maths Monsters scores, the half-made point, the save history). Decisions to check: Maths Monsters achievements stay (they belong to the kept adventure, so their bonus points stay too); the five new topics' maths records stay; times-table records are cleared with Gem Keep's, as before.
- **Teacher page:** the game switch (**off by default**; hides the card, board tab, achievements and point rules, and the server refuses saves), topics on/off (a switched-off topic's questions come from the nearest topic that is on, at that topic's band, in every fight and catch; the server accepts any topic at the area's band so a mid-lesson switch never refuses a save), the class view (each topic's right / asked, hardest questions in words, badge counts, refused saves) and each student's panel.
- **Wired in:** card on the dashboard (`monsters` in the registry), behind the switch. The test page keeps "Start again" and the teleports; the real game has neither.
- **Checked in a real browser** against the local Supabase and the `monster` function: new game, walk to the nurse, save (version 2), reload (same place), a second browser profile as the same student (same team, same map), six battles fought through the question box and saved (wins, questions and answers recorded in the maths records). That run also showed the server turning down a robot that answered in 50 ms. axe: 0 problems on the new-game screen, the world with its saving note, dashboard, leaderboard tab, how-points page and teacher page at 1366 x 640 and 844 x 390, except two contrast issues on the teacher page that belong to Mission Control's panel, and the hub top bar running off the right edge on a phone on its side (all pages, not new).
- **Tests:** 28 for the save check (honest play through all six Towers, and a refusal for each rule), 13 for the function, 14 for the device queue / opening / topics, battle report and topic swap, game page, teacher panels, and 84 database tests (saving in order, points and cap, achievements, board, switches, RLS, new season). `npm run build:functions` was run (it rebuilt the stale `space-game` bundle; `save-bot-game` was already right).
- **To raise with James:** the game is short by the sim's clock (1.4-2.8 h of battling against the plan's 6-10 h; the fix is `TUNING.expCurve` or the wild levels in `bands.ts`), and the names, jokes and tips in the maps still await his OK.

**LIVE 18 Oct 2026 (James said go): steps 1-4 below are done (migration `20261018001500` applied to the live database, `monster` function deployed with verify-JWT off, `monsters` merged into `main` and published). The game switch is still OFF: step 5 is James's. Answers: keep Maths Monsters achievements across seasons, allow a throw after a wrong answer, go live at the current length.**

**How it was to go live:** 1) merge `monsters` into `main` (main already has `space-maths`, so there is no merge-order problem; the one new migration comes after `...001400`); 2) apply the migration to the live database; 3) deploy the `monster` function (and, since `npm run build:functions` rebuilt it, `space-game`'s file is already the right one on main after merge); 4) push `main` so the site builds; 5) switch Maths Monsters on from the teacher page (and pick topics). Until step 5 nobody sees it.

### N.7 results (built 19 Oct 2026, branch `monsters`; not deployed, no database change)

- **Merged `main` into `monsters` first** (clean, no conflicts). Nothing here touches the database or the `monster` function, so there is nothing to apply or deploy. The changes are all in the website and the map-maker script, so they go live with the next publish of `main`.
- **How to play** (`src/games/monsters/HowToPlay.tsx`): nine short sections with real headings (Walking, Battles, Catching, Types and maths, Growing, Healing and the Bag, Towers and badges, Saving and points, Make it fit you). It is on the new-game screen (a "How to play" fold-out under Start walking) and in the map **Menu** (a new button). The six types, their topics, the six places and the Repel length are read from the game's own data, so they can't drift. The points are described in words and the page points to "How points work" for the numbers (they live in the database, not in the website code).
- **Accessibility pass** (real Chromium, keyboard only, then axe with the WCAG 2.0/2.1 A and AA rules, at 1366 x 640 and 844 x 390, and on touch):
  - **Keyboard only works end to end**: Tab to the game, start walking, arrows and W A S D walk, M opens the Menu, Tab moves through it, How to play scrolls with Page Down, a wild battle starts, keys 1-4 pick Fight and the attack, the question box takes the keyboard.
  - **Found and fixed:** (1) the Menu said it was a modal dialog but Tab walked out of it onto the page behind. Menus, Team, Bag and the result sheets now keep Tab inside (Tab and Shift+Tab go round). (2) Pages that are only words (How to play, Badges) scroll but had nothing the keyboard could land on (axe: "scrollable region"). They can now be focused and carry a name that says to use the arrow keys. (3) After starting a game the keyboard was lost on the page; the map now takes it. (4) The Menu button was 36 px tall; now 44 px.
  - **axe: 0 problems** on the map, Menu, How to play, Settings, Badges, Team, Bag, Monster book, a battle (intro, menu, move list) and the question box, at both sizes, and with the on-screen arrows on at three sizes (1366 x 640, 844 x 390 and a phone upright, 390 x 844). Two things axe calls "can't tell" are the place name and the Menu button over the moving map picture; worked out by hand, the place name is white on at least 82% dark navy (about 10 to 1 at worst) and the button is dark on white.
  - **Screen reader**: the map picture has a name that tells you the controls; "You are in X" is announced when the place changes; the team strip, health bars and talk box are announced; the Menu and sheets are named dialogs; the talk box takes focus so Space and Enter go on. Tests check the names. I did not run an actual screen reader program (NVDA, VoiceOver or ChromeVox); what is checked is the names, roles and focus those programs read.
  - **Reduced motion**: the battle already switched off monster and effect movement. Added: the ball shrinking and shaking, the evolve flash, bars sliding and the foe fading are off, and walking through a door no longer fades in from white. Measured in the browser with "prefers reduced motion" on: no running animation anywhere in a battle (without it, the idle bob runs). A test now checks that every animation in the three style files has a reduced-motion answer, so a new one can't be forgotten.
  - **Tap to walk and the on-screen arrows**: tested with touch at three sizes. Tapping the map walks there (11,15 to 13,12 at 1366 x 640). Holding the left arrow walked two tiles. The arrow buttons are 52 px (44 px on a phone on its side) and the Talk button 96 x 64.
- **Slow-Chromebook check** (real Chromium, 1366 x 640, processor slowed with the browser's own throttle; 4 times is a typical cheap Chromebook, 6 times is harsher):

| | normal | 4 x slower | 6 x slower |
|---|---|---|---|
| Open the game to the map drawn (all 20 maps are painted up front) | 0.4 s | 1.1 s | 2.0 s |
| Walking 4 s: frames over 50 ms (of about 240) | 0 | 0 | 0 |
| Drawing one map frame, average / worst | 0.1 / 0.6 ms | 1.0 / 13 ms | 0.5 / 3 ms |
| Battle opening: frames over 50 ms | 0 | 0 | 0 |
| Pressing a move to the question showing | 0.12 s | 0.35 s | 0.09 s |
| An attack animation (1.5 s): frames over 50 ms | 1 | 0 | 0 |
| Memory used by the game's data | 6.6 MB | 7.3 MB | 7.4 MB |

  **Found and fixed:** walking was fine at 4 times slower but at 6 times slower about 1 frame in 10 was late (13 of 139 over 50 ms, measured before the fix). Cause: every step made a new game state, and that drew the six little team monster pictures again each time. The team strip is now only redrawn when the team changes. After the fix, 0 late frames at 6 times slower. Loading (the one moment that grows with a slow computer) is about 2 seconds at worst, once, and the screen says "Loading the map…". The numbers are from the stand-alone test page on this computer, not a real Chromebook.
- **"A tall tree shuts the path" and the map-maker warnings are now covered by tests.** Before, the fix had one check on two rows of Kauri Bush, and the warning in the map-maker script had no test at all. New `scripts/monster-maps/lib.test.ts` (16 tests): a tall tree, the crown of a tall tree, and every other tree, bush, rock, boulder, crystal, palm and snow tree standing on a path each give a warning that names the map and tile; trees beside a path give none; making all the maps gives no warnings; and the maps in `shared/monsters/maps/` are **exactly** what the map maker makes (so a hand edit, or an old file, fails the test). The warning is wider than before: it used to cover only some trees; it now covers every kind of blocking scenery. No existing map had a problem. The Kauri Bush walking test (`areas.test.ts`) is unchanged and still passes, as does the "walking the whole route" check that every door, sign, person and trainer can be reached.
- **Docs**: this section; the README has a Maths Monsters section (what it is, the teacher switch, saving, points, keyboard and screen reader notes, slow computers, how to make maps, credits), the folder map lists `games/monsters` and `shared/monsters`, and the server-function paragraph now names `monster`.
- **Tests**: 16 new for the map maker and 27 for How to play, keyboard and reduced motion (`HowToPlay.test.tsx`, `lib.test.ts`). Full suite: 2,509 passed, 1 failed, 1 skipped. The failure was `App.test.tsx` "opens chess ready to play the bot picked on the dashboard", which passes on its own (the machine was busy); not ours. Type check is clean. The slow Gem Keep campaign test passes.
- **Not done, on purpose**: no deploy, no database change, no push. The browser checks were on the stand-alone test page (the same game screens), not the live site: the live page also has the hub's top bar, which has a known issue on a phone on its side (all pages, not new). Still waiting for James: the names, jokes and tips (from N.5) and the game length (N.5/N.6). The game switch is already ON (checked 19 Oct 2026 on the live database: school and class both on). The topics on are add-sub, decimals, division, fractions and times-tables; **place value is off**, so Leaf questions (Kauri Bush) are being swapped for another topic. Left alone for James.

## 11. Ideas for later

- **Battle a classmate** with your team (turn-based, so it fits the `multiplayer`-style server function). The maths questions are each player's own.
- Trading monsters with classmates (teacher switch, both must confirm).
- Daily "rare monster spotted in area 3" events.
- Seasonal areas (Matariki sky island).
- More topics: measurement, time, angles.

## 12. James's answers (17 Oct 2026)

| # | Question | Answer |
|---|---|---|
| 1 | Name | **Maths Monsters** |
| 2 | Topics | **The six as planned**, in that order (section 4) |
| 3 | Wrong answers | **A small hit (¼ damage) and the right answer shown** |
| 4 | New season | **Keep the adventure; reset only the points** |
| 5 | Leaderboard | **Most monsters collected** (monster-book entries, top 10 plus you) |
| 6 | Look | **Pixel-art world (Kenney CC0) with our own smooth SVG monsters** |
| 7 | World | **NZ places (bush, beach, volcano, snow...) with English names** |
| 8 | When | **Start now**, alongside Mission Control maths |

## Credits to carry over

- Battle flow, catch chance, exp curve and grid walking ideas adapted from *Monster Tamer* by Dev Share Academy (MIT, © 2024).
- Tiles from Kenney (CC0).
- Painted pictures (monsters, people, looks, places, badges, items) made by James with Z-Image Turbo in ComfyUI, Oct 2026 (`src/games/monsters/art/painted/CREDITS.md`).

## Painted art: went live 26 Oct 2026

Plan: `docs/prompts/maths-monsters-art.md`. Website PR #27, published by the run for PR #28 (the run for #27 hit the flaky checkers page test, now given 10 seconds).

- **Live:** 403 WebP pictures (9.4 MB): all 108 monsters, 50 people, 24 looks, 14 battle backgrounds, 6 badges and 5 items. Battles show the place's painting, trainers say hello with their picture and the pupil's look facing them, the talk box has portraits, the Badges page and Bag have pictures.
- **Choose your look (C4):** the `monster` function was deployed from `monsters-art` first (POST without sign-in gives 401). That bundle also brought `monster` up to the 2-minute answer-time cap the other games already had.
- **Checks:** monsters 117 tests, shared/monsters + function 140; axe 0 problems on every screen at 1366x640 and 844x390; reduced motion; no late frames at battle start with a 4x slower CPU.
- **Small things left:** a faint painted shadow beside the ball and potion pictures; Wee Hana's torch glow is soft; looks boy-08 and girl-11 fade out at the knees; a tiny made-up word on Ranger Kiri's name badge; the Harbour Town and Healing Centre backgrounds are made but no battles happen there.
- **Still to do:** James tries it as the teacher on a phone and a laptop.
- **Turning it off:** the Maths Monsters switch on the Teacher page, or revert the #27 merge and redeploy `monster` from main.

## Daily battle limit: built 27 Oct 2026 (branch `monsters-battle-cap`, PR #37)

James asked for **12 battles a day**. Live data from 17-27 Oct (211 battles, 27 students): a typical day was 3 battles, 1 day in 10 had about 10 or more, the most was 30. A wild battle is about 2-3 questions, a trainer about 6, and students fight roughly one battle every 2 minutes, so 12 is about 25 minutes and 40 questions.

- **What counts:** a battle that asked at least one maths question (running straight off doesn't), not in a Tower. Days are New Zealand days, like the points cap. One rule in two places: `countsTowardCap` in `shared/monsters/world/battleCap.ts` and `monster_counts_for_cap()` in the migration.
- **At the limit** the monsters rest: no wild battles in the grass, trainers don't challenge you and only chat (`RESTING_TALK`), and Tower trainers still battle so a badge is never held back (`WorldOptions.resting` in `world.ts`). The game page shows a note saying so, and How to play has a line about it.
- **How the game knows:** `my_monsters()` now returns `battles: { today, perDay }`. The game adds its own unsaved battles and keeps a count on the device (`sgh-monsters-battles:<player>`), so the limit holds offline and across a reload. Until the migration is applied, the game uses 12 and counts from zero each load.
- **The server:** migration `20261027000200_monster_battle_cap.sql` adds `monster_battle_rules()` (the number, easy to edit), `monster_events.counted_battles` (filled in for old saves), `monster_battles_today()`, and re-creates `record_monster_save()` and `my_monsters()` from the live versions with the limit added. Saves are **never refused** for it (a refused save loses the child's game): wins in battles past the limit simply earn no points, which covers two Chromebooks played offline or an out-of-date copy of the website. The `monster` function and the save check are untouched, so nothing to deploy.
- **Checked:** 5,022 tests pass (new: `battleCap.test.ts`, resting in `world.test.ts`, the page's resting note, the loader's count), typecheck, build. The migration was rehearsed on the live database inside a transaction that was rolled back (nothing kept): old saves filled in (143 counted battles in 82 saves); a student with 7 battles today sending 14 wild wins, a run-away and a Tower win had 14 counted, kept all 14 wins on the save, and was paid 4 points (5 wins under the limit = 1 point, plus 3 for the Tower) instead of 7.
- **Not checked:** no pgTAP file (no local database on this computer); not played in a browser against a database with the migration.
- **Going live:** 1) apply the migration; 2) merge to `main` (the website). Either order works: the old website ignores the new `battles` field, and the new website without the migration falls back to 12 counted on the device.

**Migration LIVE 27 Oct 2026 (James said go):** applied to the live database in one transaction. Checked afterwards: the limit reads 12; old saves filled in (143 counted battles in 300 saves); `record_monster_save` and `my_monsters` carry the change; pupils can still load (`my_monsters`) and can't call the new functions or save directly; the server can save; `scored_games` untouched (1,292 rows). One student was already over 12 today (20). **The website is not live until PR #37 is merged.**

## Battles left on the dashboard card: built 27 Oct 2026 (branch `monsters-moves-left`; NOT live)

The Maths Monsters card shows "Left today ⚔️ 8 of 12 battles", like Clan Quest's mine fights. Migration `20261027000300_monsters_moves_left.sql` re-creates `my_moves_left()` (only its own migration had made it) with a `monsters` field, `{ today, perDay }`, from `monster_battles_today()` and `monster_battle_rules()`; `my_home_page()` already calls it. A pupil with no save gets no line. The card counts saved battles only, so it can lag the game by the battles not yet saved. `movesFromRaw` in `src/data/movesLeft.ts` makes the chip (never below 0). **Going live:** apply the migration, then merge; either order is safe (the old site ignores the field, the new site shows no line without it).

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
| **N.7** | How to play, accessibility pass, slow-Chromebook check, docs | Small |

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

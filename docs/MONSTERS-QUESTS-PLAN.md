# Maths Monsters: quests, eggs, rare monsters and a painted world (plan)

*Written 2 November 2026 on branch `monsters-quests` (from `main` cf39de7), after the pupils' feedback James passed on: they want
quests, puzzles, items to wake sleeping monsters that block new areas, eggs that take several days to hatch (and need taking
somewhere warm, wet and so on), and uncommon, rare and ultra rare monsters. James also asked for a painted upgrade of the
maps and the walking characters, made on his gaming computer.*

**Status: PLAN ONLY, nothing built.** Questions for James are in section 12. The game as it is now (live since 18 Oct 2026)
is described in [MONSTER-PLAN.md](MONSTER-PLAN.md).

---

## The short version

- **Quests.** Each area gets a short story quest (3 steps) from someone who lives there, plus a **notice board** in Harbour
  Town with 3 small jobs a day ("Catch 2 Water monsters", "Win a battle on Fire Mountain"). A **quest log** and a one-line
  **"what next"** hint always show where to go. Rewards are items, crafting bits and eggs.
- **Crafting bits ("grinding").** Wild monsters drop bits of their type (Leaf → kawakawa leaves, Water → shells, Fire →
  embers, Ice → frost crystals, Spark → glow dust, Stone → pebbles). The Tinker in Harbour Town turns bits into things,
  including the special items that wake sleeping giants. The 12-battles-a-day limit stays, so collecting is spread over days,
  which is what we want.
- **Sleeping giants block 3 new bonus areas.** A huge sleeping monster lies across a path. Make the right wake-up item, wake
  it, battle it, and you can catch it (it's rare). Behind each giant is a new area with rarer monsters and an egg-hatching spot.
- **Eggs.** Found in quests, puzzles and the bonus areas. An egg needs **3 days of play** (days you answered at least one
  question, counted by the server so a changed Chromebook clock can't cheat it), then taking to its **hatching spot**: warm
  eggs to the hot springs, water eggs to the rock pools, cold eggs to the ice cave, and so on. Hatching shows the monster
  coming out, and an egg is the best way to get a rare one.
- **Rarity.** Four tiers: **common, uncommon, rare, ultra rare**. 6 of the 18 families we have become *uncommon* (one per
  type, seen less often, no new art). **6 new rare families** (2 forms each) and **3 ultra rare monsters** are added, so the
  monster book grows from 54 to **75** (the 3 giants have 2 forms each). Ultra rares only come from giants, eggs and the last story quest.
- **Puzzles** in the world: stepping stones on multiples, an ice slide, boulders to push, lanterns to light in order, a
  number-lock chest with clues on signs. They give bits, eggs and items.
- **More variety:** today's weather (rain brings out Water monsters, a clear night brings Spark ones), a "rare monster
  spotted" note each day, and your lead monster walking behind you.
- **Painted world.** Each area repainted on the gaming computer *over the existing map*, so every path, wall and patch of
  long grass stays exactly where it is. Painted walking characters made from the pupil's chosen look and the painted people.
  A style test on Kauri Bush first.
- **Seven stages** (section 10). Nothing goes live without James saying so, one step at a time.

---

## 1. What we have to work with (checked in the code, 2 Nov 2026)

- **18 families, 54 species, 6 types**, each type a maths topic. Shinies at 1 in 64. Every one painted (plain and shiny).
  **No rarity** yet: an area's wild list just names some families twice to make them more likely.
- **Six areas in a line** (Kauri Bush → Shell Beach → Fire Mountain → Snowy Peaks → Glowworm Caves → Harbour City), each
  opened by the last area's badge through a rope-fence gate. Maps are Tiled files with 16-pixel tiles from a free tile pack.
- **Talk is fixed text.** People, signs, chests, gates and trainers exist, but there is **no story-flag system**: the save
  only remembers badges, opened chests, paid trainers and the monster book.
- **Items:** potion, super potion, ball, great ball, repel. **No money and no shop.** Items come from chests and trainers.
- **The save is checked hard on the server.** Every battle is replayed with the real rules, every question is rebuilt and
  marked, and the save's shape is checked against a strict list. A new kind of thing in the save means changing that check
  (in `shared/monsters/save/check.ts`), which the `monster` function runs, so this work **needs a function deploy**.
- **The device clock isn't trusted.** The game is never told the server's time. Anything that counts days (eggs) must be
  counted by the database.
- **12 counted battles a day**, then the monsters rest (Tower battles still allowed). Points: 1 per 3 wild wins, 3 per
  trainer, 8 per new badge, inside the hub's 40 a day. Eight achievements. Leaderboard: most monsters in the book.
- **New season keeps the adventure** and resets only points.

## 2. Quests

### Story quests (one per area, plus a finale)

Each area has a person with a 3-step quest. The steps use things the area already has, so they need little new map work:

| Area | Quest giver | The story, in short | Reward |
|---|---|---|---|
| Kauri Bush | Ranger Kiri | Find 3 lost seed pods (hidden spots), catch a Leaf monster for the nursery, beat the bush trainer | Egg (leafy) + 5 balls |
| Shell Beach | Lifeguard | Clear the rock pools: win 3 battles on the beach, solve the stepping stones, show her a Water monster at level 12+ | Egg (water) |
| Fire Mountain | Old miner | Bring 5 embers, light the lanterns in the lava tube, beat the hot springs trainer | Wake-up item part |
| Snowy Peaks | Hut warden | Do the ice slide, catch an Ice monster, bring 5 frost crystals | Egg (cold) |
| Glowworm Caves | Cave guide | Count the glowworm groups (a light number puzzle), find the lost torch, beat the deep cave trainer | Wake-up item part |
| Harbour City | Harbour master | Push the boulders off the wharf, deliver a parcel to Harbour Town, beat 3 city trainers | Egg (stony) |
| **Finale** (after all six badges) | The Professor | Wake all three giants and hatch an egg of each kind | **Choice of one ultra rare egg** |

### The notice board (3 small jobs a day)

- In Harbour Town. Three jobs a day, new each New Zealand day, picked from the pupil's own areas ("Catch 2 Fire monsters",
  "Win 3 battles in Shell Beach", "Use a repel", "Bring 3 shells"). Each one is quick (5 to 10 minutes) and gives bits, balls
  or potions. A day's three jobs are worked out from the date and the pupil (a pure function), so the server can check them.
- **Jobs never need more than the 12 battles**, and at least one job a day needs no battle (bring bits, solve a puzzle, visit
  a place), so a pupil who has used their battles still has something to do.

### The quest log and the "what next" line

- **Quest log** in the map menu: each quest with its steps ticked off, and the board's 3 jobs.
- **A "what next" line** above the map, always there (like Star Trader's Bolt and Clan Quest's next-step line): one sentence,
  with real names, e.g. "Bring 2 more embers to the old miner on Fire Mountain". It is worked out fresh from the save by a pure
  function. This also helps new pupils, who at the moment can wander without knowing what to do.

### How it's built

- A small **flag system**: `flags` (things that have happened, which only ever grow) and `quests` (each quest's step). Quests
  are data in `shared/monsters/quests/`, not code: each step is "catch", "win at", "bring", "show", "visit", "solve" or "talk".
- People's talk can change with flags (`talkIf` on a person: different words before, during and after their quest).
- **The server checks quest progress from what it already replays.** "Catch 2 Water monsters" can be checked against the
  battles in the save. Rewards can only be given once, like chests today.

## 3. Crafting bits and the Tinker

- **Bits drop from wild battles you win**: one bit of the monster's type, sometimes two (rolled with the battle's own dice,
  so the replay agrees). Trainers give 2. Bits are also found at a few spots that refill daily, from puzzles and the board.
- **The Tinker** (a new person in Harbour Town) makes things from bits:

| Make | From | What it does |
|---|---|---|
| Potion / ball | 3 bits of any kind | The basics, so a pupil never runs out |
| Great ball | 4 pebbles + 2 glow dust | A better catch |
| Repel | 3 kawakawa leaves | 50 steps with no wild battles |
| **Warm whistle**, **Tide bell**, **Frost horn** | 10 to 15 bits of two types, plus a quest part | Wakes a sleeping giant (section 4) |
| **Egg warmer** | 6 embers + 4 kawakawa | Counts a day of play twice for one egg (once per egg) |
| Hats for your lead monster | Lots of bits | Just for fun, no power |

- **How long it takes:** at 12 battles a day a pupil wins about 10 and gets about 12 bits, so the first wake-up item takes
  about **3 to 5 days of play**. The simulator (`scripts/monsters-sim.mjs`) will set the numbers.
- No money is added. Bits are the only thing you collect, which keeps it simple for 9-year-olds.

## 4. Sleeping giants and the three bonus areas

A giant monster asleep across a path ("Zzz…" floating up, snoring sound). Talking to it says what might wake it.

| Giant (working names) | Where it sleeps | Wake it with | The bonus area behind it | Hatching spot there |
|---|---|---|---|---|
| **Snorumble** (Stone/Fire) | A side path off Fire Mountain | Warm whistle | **Steam Valley**: hot springs and geysers | Warm eggs (hot springs) |
| **Drowsea** (Water/Ice) | A sea cave on Shell Beach | Tide bell | **Lagoon Isle**: a lagoon reached by stepping stones | Water eggs (rock pools) |
| **Yawnberg** (Ice/Spark) | A pass on Snowy Peaks | Frost horn | **Aurora Hollow**: an ice cave lit by southern lights | Cold eggs (ice cave) |

- **Bonus areas are side paths, never the main road**, so no pupil is ever kept from a badge by bits. Each opens after that
  area's badge, so younger players don't meet strong monsters too early.
- Waking a giant starts a **giant battle** (it doesn't count towards the 12, like Tower battles). Win and it can be caught; it
  is rare and has 2 forms. Run or lose and it settles back down to sleep, and you can try again without a new item.
- Each bonus area is about the size of an existing area, with its own wild list (mostly uncommon and rare), one trainer, one
  puzzle and one egg nest. Monsters there are the level of the area they hang off.
- The other three hatching spots go in existing areas: **leafy eggs** at the old kauri in Kauri Bush, **glowing eggs** at
  the crystal pool in Glowworm Caves, **stony eggs** at the quarry in Harbour City.

## 5. Eggs

- **Getting eggs:** story quest rewards, puzzle prizes, an egg nest in each bonus area (one egg a week, found by searching),
  and the finale. **Up to 3 eggs** carried at once, in a new **egg basket** in the menu.
- **What's inside:** the egg's kind (warm, water, cold, leafy, glowing, stony) shows its type. Inside is decided when it's
  found, rolled by the game's dice: about 50% uncommon, 40% rare, 10% ultra rare (finale eggs are always ultra rare). It has
  the usual 1-in-64 shiny chance. The pupil doesn't know what's inside until it hatches.
- **Hatching, step 1, keep playing:** the egg needs **3 days of play** after it was found (rare eggs could need 5; see
  section 11). A day of play is a New Zealand day when the pupil answered at least one Maths Monsters question, **counted by
  the database**. The basket shows "2 of 3 days" and the egg wobbles more each day. Days don't have to be in a row, so a pupil
  who is away isn't punished.
- **Hatching, step 2, take it home:** once ready, the egg says "This egg feels like it wants somewhere warm…". Walk to the
  hot springs (or rock pool, ice cave…), stand in the glowing ring and choose Hatch. A short hatching scene, then the monster
  joins the team at level 5 (or the box if the team is full).
- **How the server trusts it:** the database keeps a count of play days per pupil (`monster_saves.play_days`, plus the last
  day counted), going up only by its own clock. `my_monsters()` sends it to the game. An egg remembers the count when it was
  found, and the save check refuses a hatch until the count is high enough. An egg's contents are fixed when found, so
  reloading can't re-roll them.

## 6. Rarity

| Tier | What | How many in the book | Where from | Book look |
|---|---|---|---|---|
| Common | 12 of today's families | 36 | The long grass, as now | Plain |
| Uncommon | 6 of today's families (one per type), now rarer in the grass | 18 | The grass (about 1 in 8 battles), bonus areas, eggs | Green ring, ★ |
| Rare | **6 new families**, one per type, 2 forms each, plus the 3 giants (2 forms each) | 12 + 6 | Bonus areas (about 1 in 20 battles there), eggs, giants | Blue ring, ★★ |
| Ultra rare | **3 new monsters**, one form, two types each | 3 | Ultra rare eggs, the finale | Gold ring, ★★★, a sparkle when it appears |

That makes **75** in the book (54 + 12 + 6 + 3). The 6 giant forms count as rare.

- **Strength:** rares are a little stronger than a common at the same level (like a fully grown form), and ultra rares a bit
  more, but **never so strong that the Towers become easy**. Answering questions is still what wins. Ultra rares with two
  types ask questions from either topic (the pupil chooses which attack).
- A **"rare monster spotted today"** note on the notice board names one area where an uncommon or rare is twice as likely
  that day (worked out from the date, the same for the whole class: something to talk about in the playground).
- **Fairness:** a caught wild monster is already checked by replaying the battle (the foe must be one the map can give), so
  rares get the same protection for free. Eggs are checked as in section 5.
- **New art:** 6 rare families × 2 forms + 3 giants × 2 forms + 3 ultra rares = **21 new monsters**, painted plain and shiny
  on the gaming computer (42 pictures, plus small copies), with SVG parts as the fallback like today.
- **Names** follow today's punny maths style; James OKs the list in Q.1.

## 7. Puzzles

All logic or light number sense, quick (1 to 3 minutes), done on the map with the normal controls. **None of them count as
maths practice** or produce answer records (the maths practice stays in the battles, from the focus-approved skill packs).
Each can be retried as often as you like, and a "show me" hint appears after 3 tries.

| Puzzle | Where | How it works |
|---|---|---|
| **Stepping stones** | Shell Beach, Lagoon Isle | Cross the pond stepping only on stones with a multiple of the number on the sign. A wrong stone: splash, back to the start |
| **Ice slide** | Snowy Peaks, Aurora Hollow | You slide until you hit a rock. Find the way to the chest |
| **Boulder push** | Harbour City | Push crates off the wharf path into the right spots |
| **Lantern order** | Fire Mountain lava tube | Light lanterns in a number pattern (3, 6, 9… or 2, 4, 8…) to open the door |
| **Number-lock chest** | Glowworm Caves, Steam Valley | The code comes from clues on signs around the area ("my first digit is half of 8…") |

- New map things: `stone`, `ice` (a slide tile), `crate`, `lantern` and `lock`. Puzzle state is per visit (it resets if you
  leave), and solving sets a flag once. The server checks the flag can only be set once and gives the prize once.

## 8. More variety (James asked for ideas)

Picked because they're cheap and give pupils a reason to come back and explore. Recommended in this order:

1. **Today's weather and time of day.** Each area has a weather each NZ day (sunny, rain, wind, fog, worked out from the date)
   and the map is darker after 4 pm. Rain makes Water monsters more common, fog Spark, wind Leaf. It's shown as a tint and a
   small icon, and the "what next" line can mention it. Costs almost nothing.
2. **Your lead monster walks behind you** on the map (using the painted art, section 9). Children love this, and it makes the
   team feel like theirs.
3. **Monster helpers on the map:** a Fire monster on your team lights the dark corners of the caves (finding hidden chests),
   a Stone monster can move small rocks. It's a gentle reason to train every type, which means practising every topic.
4. **Fishing spots** at the beach and lagoon: cast, wait, press at the right moment, and a Water monster bites (counts as a
   normal battle).
5. *Later, its own plan:* a **whole-class goal** ("our class has hatched 40 eggs: the harbour festival opens") and trading
   eggs with a classmate (teacher switch, both must agree). These need new shared database pieces, so they're not in this plan.

## 9. Painted world (maps and walking characters)

**Today:** 16-pixel tiles from a free tile pack, enlarged with crisp pixels, and 16-pixel walking figures that bob. They look
blocky next to the painted monsters, people and battle scenes.

**The idea:**

- **One painted picture per map, made over the real map.** The game draws each map as it is now; the gaming computer then
  repaints that picture in the painted style (the same ComfyUI set-up as `scripts/monsters-art.py`, starting from the drawn
  map so the shapes stay put). Paths, walls, water and long grass stay on the same squares, so **walking, battles and the
  server's checks don't change at all**. Only the picture behind the player changes.
- **Things above the player** (tree tops, roofs, bridges) are cut out as a second painted layer drawn over the player, so you
  can still walk "behind" a tree. Long grass gets a gentle sway and water a shimmer, drawn on top in code.
- **Painted walking characters**: the pupil's chosen look (24), the people (50) and trainers, each painted from above facing
  four ways, made from their existing painted pictures. Walking keeps the bob plus a slight lean (painted walking frames rarely
  match from one frame to the next, so we don't rely on them).
- **The lead monster following you** uses the existing painted monster pictures, small, with a shadow.
- **Size:** about 30 maps × 2 layers, at about 2 to 4 MB in all (WebP), loaded one area at a time, with the tile drawing
  kept as the fallback while a picture loads (and for the Tiled tools).
- **Style test first (stage Q.2):** Kauri Bush painted in 2 or 3 styles (e.g. bright storybook like the home page cards; soft
  watercolour like the battle backgrounds; a richer "painted game" look), with one walking pupil on each. James picks one
  before the other maps are done.
- Checks: a slow Chromebook (no late frames when walking), 1366 × 640 and a phone in landscape.

## 10. Stages

Each stage stops for James. Stage Q.2 (art test) doesn't depend on the others and can run alongside Q.1.

| Stage | What | Size |
|---|---|---|
| **Q.1** | Rules only, in `shared/monsters/`: flags, quests as data, bits and crafting, rarity tiers and weights, eggs, weather. The "what next" function. Simulator: how long the first wake-up item and the first hatch take. Monster names list for James | Medium |
| **Q.2** | Art test on the gaming computer: Kauri Bush in 2–3 styles with a walking pupil. **James picks a style** | Small |
| **Q.3** | Paint the 21 new monsters (plain and shiny) and the 3 giants asleep. Item and bit pictures. Egg pictures for the six kinds | Medium (mostly computer time) |
| **Q.4** | World and screens: the Tinker, the notice board, quest givers and talk that changes, quest log, egg basket and hatching scene, the "what next" line, the 3 giants and 3 bonus area maps, the 5 puzzles, weather tint, lead monster following. Phone preview updated (`npm run monsters:preview` or similar) | Big |
| **Q.5** | The server: save check accepts the new parts (flags, quests, bits, eggs, crafting), egg hatch checked against play days, giant battles don't count towards 12. **One migration** (play days on `monster_saves`, `my_monsters()` returns them, new achievements, quest points if James wants them). `monster` function rebuilt | Medium |
| **Q.6** | Paint the rest of the maps and characters in the chosen style | Medium (mostly computer time) |
| **Q.7** | How to play page, accessibility pass, slow-Chromebook check, a go-live prompt (`docs/prompts/monsters-quests-golive.md`). Then **go live in James's order**: migration, function deploy, merge | Small |

**Order of going live (later):** the migration first (old website ignores the new fields), then the function (it must still
accept saves from the old website: the new parts are optional), then the website. The painted maps can go live separately at
any time, since they don't touch the save.

**Tests (TESTING.md):** this is a change to an existing game, so **at most 2 new tests**: (1) the save check refuses a hatch
before enough play days, and a prize given twice; (2) the "what next" line and quests across many seeds never point at
something impossible. The existing battle-replay tests already cover rares from the grass.

**Shared files touched (one-line edits at the end):** `my_monsters()` is the game's own function, but `my_moves_left()` is
not touched. No change to `shared/maths/`.

## 11. Design checklist (guide section 1a)

- **Big goal:** fill the 75-monster book, with three ultra rares as the top prize. A pupil playing 3 to 4 days a week should
  wake their first giant in week 1 to 2 and could finish the finale in about a season (simulator to check).
- **Season game?** No change: the adventure is kept; daily jobs reset each day.
- **Moves a day:** 12 counted battles stay. Giant battles, puzzles, crafting, the board's non-battle job and hatching don't
  count, so there's always something to do.
- **Progress bars:** quest log ticks, egg "days" pips, a rarity row in the monster book ("Rare 3 of 18").
- **Achievements (new, all kept on new season):**

| Name | For (pupil words) | Measure | Expected |
|---|---|---|---|
| Egg-cellent | Hatch your first egg | eggs hatched ≥ 1 | Most pupils, week 1–2 |
| Wake-up call | Wake a sleeping giant | giants woken ≥ 1 | Most regular players |
| Rare find | Catch or hatch a rare monster | rares owned ≥ 1 | About half |
| Quest helper | Finish 5 story quests | story quests ≥ 5 | Steady players |
| Legend keeper | Own an ultra rare monster | ultra rares ≥ 1 | A few, late in the season |

- **Card art:** no change.
- **Guide for new players:** the "what next" line is the guide; the Professor's first talk explains the quest log.

## 12. Questions for James

1. **Days to hatch:** 3 days for every egg (recommended), or 3 for uncommon, 5 for rare, 7 for ultra rare?
2. **Bonus areas:** 3 giants and 3 bonus areas (recommended), or 6 (one per type, about twice the work)?
3. **Quest points:** small hub points for quests (2 per story step, 1 per board job, inside the 40 a day), or none?
4. **Rare strength:** a little stronger (recommended), or same strength, just rarer and shinier?
5. **Art test now?** Start the Kauri Bush style test (Q.2) alongside the rules (Q.1)?

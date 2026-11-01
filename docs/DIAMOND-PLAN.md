# Diamond Drop: plan

*A claw-and-winch digging game for School Games Hub. Asked for by James on 2 November 2026: "evaluate this style game for games hub (github.com/Dor-sketch/custom-gold-miner-game), multiple levels they work their way through, perhaps each has a time limit to get past, gems that are progressively more rare, aiming to get to the last level and get the diamond, a chance of dropping gems after they are caught and maths is needed to hold onto them … high quality graphics drawn by gaming computer." Branch `claw`, worktree `~/games-hub-claw`, made from `origin/main` c52ae04. Built by following [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md).*

**Stage 0: plan only, no code yet.** Name **Diamond Drop** (James, 2 Nov 2026), id `diamond`, CSS prefix `.dd-`, server function `diamond`. The branch keeps its first name, `claw`. Next free migration number when written: `20261102000100` (re-check with `node scripts/migration-numbers.mjs` before the first migration).

**Decisions (James, 2 Nov 2026):**
- Levels are **saved and unlock as you go**. A passed level stays passed; next lesson starts from the deepest level reached. Failing a level just means trying it again.
- A wrong **Hold on!** answer: the gem **falls back into the rock**, lower down. It can be caught again, but that costs time.
- **10 levels** down to the diamond.
- A **small shop** between levels.
- **Lots of crazy cosmetic claw upgrades** in the shop (section 3.5): claw heads, ropes, trails and catch effects, winches and hats for Nugget. A few earned, most bought; kept for good through New Season; shown in the Hall; a special of the week.
- Name **Diamond Drop**.
- **New Season sends everyone back to level 1** (a season game: section 6.2). Achievements and the Hall stay.
- **The clock pauses** during Hold on!
- **At most one new level a day**, so pupils work down slowly. Unlimited tries at today's level until it's passed; after that they can replay levels already passed (coins, stars, Gem Book). The next level opens the next day (New Zealand date).
- A **Hall of Diamond Finders** (own school).
- **High-quality painted art**, painted by James on his gaming PC (ComfyUI), as for Star Trader and Dragon Maths. It is planned from Stage 2, not left to the end (section 9).

Section 13's questions were answered the same day, so everything here is decided unless marked otherwise.

---

## 1. The short version

- A winch sits at the top of a cut-away view of the ground. Its claw swings slowly left and right. **One button: Drop.** The claw shoots down, grabs whatever it hits and reels it up. Heavy things reel slowly; rocks are heavy and worth nothing.
- **10 levels, each deeper.** Each level has a **time limit** and a **gem target**: bank enough gem value before the clock runs out and the next level opens **the next day**. One new level a day at most, so reaching the diamond takes at least 10 days of play. Every level or so brings a **new, rarer gem**. Level 10 holds one **Heart Diamond**.
- **Hold on!** Rare gems can slip while they're being reeled up. The reel stops, the clock pauses, and a maths question from the pupil's own maths focus pops up. Right: the claw grips and the gem comes up. Wrong: the gem tumbles back down into the rock. The rarer the gem, the more likely it slips.
- **The Gem Book** fills a page for each kind of gem caught. The diamond is the last page. That and level 10 are the big goal.
- **The server is in charge:** it makes and marks every question (way A, like Marble Rush) and **replays each level** from its seed and the recorded drops before saving the result, so a faked score can't get through.
- Painted art, a guide character (Nugget, a kiwi in a hard hat), points and achievements through the hub hooks, switches off to start, a preview James can try on his phone.

## 2. The game we looked at (and what we take from it)

`Dor-sketch/custom-gold-miner-game` is a small Python/Pygame game (about 650 lines, run in the browser through WebAssembly) in the long-standing "gold miner" style: a swinging hook, gold that scores, rocks that cost score and time, and levels. It swaps the gold and rocks for photos of public figures.

- **Licence:** the readme shows an MIT badge but there is **no licence file**, and its pictures are other people's photos. **We take nothing from it**: no code, art, sounds or music. We use only the general idea of the genre (a swinging claw, heavy things reel slower), which is common to many games.
- **What's different about ours:** saved levels going deeper towards one diamond, a gem rarity ladder, the Hold on! maths grip, the Gem Book, a kind fail (no game over, just try the level again), and the hub's server checks.
- **It fits the hub well.** One button makes it easy to pick up for a 9-year-old and good for keyboards and accessibility. A level is about a minute, so a lesson fits 6 to 10 levels. It's 2D, so it runs smoothly on classroom Chromebooks with no new library.
- **Overlap to watch:** Gem Keep already has "gem" in its name and Mine Runner already has mines. The name should avoid both (section 13).

## 3. The rules

Every number lives in `shared/diamond/config.ts` so How to play, the simulator, the server and the screens read the same numbers. All numbers below are starting guesses for the simulator to tune.

### 3.1 The claw

- The claw swings between −70° and +70° at a steady speed. Press **Drop** (big button, Space or Enter) and it travels straight out along its angle.
- It grabs the first thing it touches, or comes back empty from the edge.
- **Reel speed depends on weight:** quartz is light and quick; a big rock is very slow. A wasted grab on a rock is the main way time is lost.
- The game runs on a fixed tick (30 a second) with only + − × ÷ and a fixed angle table (no `Math.sin`/`cos` while playing), as Archery and Mine Runner do, so the server gets exactly the same result from the same drops.

### 3.2 The levels

| Level | Place | New gem | Time | Target (tune) |
|---|---|---|---|---|
| 1 | Grassy Topsoil | Quartz | 60 s | 15 |
| 2 | Clay Bank | Jade | 60 s | 30 |
| 3 | Old River Gravel | Amethyst | 60 s | 50 |
| 4 | Glow-worm Cave | Topaz | 70 s | 80 |
| 5 | Crystal Hollow | Emerald | 70 s | 120 |
| 6 | Underground Lake | Sapphire | 70 s | 170 |
| 7 | Fossil Seam | Ruby | 75 s | 230 |
| 8 | Hot Springs | Fire Opal | 80 s | 300 |
| 9 | Magma Edge | Star Sapphire | 80 s | 380 |
| 10 | The Diamond Heart | **Heart Diamond** | 90 s | catch the diamond |

- Each level's field is made from its seed: the gems of that level and the levels above (rarer ones fewer, smaller and deeper), rocks, and a couple of **mystery sacks** (a few coins, extra seconds, or a free shop item, decided by the seed).
- From level 6, **cave crabs** scuttle side to side, some carrying a gem: a moving target.
- **Level 10:** the Heart Diamond sits at the very bottom behind rocks. Passing means catching it. It always asks Hold on! (twice: section 3.3). Other gems on the level give coins.
- **Stars** on each level (for after the big goal): 1 for passing, 2 for passing with 15 s left, 3 for also catching every kind of gem on the level.
- **No game over.** Run out of time: "So close! Try again", with the gems' coins kept.

### 3.3 Gems and Hold on!

| Gem | Value (coins) | Weight | Slip chance |
|---|---|---|---|
| Quartz | 2 | light | 0% |
| Jade | 4 | light | 10% |
| Amethyst | 6 | light | 20% |
| Topaz | 10 | medium | 30% |
| Emerald | 15 | medium | 35% |
| Sapphire | 25 | medium | 40% |
| Ruby | 40 | heavy | 45% |
| Fire Opal | 60 | heavy | 50% |
| Star Sapphire | 90 | heavy | 55% |
| Heart Diamond | — | very heavy | always, twice |

- When a gem is caught, the level's seed decides whether it slips and where on the way up. If it does: the reel stops, **the clock pauses** (recommended, so the maths is never rushed), and the Hold on! question shows in the shared `QuestionModal`.
- **Right:** "Firm grip!" and the gem comes up. **Wrong:** the right answer is shown kindly, and the gem falls back into the rock at a lower spot (from the seed). It can be caught again; if it slips again, a new question.
- At most **6 Hold on! questions a level** (8 on level 10). After that nothing slips, so a level can never become a wall of questions.
- **Maths nudges, not decides:** a wrong answer costs time, not the gem for ever, so a pupil weaker at maths can still pass every level and reach the diamond. The Lucky Charm (section 3.4) halves the slip chance.

### 3.4 The shop: boosts

Between levels, spend coins on boosts for **the next level only**, at most one of each (so coins can never make a level trivial):

| Item | What it does | Price (tune) |
|---|---|---|
| Strong Winch | heavy things reel 50% faster | 20 + 10 × level |
| Lucky Charm | slip chances halved | 15 + 10 × level |
| Extra Time | +10 seconds | 10 + 5 × level |
| Rock Blaster | one blast: a grabbed rock turns to dust and the claw comes straight back | 10 + 5 × level |

Coins are saved between lessons. Prices are shown as sums ("You have 85. Lucky Charm 45. You'll have 40 left"), real maths without a test. The simulator checks coins don't pile up unused.

### 3.5 The Claw Workshop (crazy cosmetic upgrades)

James, 2 Nov 2026: "the shop should sell lots of crazy cosmetic upgrades to the claw - kids would love that." The shop has a second tab, **the Workshop**, full of silly, bright upgrades. **They are looks only**: they never change speed, weight, slips or anything the server replays, so a pupil with no upgrades is never behind.

**Kinds (all four, James):**

| Kind | Examples (starting list, about 40 in all) |
|---|---|
| Claw heads | Golden Claw, Dino Jaw, Robot Hand, Crab Pincer, Octopus Arm, Giant Magnet, Rubber Chicken, Giant Fork, Dragon Talon, Ice Crystal Claw, Grabby Glove |
| Ropes and chains | Rainbow Rope, Jungle Vine, Laser Beam, Sausage Chain, Spaghetti, Candy Cane, Bike Chain |
| Trails and catch effects | Trails behind the claw: Sparkles, Bubbles, Flames, Confetti, Music Notes. On a catch: Fireworks, Disco Ball, Gem Rain, Trumpet Fanfare, Nugget's Happy Dance |
| Winches and Nugget's hats | Winches: Steam Engine, Rocket Winch, Giant Snail, Pirate Ship Wheel, Hamster Wheel. Hats for Nugget: Pirate Hat, Crown, Wizard Hat, Chef's Hat, Astronaut Helmet, Top Hat |

- **Rarity and prices** (tune with the simulator): Common 50, Cool 150, Epic 400, Legendary 1,000 coins. The aim: a regular player can afford 6 to 10 upgrades a season, and a Legendary is a season-long saving goal. That gives coins from replays a real use, so coins no longer pile up after the boosts are bought.
- **A few are earned, not bought (James):** Diamond Claw (catch the Heart Diamond), Star Rope (Star Miner), Gem Rain Deluxe (Gem Collector), Nugget's Miner Lamp (Firm Grip). They can't be bought, so they mean something.
- **Kept for good (James):** coins reset at New Season, but every upgrade bought or earned stays. New upgrades are added from time to time, so there's always something new to save for.
- **Special of the week (James):** each week (Monday, New Zealand date) one upgrade is cheaper, or a weekly-only upgrade is on sale. Chosen from the week number by a pure function, so the server and the browser always agree.
- **Try it on:** tapping an upgrade shows it on the swinging claw before buying. Prices are shown as sums ("You have 320. Robot Hand 150. You'll have 170 left").
- **Shown in the Hall (James):** a pupil's claw appears next to their name in the Hall of Diamond Finders. Nothing about maths is ever shown.
- **One of each slot worn at a time:** claw head, rope, trail, catch effect, winch, hat. Pupils change them any time in the Workshop.
- Reduced motion: trails and catch effects become a small still glow.

## 4. Maths: the one approved way

- **Way A** (section 4.2 of the guide): at level start the server reads `space_maths_context(player)`, makes the pack with `makeFocusPack` from a fresh seed, makes the level's 6 (or 8) questions, stores them in `diamond_questions` (pupils can't read it) and sends only `publicQuestion`s.
- Questions show in `QuestionModal`, so every kind the ladder can make just works. Multiple choice follows the class switch.
- Each answer goes to the server, is marked there once (`diamond_claim_answer`) and recorded with `recordMathsAnswers(…, 'diamond')`.
- Maths is the heart of the game, so there's no maths on/off switch.
- The guide character never helps with the questions.

## 5. The server, saving and cost

- **Requests:** `levelStart` (seed, questions, the pupil's boosts), one `answer` per Hold on!, `levelEnd { seed, drops, boosts }`. About 5 a level on average. Workshop: one `buy` and one `wear` request when a pupil buys or changes an upgrade (the server checks the price, the coins and that earned ones are earned).
- **Replay:** `levelEnd` runs the shared engine with the seed, the recorded drop ticks and the server's own marks, and saves what the replay says (gems caught, passed or not, stars, coins). The browser's own total is never trusted. A level ended twice counts once (unique seed).
- **Tables** (one migration, RLS on everywhere): `diamond_players` (deepest level, coins, Gem Book counts, stars per level), `diamond_levels` (one row per level played: seed, level, started, result, drops; unique seed), `diamond_questions` (server only: no policy, no grant), `diamond_owned` (player, upgrade, how got, when; **not** cleared by New Season), and the worn upgrades in `diamond_players`. Pupils read their own through `my_diamond()`. Saving only through `record_diamond_…()` functions the server key alone can run.
- **Cost:** a class of 28 playing 8 levels a lesson is about 1,100 requests. A lesson a day across a school is well under 30,000 a month, against 500,000 free.
- **Switch checks:** the function refuses while the teacher switch is off.

## 6. Design decisions (guide section 1a)

1. **The big goal:** reach level 10 and catch the Heart Diamond, filling the Gem Book's last page. With one new level a day it takes at least 10 days of play. Aim (to check with the simulator): a pupil playing 3 to 4 days a week gets there in **4 to 5 weeks**, near the end of the season; someone playing every school day and passing first time, in 2 weeks. Because the daily limit does the slowing, level targets can stay friendly: most levels should be passable in 1 to 3 tries. **After it:** 3 stars on every level, the full Gem Book counts, and their name in the school's **Hall of Diamond Finders**, kept for good with the season it was found in.
2. **Season game: yes** (James). New Season sends everyone back to level 1: the `season_fn` hook clears levels, coins, stars and the Gem Book. Achievements stay (`keep_achievements`), and so does the Hall. It uses the school's 35-day season, not a new clock; reading the season date needs a shared function, so ask James how before Stage 4 (guide section 1a.2). The season has about 25 school days and the diamond needs 10 days of play, so a pupil who joins (or comes back) by about week 3 and plays most days can still reach it. Anyone later still gets levels, gems and achievements. Last days: a countdown line ("5 days left to find the diamond this season"); the Hall marks each season's finders.
3. **Moves a day: one new level a day** (James, 2 Nov 2026). The server counts and refuses, never the browser: `diamond_players` keeps the New Zealand date (`nzDate`) of the last new level passed, and `levelStart` refuses a not-yet-passed level beyond the first locked one if a new level was already passed today. Tries at today's level are unlimited until it's passed. **Replays** of passed levels are unlimited and earn coins, stars and Gem Book entries (more maths is good; shop boosts are capped at one of each per level, so piled-up coins can't break a level). Points are earned once per level passed and per star, so replays can't farm them, and the hub's 40-a-day cap applies anyway. Kind words when today's level is done: "Level 5 done! Level 6 opens tomorrow. Replay a level to collect stars and gems." **Home page chip** ("New level: ready" / "tomorrow") would need a line in the shared `my_moves_left()`, so it's its own small step with James's OK (guide 1a.3), not part of this branch.
4. **Progress bars:** in the game, a **depth gauge** down the side showing the 10 levels with the pupil's claw at their deepest, the diamond glowing at the bottom; during a level, a bar filling towards the gem target next to the clock. Home page: hub level bar and achievements come free.
5. **Achievements:**

| Name | For (pupil words) | Measure | Roughly who | Survives New Season |
|---|---|---|---|---|
| First Catch | Catch your first gem | `diamond_gems` ≥ 1 | nearly everyone, day one | yes |
| Firm Grip | Hold on to 10 slipping gems | `diamond_grips` ≥ 10 | most, first week | yes |
| Halfway Down | Pass level 5 | `diamond_level` ≥ 5 | most | yes |
| Gem Collector | Catch every kind of gem | `diamond_kinds` ≥ 9 | many | yes |
| Diamond Finder | Catch the Heart Diamond | `diamond_found` ≥ 1 | the big goal | yes |
| Star Miner | 3 stars on every level | `diamond_stars` ≥ 30 | a keen few | yes |

   Earned Workshop upgrades come with Firm Grip, Gem Collector, Diamond Finder and Star Miner (section 3.5).

   Points (rules_fn): pass a level for the first time: 2 points; each new star: 1 point; the diamond: 5 points.
6. **Home page card:** a cut-away cliff in bright storybook style: a little winch and claw at the top on grass, coloured gem layers going down through clay, caves and glowing crystals to a shining diamond at the bottom. No text. (Painted with the game's art: section 9.)
7. **Guide for new players:** section 8.

**Also:** one sitting is 10 to 15 minutes and every level saves when it ends. First 5 minutes: the guided first go on level 1, pass it, see the shop and the Gem Book. Solo play, classmates only see the Hall (no maths, no ranking by maths). Teacher: one on/off switch (off to start), a Games table row ("12 pupils past level 5, 3 found the diamond"), one line per student ("Level 6 · 7 of 10 gems found"), and a reset for one pupil's progress.

## 7. Screens

- **Level map:** the depth gauge as a cut-away of the ground, each level a chamber, locked ones dark, the next one marked "opens tomorrow" once today's level is passed. Play / Shop / Workshop / Gem Book / How to play.
- **Play:** the winch and claw at the top, the field below, the clock and target bar, a big Drop button (also Space / Enter / tapping the field). Pause button.
- **Hold on!:** `QuestionModal` over a frozen moment of the gem dangling.
- **Level end:** passed / so close, gems caught, coins, stars, then the shop.
- **Workshop:** upgrades by kind, each with its rarity and price, a "try it on" claw swinging at the top, the special of the week first, earned ones showing how to win them.
- **Gem Book:** one painted page per gem, how many caught, the first-catch date; unknown gems as shadows.
- **Hall of Diamond Finders:** own school only, display names, the date found.
- Accessibility: one-button play, 44 px targets, focus moved to each screen's heading, reduced motion (no shake, sparkles or swaying background; the swing itself stays because it's the game, but can be slowed in settings). Checked at 1366 × 640 and 844 × 390.

## 8. New player guide (Nugget)

A kiwi in a hard hat, inside the game's own folder.

| Moment | What happens | Why a child gets stuck | Fix |
|---|---|---|---|
| Opens the game | Level map with lots of chambers | Doesn't know where to start | Only level 1 lit, Nugget points at it |
| First swing | Claw swings, nothing happens | Doesn't know to press | "Press Drop when the claw points at a gem" with Drop lit up |
| Grabs a rock | Slow reel, time lost | Doesn't know rocks are bad | First-time tip: "Rocks are heavy and worth nothing. Aim for the shiny ones!" |
| First Hold on! (level 2) | Question pops mid-reel | Surprise | First-time tip: "Slippery! Answer to hold on. The clock waits for you." |
| Shop | Four things and prices | Too many choices | Tip + an opinion with working ("Level 4 has lots of rocks: a Rock Blaster might save 10 seconds") |
| Fails a level | Time up | Feels like losing | "So close! You kept your coins. Try again?" |

- **Guided first go:** level 1's first play has a slow swing and a big quartz straight below, so the first drop can't miss; ends with "Your first gem!" and the target bar filling. Who gets it comes from the server (no levels played yet). Skippable, replayable.
- **Next-step line:** always one sentence from a pure function ("Pass level 4: bank 80 gems in 70 seconds" / "Level 5 opens tomorrow. Replay level 3 to find the Amethyst you're missing").
- Help fades: Lots / Some / Off.

## 9. Painted art (high quality, from James's gaming PC)

James asked for high-quality graphics painted on his gaming PC. Pattern from Star Trader (`docs/TRADER-ART-PLAN.md`): Stage 2 writes `docs/DIAMOND-ART-PLAN.md` with every picture, its size and a ComfyUI prompt; James paints 2 to 6 tries each into an inbox (`diamond-art-inbox` branch or a folder outside the repo); picks go in `docs/diamond-art/picks.json`; `scripts/diamond-art.py` (copied from `trader-art.py`) makes the `.webp` files and cuts out sprites; `art.test.ts` checks none missing. **Drawn code art stays as the fallback**, so the game works before every picture arrives.

What needs painting (about 40 pictures for the game plus about 40 for the Workshop, in batches so each can go live on its own):
- **10 level backgrounds** (one per place, a cut-away of the earth at that depth, 1600 × 1000), plus the level map.
- **10 gems** as sprites on plain backgrounds, plus a larger Gem Book painting of each.
- **Rocks** (3 sizes), **mystery sack**, **cave crab**.
- **The winch and claw** (claw open and closed), **Nugget** in 4 poses (wave, point, cheer, oops).
- **Shop items** (4) and the shopkeeper's stall.
- **Workshop upgrades** (about 40, painted in batches of 10 to 12): each claw head open and closed, each winch, each hat on Nugget, a rope tile for each rope, and a shop icon for every trail and catch effect. The trails and catch effects themselves are drawn in code (moving sparkles, bubbles, fireworks), so they stay smooth on Chromebooks. Every upgrade has a simple drawn-in-code version so the Workshop works before its paintings arrive.
- **Home page card** (section 6).

Style to settle with mock-ups early in Stage 2: bright, rich, storybook painting that keeps gems easy to tell apart at small size on a Chromebook.

## 10. Tests (at most 8, guide section 7)

- Rules (3): the same seed and drops always give the same level result; slips come only from the seed and the server's marks; level pass, stars and the one-new-level-a-day rule (across New Zealand midnight).
- Server (3): wrong is wrong and an answer counts once; another pupil's seed is refused; `levelEnd` saves the replay's result, not a faked total.
- Screens (2): the accessibility check (copied from Clan Quest) and the guided first go can't get stuck.
- Plus `supabase/tests/database/diamond.test.sql` and the "index.ts is up to date" check. Balance goes in `scripts/diamond-sim.mjs`.

## 11. Stages

0. **Plan** (this). Stop for James.
1. **Rules engine and simulator** (including the one-new-level-a-day rule, simulated over a 35-day season) in `shared/diamond/`: config, field from seed, swing and reel, slips, shop effects, replay, Workshop prices and the special of the week. Simulator tunes times, targets, slip chances and coin flow so the diamond lands in 4 to 5 weeks of regular play and 6 to 10 upgrades are affordable a season. 3 rule tests.
2. **Screens, drawn art and phone preview**, plus `docs/DIAMOND-ART-PLAN.md` with prompts and style mock-ups so James can start painting. Trial backend so the preview never touches the live server. Published as a private Artifact for James to try.
3. **Server and migration:** `diamond` function (way A, replay), tables, pgTAP tests.
4. **Hub fit:** the Workshop (buying, wearing, earned upgrades), points, achievements, teacher switch and summary, How to play from config, the Hall, accessibility.
5. **New player guide:** Nugget, guided first go, next-step line, tips. James tries the first go.
6. **Painted art in:** James's picks through `diamond-art.py`, screenshots at laptop and phone size.
7. **Go-live prompt and go-live**, each live step on James's word.

## 12. Risks

- **Timing on slow Chromebooks:** the fixed tick and replay keep results fair even if the screen stutters; the art is sized and compressed for Chromebooks.
- **Pupils dodging rare gems to avoid maths:** targets need rare gems from level 4 on, and Hold on! is framed as a lucky save, not a test.
- **Absent pupils fall behind:** a week away costs up to 5 levels' worth of days. The Hall shows only who found the diamond, never who is behind, and New Season gives everyone a fresh start.
- **Too easy or too hard:** the simulator plus one class trying the preview before go-live.

## 13. Decided (James, 2 Nov 2026)

- Name: **Diamond Drop**.
- New Season: **everyone back to level 1** (achievements and the Hall kept).
- The clock **pauses** during Hold on!
- **Hall of Diamond Finders**: yes.
- **One new level a day**, unlimited tries until passed, replays of passed levels allowed.
- **Claw Workshop**: all four kinds of crazy cosmetic upgrades, a few earned and most bought, kept for good, shown in the Hall, a special of the week.

Still open: how this game reads the school season date (ask before Stage 4), and whether to add a home page "new level ready" chip (a separate small step).

---

## Stage 1 results (2 November 2026)

**Built:** the rules engine in `shared/diamond/`, all pure and seeded, every number in `config.ts`, plus the balance simulator (`npm run diamond:sim`) and the rule sheet [DIAMOND-RULES.md](DIAMOND-RULES.md) with the pace tables. No screens, server or database yet. Migration number to use in Stage 3: `20261102000200` was free on 2 Nov (check again).

| File | What it does |
|---|---|
| `config.ts` | The 10 levels (place, new gem, time, target, what's buried), gems (value, weight, slip chance, size, depth), rocks, sacks, crabs, swing and reel speeds, 30 ticks a second, boosts, question caps, Workshop prices, points |
| `angles.ts` | The fixed angle table (sin and cos for 0 to 90 whole degrees, checked in as plain numbers) |
| `random.ts` | Seeded random numbers (32-bit integer maths) and `mixSeed`, with separate streams for the field, catches and landings |
| `field.ts` | `makeField(level, seed)`: rarer gems fewer, smaller and deeper; things only where the claw can reach; level 10's diamond with a clear line down to it flanked by big rocks; `makeStarterField` for the guided first go |
| `engine.ts` | `startLevel` / `step` / `answer` (live play) and `playLevel({ level, seed, drops, boosts, marks, finish, starter })` (the server's replay), giving gems banked, coins, passed, stars, each slip's slot and where a dropped gem landed, and every shot for the screen to animate. `starterLevel(seed)` |
| `progress.ts` | `nzDate`, `levelsOpen` / `canStart` (one new level a day), `takeBoosts`, `applyResult` (coins, stars, Gem Book, points, earned upgrades), `newSeason`, `needsStarter`, achievement `measures` |
| `workshop.ts`, `workshopItems.ts` | 43 upgrades in 6 slots (4 earned), `canBuy`, `buy`, `wear`, `weekNumber`, `weeklySpecial`, `priceOf` |
| `nextStep.ts` | The next-step line with real names and numbers, and the button it means |
| `bot.ts`, `sim.ts`, `scripts/diamond-sim.mjs` | Bot pupils and the 35-day season simulator |
| `diamond.test.ts` | The 3 rule tests (of the game's 8) |

**Decisions made in this stage:**
- **Field units.** The ground is 1000 × 700 units, the winch hangs at (500, 40), the claw travels out 16 units a tick and swings 2° a tick. The screen scales this.
- **Drop presses are ticks.** The browser records the tick of each Drop (and of Finish, if pressed). Presses while the claw is busy are ignored, so a replay needs nothing else. A Hold on! slot with no mark counts as wrong (a pupil who closes the question loses that grip).
- **Finish button.** After passing, a pupil can keep digging for coins and the third star, or press Finish. Level 10 ends as soon as the Heart Diamond is up.
- **Stars** count time left *at the moment of passing*, so sack seconds afterwards don't add a star.
- **The Heart Diamond** gives 150 coins, slips at two set stretches of the way up, and always asks both questions unless the cap (8) is used up.
- **Wrong answer:** the gem falls 60 to 140 units further out along the claw's line (from the seed), never outside the ground or on top of something else. A crab drops its gem and scuttles off.
- **The diamond's way down** is kept clear on purpose: at least 6 degrees of swing reach it first. A 1-degree gap (allowed at first) was impossible for children.
- **Coins:** passing a new level keeps all its coins; replays **and tries that fall short** keep 12%. (The plan said failed tries keep their coins; at 100% that made stopping just short of the target a better coin farm than replaying, so they share the replay rate. The "So close!" screen should say "You kept 6 coins", not "your coins".)
- **Prices tuned:** Workshop Common 100, Cool 250, Epic 600, Legendary 1,800 (plan guessed 50 / 150 / 400 / 1,000). Special of the week 40% off, stepping through the list so every upgrade comes round and never the same two weeks running.
- **Targets tuned down** from level 2: 15, 25, 40, 55, 70, 100, 145, 200, 240 (plan guessed up to 380). Each field must hold at least 1.5 times its target.
- **Strong Winch** speeds up everything heavier than light (medium and heavy gems, rocks and the diamond), not only "heavy" gems.
- **Boost prices** stay as the plan guessed: bots rarely need them, because levels mostly pass first try.

**Pace (simulator, details in DIAMOND-RULES.md):** with one new level a day and unlimited tries, nearly every pupil passes each new level the day it opens. So the climb is **10 play days for everyone**: about **week 2** at 5 days a week, **week 3** at 3 to 4 days, **week 5** at 2 days. Pupils weaker at maths (45% right) reach the diamond just as surely; they answer more questions and lose a little time. New levels pass in 1 to 3 tries 98–100% of the time (mean 1.0 to 1.2). A 3-to-4-day pupil earns about 3,400 to 5,000 coins, buys 6 to 9 upgrades, and ends with about 400 to 600 coins unspent; savers get their Legendary late in the season.

**Not met: "3-to-4-days-a-week players reach the diamond in about 4 to 5 weeks."** The daily rule makes the climb 10 play days at best, and with friendly targets also at worst, so it lands in week 3. Making levels harder doesn't slow it (tries are unlimited on the day), it only frustrates. James kept it (below).

**Untested / for later stages:**
- Bots are probably steadier than real 9-year-olds. Try the Stage 2 preview with a class before trusting the tries numbers.
- The Stage 3 server must check inputs before calling `playLevel` (from the Stage 1 review):
  - level a whole number 1 to 10, the server's own seed;
  - `drops` an array of at most about 300 whole numbers from 0 to 5,400;
  - `finish` null or a whole number;
  - `boosts` a duplicate-free subset of the 4 boosts, matching what `takeBoosts` charged (including the free one);
  - `marks` come from the server's own table, never the browser;
  - `starter` only when `needsStarter` says so.
  `playLevel` stops after 18,000 ticks whatever it's sent.
- `nextStep` wording was checked by eye only (no tests of wording).
- Achievement measures and points are worked out (`measures`, `POINTS`) but not wired to the hub until Stage 4.

**Decided by James (2 Nov 2026): keep the climb at about 3 weeks** for 3-to-4-day pupils (10 levels, one new level a day, friendly targets). The 2 weeks after are for stars, the Gem Book and the Workshop, and late joiners can still reach the diamond.

---

## Stage 2 results (2 November 2026)

**Built:** the game's screens with drawn (code) art, a phone preview on a pretend server, and the painted-art plan. Still switched off (`ON = false` in `src/games/diamond/switch.ts`), and **not** in `src/games/registry.ts` (a merge-step change). No server or database yet.

| File (`src/games/diamond/`) | What it does |
|---|---|
| `switch.ts` | Code switch, off (`VITE_DIAMOND_ON=true` for your own computer) |
| `index.tsx`, `DiamondPlay.tsx` | The `GameDefinition` (group `complex-maths`, not ranked). `DiamondPlay` runs on the trial backend until Stage 3 |
| `backend.ts` | The six requests the screens make (`load`, `levelStart`, `answer`, `levelEnd`, `buy`, `wear`) and their reply shapes: Stage 3's server answers the same ones |
| `trialBackend.ts` | The pretend server: checks `canStart`, charges boosts with `takeBoosts`, makes the Hold on! questions way A (`makeFocusPack` from a fixed pretend focus, times tables, seeded), marks each slot once, replays with `playLevel` and saves with `applyResult`. Preview tools: pretend tomorrow, jump to a level, coins, start again |
| `DiamondGame.tsx` | Which screen shows, the pupil's progress as the backend last sent it, the boost basket, "Show me" |
| `LevelMap.tsx` | The depth gauge (10 chambers, locked dark, "Opens tomorrow", deepest marked, the diamond glowing at the bottom), Nugget with the `nextStep` line and "Show me", the buttons, the swinging claw as worn, settings |
| `PlayLevel.tsx` | The canvas, stepped at 30 ticks a second with `step`, recording each counted Drop's tick (and Finish); Drop button, Space, Enter, or tapping the field; Pause (hides the field); Finish once passed; Hold on! with the shared `QuestionModal`; the gem tumbles to where `answer` says it landed |
| `Pages.tsx` | Level end (passed / So close!, gems, coins kept with the real 12% sum, stars, earned upgrades), the boost shop (prices as sums, one of each, the sack's free boost), Gem Book (shadows for unknown gems, diamond last), How to play (every number read from `config.ts`) |
| `Workshop.tsx` | 6 slots, every upgrade with rarity and price as a sum, special of the week first, earned ones say how to win them, try it on, buy, wear, take off |
| `art/draw.ts`, `art/items.ts`, `Sprite.tsx` | All drawn art: 10 level backgrounds and their moving bits, 10 gems (different shapes as well as colours), rocks, sack, crab, winch, rope, claw open and closed, Nugget in 5 poses, every one of the 43 upgrades, trails and catch effects |
| `prefs.ts` | Less motion and Slower game, kept on the device |
| `diamond.css` | Every class `.dd-`; hub tokens and shared buttons for panels |
| `Accessibility.test.tsx`, `DiamondGame.test.tsx` | The 2 screen tests (5 of the game's 8 used) |

Also: `preview/diamond/` (the preview, plus `art.html`, every drawn picture on one sheet), `vite.diamond-preview.config.ts`, `diamond:preview` and `diamond:single` at the end of `package.json`'s scripts, `dist-preview-diamond/` in `.gitignore`, and [DIAMOND-ART-PLAN.md](DIAMOND-ART-PLAN.md).

**Decisions made in this stage:**
- **Slower game** is a setting that runs the whole level at 20 steps a second instead of 30. The swing, the claw and the clock all slow together, so the rules and the server's replay (which count steps) are unchanged; it only gives more real time to aim. (The plan's "slow the swing" would have needed a rule change the server must replay.) Stage 3 must not refuse a level for taking longer in real time.
- **Drop is applied straight away** when pressed (the recorded tick, then `step(s, 'drop')`), exactly what the replay does at that tick. Finish waits until the claw is back at the top, then counts.
- **Leave this level** (in Pause) ends the level now; the server's replay plays out the rest with no more drops, so a gem already on its way up still counts.
- **No skip on Hold on!** (no close button), so a pupil can't lose a grip by closing the box by mistake.
- **The shop** is "Shop for level N" with a Start button: boosts are chosen for the level about to start. Level end leads to it; Play on the map starts with no boosts.
- **The questions' answers stay in the trial backend**, never in the screens, as the real server will do.
- **Nugget** stands beside the winch in every level, wearing the hat; cheers when a level is passed, "oops" during Hold on!.
- **Painted art:** 104 pictures in 11 batches (D.1 gems, rocks, sack, crab · D.2 winch, claw, Nugget · D.3 levels 1–5 · D.4 levels 6–10 and the map · D.5 Gem Book and shop · D.6–D.10 the Workshop · D.11 home card). The plan guessed about 80; claw heads are painted open and closed.

**Checked by eye in the browser pane** at 1366 × 640 and 844 × 390 (a phone on its side puts the field on the left and the clock, target and Drop on the right): the map, levels 1, 6 and 10, a catch, a Hold on! answered wrong (the gem fell back and could be caught again), the level end, the Workshop and the art sheet. The preview made no requests to anything but its own page. Screenshots were sent to James.

**Untested:**
- Phones held upright (390 wide) were not checked; the layout stacks, but the field is small.
- Real pupils on a Chromebook (speed of the canvas with 40 things and catch effects).
- Less motion was checked by reading the code, not on a device with it switched on.
- New-player guide (Nugget's guided first go, tips that fade, Lots / Some / Off) is Stage 5; this stage has only the first-go tip and the rock tip.

**For Stage 3:** answer the six requests in `backend.ts` with the same shapes; the inputs to check are listed in Stage 1 results. Swap `trialBackend()` in `DiamondPlay.tsx` for the server.

**Questions for James:** which painting style (A Storybook, B Glowing Cave, C Clean Flat) to paint in, from the mock-ups.

---

## Stages 3 to 5 results (2 November 2026)

James, 2 Nov 2026: "do everything we can without the gaming computer art". So Stages 3, 4 and 5 were built together; Stage 6 (painted art) waits for the gaming PC, and Stage 7 (go-live) waits for James. **Nothing is live:** the migration is on hold (`supabase/migrations-on-hold.txt`), the function is not deployed, the code switch is off and the game is not in `src/games/registry.ts`.

**Decided by James (2 Nov 2026): New Season is the teacher's button only.** Diamond Drop doesn't read the school's 35-day season date; the `season_fn` hook runs when a teacher presses New Season. (So no "days left this season" countdown.)

| File | What it does |
|---|---|
| `shared/diamond/server.ts` | `handleDiamond`: the six requests (`load`, `levelStart`, `answer`, `levelEnd`, `buy`, `wear`). Checks the switch and every input (the Stage 1 list), makes the Hold on! questions way A (`makeRunQuestions` from `space_maths_context`, seeded by the level's seed), marks each slot once and records it with `recordMathsAnswers` (`diamond:<seed>:<slot>`), replays the level with `playLevel` from the server's own seed, boosts and marks, and saves with `applyResult`. Points through `add_game_points` (`diamond:<seed>`). Every save checks a version number and retries, so two tabs can't spend the same coins twice |
| `shared/diamond/memoryServices.ts` | The database jobs in memory (the preview and the server tests) |
| `supabase/functions/diamond/` | `handler.ts` (sign-in, 60 requests a minute), `entry.ts` (database plumbing), `index.ts` (built), `handler.test.ts` (the 3 server tests and the "index.ts is up to date" check) |
| `supabase/migrations/20261102000200_diamond.sql` | `diamond_players` (progress as JSON, version, season count), `diamond_levels` (seed, boosts, questions, marks, drops, result; unique seed per pupil; ended levels go after 30 days), `diamond_finds` (the Hall, once a pupil a season). Server-only functions, the switch `diamond_enabled` (off) and `teacher_set_diamond`, the hub hooks (counts, How points work lines, players, New Season, last played, achievements kept), 6 measures and 6 achievements, `diamond_hall()`, `teacher_diamond_class`, `teacher_diamond_student`, `teacher_diamond_restart` |
| `supabase/tests/database/diamond.test.sql` | 30 checks: pupils can't read or call anything, a seed used once, old versions never saved over new, a slot marked once, a level ended once, counts, the Hall (own school, claw only), New Season keeps upgrades and the Hall |
| `src/data/diamond.ts` | The live backend (the function plus `diamond_hall`), the switch, the teacher's lines and restart |
| `src/games/diamond/backend.ts` | `fromServer`: turns either server's replies into what the screens use; the Hall request |
| `src/games/diamond/trialBackend.ts` | Now runs `handleDiamond` on the in-memory database, so the preview plays exactly the server's rules |
| `src/games/diamond/switch.ts`, `teacher.ts`, `index.tsx`, `src/pages/TeacherDiamond.tsx` | The teacher switch hook, the Games table row ("Follows focus · 4 past level 5 · 1 found the diamond"), the student line ("Passed level 6 of 10 · 7 of 10 gems found"), and "Start this student again…" on the student page |
| `src/games/diamond/guide.ts` | Nugget's help: the guided first go (`guideStep`, worked out from the level as it is, so it can't get stuck), first-time tips (rocks, sacks, crabs, passing), the shop's advice with its working, and help that fades (Lots for the first 5 levels, Some until 20, then Off; or the pupil picks) |
| Screens | Hall of Finders (own school, newest first, each finder's claw), an achievement line on the level end, How to play lists the achievements and points, Settings has "Help from Nugget" and "Replay the guide" |

**Decisions made in these stages:**
- **One table for levels and their questions** (`diamond_levels`) instead of a separate `diamond_questions`: the whole table is server-only (RLS on, no policy, no grant), so the questions are as safe, and a level and its marks live in one row.
- **Progress is one JSON column** (the shared `Player`), worked on by the shared rules on the server. New Season in SQL sets the same fields `newSeason()` does.
- **Seeds are random 32-bit numbers, unique per pupil** (a clash retries).
- **No time checks on levels**, so "Slower game" is never refused.
- **The Hall shows each finder once a season** (a teacher's New Season or restart starts a new one), with the claw they wear now.
- **Requests:** about 5 a level (start, a few answers, end), as planned.

**Tests:** 8 in all (3 rules, 3 server, 2 screens; the screen test now also checks the guide moves on when the pupil drops), plus the 30 database checks and the "index.ts is up to date" check. Database checks run on a throw-away copy (dropped after); the teacher functions were tried there by hand.

**Checked in the browser** (preview, 1366 × 640 and 844 × 390): the guided first go (Drop lit, the line moves on after a Drop, "Your first gem!"), the First Catch achievement on the level end, Nugget's shop advice, the Hall. No requests outside the preview page; no server address in the built preview.

**Untested:**
- The live function and database (nothing deployed): first real test is go-live step 5, as a teacher with pupils switched off.
- The Games table row and the student page in the real Teacher page (type-checked only).
- The guided first go on a real Chromebook, and whether 9-year-olds read the lines. **James to try the first go.**

**Left for later:**
- **Stage 6, painted art:** waits for the gaming PC (ComfyUI). First paint the three style tries, then James picks.
- **Stage 7, go-live:** `docs/prompts/diamond-golive.md`. Merge-step edits listed there (registry, `registry.test.ts`, `build-functions.mjs`, privacy summary, `shared/README.md`, `docs/PLAN.md`).
- A home page "new level ready" chip (shared `my_moves_left()`): its own small step, with James's OK.

**Paused here (2 Nov 2026, James asked to pause):** everything above is written and committed on `claw`. The game's own tests pass (8, plus the 30 database checks and the "index.ts is up to date" check), and the preview Artifact is updated. **Not yet confirmed: the full `npm run check`** (it was still running at the pause). Next session: run `npm run check`, fix anything it finds, then wait for the gaming PC (painted art) and James's go-live word.

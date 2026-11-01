# Diamond Drop: plan

*A claw-and-winch digging game for School Games Hub. Asked for by James on 2 November 2026: "evaluate this style game for games hub (github.com/Dor-sketch/custom-gold-miner-game), multiple levels they work their way through, perhaps each has a time limit to get past, gems that are progressively more rare, aiming to get to the last level and get the diamond, a chance of dropping gems after they are caught and maths is needed to hold onto them … high quality graphics drawn by gaming computer." Branch `claw`, worktree `~/games-hub-claw`, made from `origin/main` c52ae04. Built by following [GAME_DEVELOPMENT_GUIDE.md](GAME_DEVELOPMENT_GUIDE.md).*

**Stage 0: plan only, no code yet.** Name **Diamond Drop** (James, 2 Nov 2026), id `diamond`, CSS prefix `.dd-`, server function `diamond`. The branch keeps its first name, `claw`. Next free migration number when written: `20261102000100` (re-check with `node scripts/migration-numbers.mjs` before the first migration).

**Decisions (James, 2 Nov 2026):**
- Levels are **saved and unlock as you go**. A passed level stays passed; next lesson starts from the deepest level reached. Failing a level just means trying it again.
- A wrong **Hold on!** answer: the gem **falls back into the rock**, lower down. It can be caught again, but that costs time.
- **10 levels** down to the diamond.
- A **small shop** between levels.
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

### 3.4 The shop

Between levels, spend coins on boosts for **the next level only**, at most one of each (so coins can never make a level trivial):

| Item | What it does | Price (tune) |
|---|---|---|
| Strong Winch | heavy things reel 50% faster | 20 + 10 × level |
| Lucky Charm | slip chances halved | 15 + 10 × level |
| Extra Time | +10 seconds | 10 + 5 × level |
| Rock Blaster | one blast: a grabbed rock turns to dust and the claw comes straight back | 10 + 5 × level |

Coins are saved between lessons. Prices are shown as sums ("You have 85. Lucky Charm 45. You'll have 40 left"), real maths without a test. The simulator checks coins don't pile up unused.

## 4. Maths: the one approved way

- **Way A** (section 4.2 of the guide): at level start the server reads `space_maths_context(player)`, makes the pack with `makeFocusPack` from a fresh seed, makes the level's 6 (or 8) questions, stores them in `diamond_questions` (pupils can't read it) and sends only `publicQuestion`s.
- Questions show in `QuestionModal`, so every kind the ladder can make just works. Multiple choice follows the class switch.
- Each answer goes to the server, is marked there once (`diamond_claim_answer`) and recorded with `recordMathsAnswers(…, 'diamond')`.
- Maths is the heart of the game, so there's no maths on/off switch.
- The guide character never helps with the questions.

## 5. The server, saving and cost

- **Requests:** `levelStart` (seed, questions, the pupil's boosts), one `answer` per Hold on!, `levelEnd { seed, drops, boosts }`. About 5 a level on average.
- **Replay:** `levelEnd` runs the shared engine with the seed, the recorded drop ticks and the server's own marks, and saves what the replay says (gems caught, passed or not, stars, coins). The browser's own total is never trusted. A level ended twice counts once (unique seed).
- **Tables** (one migration, RLS on everywhere): `diamond_players` (deepest level, coins, Gem Book counts, stars per level), `diamond_levels` (one row per level played: seed, level, started, result, drops; unique seed), `diamond_questions` (server only: no policy, no grant). Pupils read their own through `my_diamond()`. Saving only through `record_diamond_…()` functions the server key alone can run.
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

   Points (rules_fn): pass a level for the first time: 2 points; each new star: 1 point; the diamond: 5 points.
6. **Home page card:** a cut-away cliff in bright storybook style: a little winch and claw at the top on grass, coloured gem layers going down through clay, caves and glowing crystals to a shining diamond at the bottom. No text. (Painted with the game's art: section 9.)
7. **Guide for new players:** section 8.

**Also:** one sitting is 10 to 15 minutes and every level saves when it ends. First 5 minutes: the guided first go on level 1, pass it, see the shop and the Gem Book. Solo play, classmates only see the Hall (no maths, no ranking by maths). Teacher: one on/off switch (off to start), a Games table row ("12 pupils past level 5, 3 found the diamond"), one line per student ("Level 6 · 7 of 10 gems found"), and a reset for one pupil's progress.

## 7. Screens

- **Level map:** the depth gauge as a cut-away of the ground, each level a chamber, locked ones dark, the next one marked "opens tomorrow" once today's level is passed. Play / Shop / Gem Book / How to play.
- **Play:** the winch and claw at the top, the field below, the clock and target bar, a big Drop button (also Space / Enter / tapping the field). Pause button.
- **Hold on!:** `QuestionModal` over a frozen moment of the gem dangling.
- **Level end:** passed / so close, gems caught, coins, stars, then the shop.
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

What needs painting (about 40 pictures, in batches so each can go live on its own):
- **10 level backgrounds** (one per place, a cut-away of the earth at that depth, 1600 × 1000), plus the level map.
- **10 gems** as sprites on plain backgrounds, plus a larger Gem Book painting of each.
- **Rocks** (3 sizes), **mystery sack**, **cave crab**.
- **The winch and claw** (claw open and closed), **Nugget** in 4 poses (wave, point, cheer, oops).
- **Shop items** (4) and the shopkeeper's stall.
- **Home page card** (section 6).

Style to settle with mock-ups early in Stage 2: bright, rich, storybook painting that keeps gems easy to tell apart at small size on a Chromebook.

## 10. Tests (at most 8, guide section 7)

- Rules (3): the same seed and drops always give the same level result; slips come only from the seed and the server's marks; level pass, stars and the one-new-level-a-day rule (across New Zealand midnight).
- Server (3): wrong is wrong and an answer counts once; another pupil's seed is refused; `levelEnd` saves the replay's result, not a faked total.
- Screens (2): the accessibility check (copied from Clan Quest) and the guided first go can't get stuck.
- Plus `supabase/tests/database/diamond.test.sql` and the "index.ts is up to date" check. Balance goes in `scripts/diamond-sim.mjs`.

## 11. Stages

0. **Plan** (this). Stop for James.
1. **Rules engine and simulator** (including the one-new-level-a-day rule, simulated over a 35-day season) in `shared/diamond/`: config, field from seed, swing and reel, slips, shop effects, replay. Simulator tunes times, targets, slip chances and coin flow so the diamond lands around 3 weeks. 3 rule tests.
2. **Screens, drawn art and phone preview**, plus `docs/DIAMOND-ART-PLAN.md` with prompts and style mock-ups so James can start painting. Trial backend so the preview never touches the live server. Published as a private Artifact for James to try.
3. **Server and migration:** `diamond` function (way A, replay), tables, pgTAP tests.
4. **Hub fit:** points, achievements, teacher switch and summary, How to play from config, the Hall, accessibility.
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

Still open: how this game reads the school season date (ask before Stage 4), and whether to add a home page "new level ready" chip (a separate small step).

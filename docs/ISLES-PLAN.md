# Sky Isles: plan

*An original kingdom-building game for School Games Hub, in the BBS "empire game" genre. Asked for by James on 1 November 2026, after we read [Immortal Barons](https://github.com/andy5995/immortal-barons) together. Written from that reading, `docs/GAME_DEVELOPMENT_GUIDE.md` (main `92735a2`) and the other games' plans. Branch `isles`, worktree `~/games-hub-isles`.*

**Status (2 Nov 2026, after S.3 and the step-by-step turn): stages S.0, S.L (look chosen: hand-painted anime), S.1 (rules engine), S.2 (the server) and S.3 (the screens, art and a private preview) are done, and the turn is now 11 steps, one choice at a time. Nothing is live. Next is S.4 (classmates: races, ropes, market, news).** Every choice marked **(chosen)** was made for James. He can change any of them, and most are cheap to change until stage S.2. The working name "Sky Isles" (id `isles`, CSS prefix `.si-`) is one of them.

---

## 0. Why an original game, not a copy

Immortal Barons (MIT licence, Andy Alt, 2026) describes itself as a remake of the 1990s BBS door game *Barren Realms Elite*, and most of its numbers were read out of that game's program so the two play the same. Building it for the hub, even renamed, would be a copy of a specific existing game. So **Sky Isles takes the genre and none of the game**: no code, numbers, names, text, unit list or screens from Immortal Barons or Barren Realms Elite.

**From the genre we keep:**
- A few turns a day.
- Land of different kinds, each with one job.
- A tax-versus-happiness choice.
- Feeding your people, with food that goes off.
- Growth that gets dearer the bigger you are.
- A shared world with classmates: a market, friendships, a news board, and friendly head-to-head contests.
- Random weather.
- A calm start for new players.

**What we leave out, and why:**

| Left out | Why |
|---|---|
| War, capturing land, wiping out a player | Unkind for 9-year-olds. Replaced by **Sky Races**: nobody ever loses anything (section 4). |
| Nuclear, chemical and germ weapons, ruined land | Not for children. |
| Spying, bribery, framing, stirring revolts | Teaches tricking classmates. |
| Lottery | Gambling. |
| Loans, interest, betraying treaties | Too fiddly, and betrayal hurts feelings. |
| Huge numbers, 25 menus, a long grind | Numbers stay in the hundreds. About 5 screens. One lesson's play takes 10 to 15 minutes. |

---

## 1. The short version

- You keep a **small floating island** in a sky shared by your class. You start with 6 building spots. Each day the wind brings a new chunk of land drifting past, and you can anchor it to add a spot.
- **Six turns a day (chosen).** Each turn: answer the sky pilot's question, collect what your island made, feed your people, then spend: anchor land, build, set your tax, trade. About 2 minutes a turn, so a lesson's six turns fit 10 to 15 minutes.
- **Six kinds of building (chosen),** each with levels 1 to 3:
  - Farms make food.
  - Mines make coins steadily.
  - Docks make more coins when your people are happy.
  - Houses hold people.
  - Workshops build sky-boats and goods.
  - Libraries make ideas that unlock upgrades.
  The choices are what to build, how high to set your tax, and whether to grow now or save.
- **The big goal:** grow your island to **Grand Isle** (16 building spots) and build its **Sky Lighthouse** in four stages, inside one 5-week season.
- **Classmates:**
  - **Sky Races:** challenge a classmate's island. The day's first win brings coins and goods, and the other side gets a small gift of coins. Nobody loses anything.
  - **Friendship ropes:** tie your island to up to two friends' islands for small shared bonuses.
  - **A class market:** buy and sell food and goods. Prices move when lots of pupils sell the same thing.
  - **A news board:** good news only.
- **The maths (way A, like Marble Rush):**
  - One focus question at the start of each turn. Right gives a **fair wind**, a small bonus for that turn. Wrong means no bonus and nothing lost.
  - Three questions in each Sky Race. Each right answer adds a gust to your boats.
  - The server makes, marks and records every question from the pupil's own maths focus.
- **Season game** on the school's 35-day season. A fresh island every season. Achievements and the Hall of the Skies are kept for good.
- **Pip**, a sky-gull, gives the guided first go and the always-there next-step line.
- **The server is in charge:** the whole island lives on the server. The browser sends a turn's choices, and the server checks them, rolls the turn and sends back the result.
- **Top-notch graphics (James).** Before any screens are built, test scenes are painted in 8 to 10 styles on James's gaming PC and he chooses one (stage S.L, section 7).
- **Size:** about the same as Star Trader. Ten stages (section 11), with a preview for James after stage S.3.

---

## 2. How a turn works

Every number here is a **starting guess**. All of them live in `shared/isles/config.ts`, and the simulator (`scripts/isles-sim.mjs`, stage S.0) sets the real ones.

**Starting island (chosen):**
- 6 building spots: Farm, House, Mine, Farm, Dock and 1 empty. Every building starts at level 1 and can be raised to level 3.
- 300 coins, 120 food, 40 people, happiness 70 out of 100, 2 sky-boats.

**Order of a turn:**

1. **Island report.** What happened last turn, in one short card: weather, newcomers, races.
2. **The sky pilot's question.** One focus question. A right answer gives a fair wind of +20% on everything collected this turn **(chosen)**.
3. **Collect** (shown as a sum on screen, so the planning is real maths too):
   - Farm: 12 food.
   - Mine: 15 coins.
   - Dock: 10 to 30 coins, depending on happiness.
   - Tax: people × tax rate. Low is 1 coin per 4 people, Fair 1 per 3, High 1 per 2.
   - Workshop: 1 sky-boat every 2 turns, or goods worth about 20 coins. The pupil sets this once with a slider: boats or goods.
   - Library: 1 idea.
4. **Feed.** Each person eats 1 food. A shortfall lowers happiness, and some people leave to live on a neighbour's island. Kind words: nobody starves on screen.
5. **Choose, one step at a time** (decided with James, 2 Nov 2026). Every turn walks the same 11 steps in the same order, one choice on each screen: 1 Island report, 2 the sky pilot's question, 3 Collect and feed, 4 Land, 5 Build, 6 Tax, 7 Workshops, 8 Festival, 9 Big projects (an upgrade or a Lighthouse stage), 10 Market, 11 Check and end. A step that can't happen is still shown, greyed out, with the reason and the numbers ("Needs 510 coins. You have 180.") and a Next button, so no step is ever skipped quietly. Land and Build ask "Anchor another?" / "Build another?" after each one while there are coins for it. Steps 4 to 11 have Back (it takes away that step's choices) and "Stop, back to my island" (the turn isn't used). The choices are:
   - **Anchor a chunk.** Only from today's drift (a set number of chunks a day per island). The price rises with island size, which slows the biggest islands and lets small ones catch up.
   - **Build on a spot, or change it.** A fixed price each, more for a Library. Changing a building starts it again at level 1.
   - **Raise a building one level.** Level 2 makes twice what level 1 makes, level 3 three times. It costs the build price × 4 (to level 2), or × 9 plus 6 goods (to level 3).
   - **Set the tax:** Low, Fair or High. Three settings, not a percentage. Each shows what it will do in words.
   - **Hold a festival:** coins for +15 happiness, once a day.
   - **Trade** at the class market.
   - **Unlock an upgrade** with ideas (section 3).
   - **Build a Lighthouse stage** (once at Grand Isle size).
6. **End of turn.**
   - Food over the store size (20 per Farm, plus upgrades) goes off: a tenth a turn.
   - People move towards the space the Houses give them: faster when happy, slower when taxed High.
   - Sometimes a weather event happens (about 1 turn in 8).

**One server request per turn.** The browser sends all of the spend choices together. The server checks every one against the rules (enough coins, chunk still in the drift, and so on), refuses the turn if any choice is impossible, then rolls the end of turn from the island's seed.

**Happiness (0–100).** It goes up with Low tax, festivals, enough food and good weather. It goes down with High tax, shortages and storms. Below 30, some people leave each turn. It affects Dock income and how fast people arrive.

**Weather (chosen, all kind):**
- Rainbow: +food.
- Golden geese: +coins.
- Fog: Docks earn half this turn.
- Storm: a tenth of food blown away. A Wind Wall upgrade stops it.
- Warm breeze: +happiness.
- Lost traveller: +a few people.

Never a loss of land or boats.

---

## 3. Upgrades (ideas from Libraries)

Eight upgrades, each one simple and shown with a picture **(chosen)**:

| Upgrade | Ideas | What it does |
|---|---|---|
| Better Ploughs | 4 | Farms +25% food |
| Cool Cellars | 4 | Food goes off half as fast, and stores are bigger |
| Bunk Beds | 6 | Houses hold more people |
| Welcome Lanterns | 6 | Docks earn more at every happiness level |
| Wind Wall | 6 | Storms blow nothing away |
| Swift Sails | 8 | Sky-boats are faster in races |
| Sky Bridge | 8 | Friendship ropes give twice the bonus |
| Star Map | 10 | One extra chunk in your daily drift |

An island can't get every upgrade in one season with only one Library, so a second Library is a real choice against more Farms or Docks.

---

## 4. Classmates: races, ropes, the market and the news

Classmates only, never other schools, and never anyone's maths shown to anyone else.

### Sky Races (instead of war)

- **Challenging.** On a turn you may challenge one classmate's island to a race. A sky-boat race plays as a short animation.
- **Your speed** is your boats sent, plus your upgrades, plus your happiness, plus **one gust for each right answer** to three focus questions, plus a little luck.
- **The questions come during the race (chosen, 2 Nov 2026).** The boats sail a stretch and stop; a question pops up with the race still in view. A right answer blows a gust into your sails for the next stretch; a wrong one gets a kind "No gust this time, keep sailing!" and nothing is lost. With 3 questions the stops are a quarter, a half and three quarters of the way. Leaving mid-race and coming back carries on from the same stop.
- **Their speed** comes from boats they keep home. They don't need to be online.
- **Winner:** race points, and a prize. The day's first win brings 30 coins and 5 goods (goods help raise buildings to level 3). A later win brings 15 coins. No free land.
- **The other island** gets a small "well raced" gift of coins. **Nobody ever loses land, boats or anything else** **(chosen)**.
- **Limits (chosen):**
  - One race a turn, and at most 2 a day.
  - Never the same classmate twice in a day.
  - An island can be challenged at most 3 times a day.
  - Islands in their calm start can't be challenged (section 6).
- **When no classmate is free,** the **Gull Riders**, a computer crew, are always there to race.
- **The server decides the result** from the race's seed and the marked answers, and sends the race one stretch at a time. What it has shown never depends on an answer not yet given.
- **The teacher can switch races off** for the class. The game still works without them.

### Friendship ropes (instead of treaties)

- **Up to 2 ropes per island (chosen).**
- **Making one:** you offer by button and they accept by button. Either side can untie with no penalty.
- **Bonuses:**
  - Trading at the market with a roped friend has no fee.
  - Each roped island gets +1 idea a day.
  - When a storm hits one island, its roped friends' Wind Walls protect it too.
- No betrayal, no "breaking a treaty" cost, and nothing gained by untying.

### The class market

- **Food and goods only (chosen).** Prices come from the server and drift overnight towards normal.
- **Selling lots of one thing** lowers its price for the whole class for the day, the same idea as Star Trader's shared market, much smaller.
- **No typed offers.** Everything is buttons and amounts.

### The news board

- **Good news only:** "Ana's island reached 12 spots!", "Rawiri won a Sky Race against the Gull Riders", "Storm over the east sky, Wind Walls held."
- **Never** who lost a race, and never anything about maths.

---

## 5. The maths (GAME_DEVELOPMENT_GUIDE section 4, way A)

- **Where the questions come from.** The server reads `space_maths_context(player)` and makes the pack with `makeFocusPack` from a seed. It stores the whole questions in `isles_questions` (RLS on, no policy, no grant), sends only `publicQuestion`s, marks each answer once with `isles_claim_answer`, and records it with `recordMathsAnswers(…, 'isles')`.
- **The turn question.**
  - The end-of-turn response carries the next turn's question, so it needs no extra request.
  - Answering it is one request: right or wrong, plus the fair wind if right.
  - The wind lasts only for that turn, so there's no reason to rush or guess.
- **Race questions.** Three per race, made when the race starts, each answered and marked on its own (one try each).
- **Shown with `QuestionModal`**, so every kind of ladder question works: typed answers, choices, the decimal key and fractions.
- **No timers.** A wrong answer shows the right one and play goes on.
- **The planning maths is real too.** The Collect sum, chunk prices, food needed versus food in store, and market totals are shown with their working. These are never questions.
- **Maths nudges, never decides.** A pupil who gets every question wrong still reaches Grand Isle, a little later. The simulator checks this (S.0).

---

## 6. Design decisions (GAME_DEVELOPMENT_GUIDE section 1a)

### 6.1 The big goal

- **The goal:** **Grand Isle** means 16 building spots, then the **Sky Lighthouse** in 4 stages (each costs coins and goods). A lit Lighthouse shines on everyone's sky map for the rest of the season.
- **Pace:** the simulator should show a pupil who plays 3 to 4 days a week (about 18 to 24 turns a week) reaching Grand Isle around week 4 and lighting the Lighthouse in week 5. A pupil who plays every day gets there in week 3 or 4.
- **After the goal:**
  - Keep growing, past 16 spots and up through the building levels, for island worth.
  - Collect all 8 upgrades.
  - Race.
  - Help roped friends with gifts of food.

### 6.2 Season game: yes

- **Why:** land and upgrades pile up, so a late joiner would be hopelessly behind without a fresh start.
- **Uses the school's season** (35 days, from the admin's date, with the holiday pause), the same clock as Dragon Maths and Clan Quest. **Question for James:** which shared function to read it through.
- **Reset each season:** the island, coins, food, people, upgrades, boats, ropes, market prices and news.
- **Kept:** achievements (`keep_achievements` true), the island's name and flag, and the **Hall of the Skies**.
- **The Hall of the Skies:** each class's top 3 islands by island worth, plus everyone who lit a Lighthouse. Kept for good.
- **The last 5 days:** a countdown banner. Then a celebration screen showing your island's season in numbers.
- **Joining late or missing days:**
  - Unused turns carry over for up to 2 days (12 turns).
  - Chunks are cheap for small islands, because the price follows island size (85 coins × the spots already owned).
  - The drift is 1 chunk a day. Unused chunks wait, up to 3 (Star Map: 1 more a day and up to 4).
  - Small islands get one extra chunk while they are under 0.7 of the class's middle size **(chosen)**.

### 6.3 A set number of moves a day: yes, 6 turns

- **Why:** more turns means more land. A pupil playing every night at home would leave the class behind, and the game is meant to be a little each day across a season.
- **Maths still gets practised:** races, plus the hub's other games.
- **Counted on the server,** which refuses a seventh turn. Days roll over at New Zealand midnight (`nzDate`).
- **When turns run out:** "Your island is resting. See you tomorrow!" The pupil can still look around, trade at the market and manage ropes.
- **Home page "Left today" chip:** needs an in-place edit to `my_moves_left()`. That is a shared function, so it's its own small step later. **Question for James.**

### 6.4 Progress bars

- **In the game:**
  - The **road to Grand Isle**: spots from 6 to 16, then the 4 Lighthouse stages.
  - **Today's turns**: 6 pips.
  - The upgrade list shows how many ideas the next one needs.
  - Reuse `LevelBar` where it fits.
- **On the home page:**
  - The hub's level bar and achievements come for free.
  - The moves-left chip is in 6.3.
  - **No season strip:** that would need `Dashboard.tsx`, which is not this branch's to change.
- **Bars never show maths.**

### 6.5 Achievements

Recorded through `hub_games` (`counts_fn`, `achievement_measures`, `achievement_types` with `game = 'isles'`). All of them survive New Season.

| Name | What it's for (pupil words) | Measure, number | Roughly who gets it |
|---|---|---|---|
| First Anchor | Anchor your first chunk of land | `chunks_anchored` ≥ 1 | Nearly everyone, day one |
| Green Thumbs | Build 5 Farms on one island | `most_farms` ≥ 5 | Most pupils, week 1 |
| Happy Isle | Keep happiness at 90 or more for a whole day | `happy_days` ≥ 1 | About half |
| Bookworm | Unlock 4 upgrades | `upgrades_season_best` ≥ 4 | About half |
| Race Winner | Win a Sky Race | `races_won` ≥ 1 | Most pupils |
| True Friend | Keep a friendship rope for 7 days | `rope_days_best` ≥ 7 | About a third |
| Grand Isle | Grow your island to 16 building spots | `grand_isles` ≥ 1 | About half, by the season's end |
| Lighthouse Keeper | Light the Sky Lighthouse | `lighthouses` ≥ 1 | About a third |

**Points (`rules_fn`, `add_game_points`, at most 40 a day across the hub):**
- Each turn played: 1 point.
- Each race won: 2 points.
- Reaching Grand Isle: 10 points.
- Each Lighthouse stage: 5 points.

The `once` keys are the turn number and the race id.

### 6.6 Home page card art

- **Scene:** a bright, flat storybook sky above the clouds. A few small floating islands with farms, little houses and a lighthouse, and sky-boats with sails crossing between them. No text. Marble Rush course-card style (`docs/HOME-ART-PLAN.md`).
- **Prompt (draft):** "flat storybook illustration, bright morning sky above soft white clouds, five small floating grassy islands with tiny farms, cottages, windmill and a white lighthouse, little wooden sky-boats with coloured sails sailing between them, gulls, cheerful, clean shapes, no text, wide landscape".
- Until it's painted, the card shows its `colours` gradient (sky blue to teal) and an island `Icon`.

### 6.7 A guide for new players: Pip the sky-gull

**A new pupil's first go, walked through (before building; to check again once screens exist):**

| Moment | What the game does | Why a child gets stuck | Fix |
|---|---|---|---|
| Opens the game | Shows an island and 6 kinds of building | Too much at once | The guided first go shows one thing at a time. Building names have pictures. |
| First question | The sky pilot asks a sum | "Why am I doing maths?" | Pip: "Get it right for a fair wind: everything grows more this turn!" |
| Collect | Numbers pop up | Doesn't know where they came from | Each number sits on its building, then they add up in a sum line. |
| Feed | Food goes down | Doesn't notice until people leave | A food bar that shows "enough for 3 turns", and a warning before it runs out. |
| Spend | Lots of buttons, some greyed out | Greyed buttons with no reason | Every greyed button says why ("Needs 40 coins, you have 25"). |
| Anchor a chunk | Drift panel | Doesn't know what a chunk is | Pip lights up a drifting chunk: "Tap to anchor it. More land, more to build." |
| Tax | Low / Fair / High | "Tax" is a new word | One line each: "Fair: 1 coin from every 3 people. They stay happy." |
| End turn | The turn rolls | Doesn't know it used a turn | The 6 pips go down one, with "5 turns left today". |
| First race | Chooses a classmate | Worried about losing | "Nobody loses anything in a Sky Race." The first race is against the Gull Riders and can't be lost. |
| Turns run out | Island rests | Thinks it's broken | "Your island is resting. See you tomorrow!" with what to do next time. |

**The guided first go (about 3 minutes, real buttons in the real game):**
1. Answer the turn question.
2. Watch the collect.
3. Anchor the first chunk.
4. Build a Farm on it.
5. End the turn.
6. Celebrate: "Your island grew!"

Turn 2's guide adds the Workshop slider and the first race against the Gull Riders. That race is set up so it can't be lost: a pure `starterRace` function, tested on many seeds.

- **Who gets it:** decided by the server's saved island (no turns played this season, and never finished the guide). It follows the pupil to any Chromebook.
- **Never stuck:** the guide follows what the pupil does. If they skip ahead it catches up, and every step can be skipped.

**Other help:**
- **Next-step line, always there.** One sentence with real names and numbers ("Your food runs out in 2 turns: build a Farm on your empty spot"), worked out fresh by a pure function `nextStep(island)`, with a "Show me" button that lights up the button it means.
- **First-time tips:** a closable bubble the first time of each weather event, market, rope offer, race result and Lighthouse.
- **Help with real choices:**
  - For the tax setting and Workshop slider, Pip shows the numbers and an opinion with the working ("High tax: +8 coins a turn, but about 3 people a turn will leave").
  - Pip never chooses for the pupil, and **never helps with the maths questions**.
- **Help fades:** Lots on day one, then Some, with a "Lots / Some / Off" choice and "Replay the guide" any time.
- **Reduced motion** is respected for Pip and the race animation.
- **It's a stage of its own (S.5),** and James tries the guided first go himself.

---

## 7. Screens and look

**Your Sky Keeper (James, 1 Nov 2026).** On their first go, each pupil chooses a **Sky Keeper**: a painted portrait of the young keeper who looks after their island.
- **The portraits:** 40 to choose from, 20 boys and 20 girls, aged from about 8 to older teens. They come from many backgrounds, as in a New Zealand classroom, and each has their own sky-adventurer look.
- **Just for fun:** the keeper has no powers and doesn't change the rules.
- **Where it shows:** next to the island on My island, as the island's marker on the class sky, on the boat in a Sky Race, beside the island's name in the news, and in the Hall of the Skies.
- **Changing keepers:** a pupil can change their keeper any time from My island.
- **Kept with the island's name and flag** through New Season (section 6.2). It's saved as `keeper` (a portrait id) on `isles_islands`. The server only accepts ids from the list.
- **Two classmates can choose the same keeper.** Islands are always shown with their names too.
- **Guided first go:** choosing a keeper is the first step. Pip says: "Who looks after this island? Pick your Sky Keeper. You can change later."

**About 5 screens (chosen):**
1. **My island.** The island picture with its building spots, and the resource bar: coins, food, people, happiness, ideas, boats. The next-step line and the turn pips are here. Tapping a spot builds on it, changes it, or raises its level.
2. **The turn.** Report, then question, then collect and feed, then spend panel, then End turn.
3. **The sky.** A map of the class's islands: size, roped friends, lit Lighthouses. From here you race, rope, and read the news.
4. **Market.**
5. **Upgrades.**

Plus How to play (numbers read from the config) and the season-end celebration.

**Look: the graphics must be top notch (James, 1 Nov 2026).**
- **Choose the style before building screens (stage S.L).** We paint test scenes in a lot of different styles on James's gaming PC (ComfyUI, Z-Image Turbo, the way Kingdom Keeper's and Star Trader's art was made). Each style paints the same three test pictures, so the styles can be compared fairly: the island close up, the class sky, and a Sky Race.
  - Aim for about 8 to 10 styles, for example painterly fantasy, cel-shaded game art, cosy diorama/tilt-shift, clay or toy, ink-and-watercolour, papercut, pixel-art-HD, low-poly 3D render and soft 3D animated.
  - The styles are shown side by side on one private page, so James can choose one (or mix two).
  - It must look different from Kingdom Keeper (animated-film painting, sky frame), Dragon Maths and Clan Quest (gritty painted) and Star Trader (cinematic).
- **Screens are built around the painted art, not the other way round.**
  - Every kind of building is painted at each of its 3 levels, standing alone so it sits straight on a painted clearing.
  - The island is painted as layered pieces (a base with bare clearings, buildings, sky-boats), so growth shows as buildings getting bigger and grander.
  - The sky, the weather, Pip, the races, the Lighthouse stages and the endings are all painted.
- **Drawn-in-code art stays as the fallback** for a picture that hasn't loaded (guide section 2, "Painted art"). It is also what S.1 to S.2 use while there are no paintings yet.
- Full list of pictures, sizes and prompts: `docs/ISLES-ART-PLAN.md` (written in S.L once the style is chosen).
- Hub colour tokens and shared buttons outside the play area. `.si-` classes.
- 44 px targets and 4.5:1 contrast. Checked at 1366 × 640 and 844 × 390.
- Copy Clan Quest's `Accessibility.test.tsx` (within the 8-test limit, section 9).

---

## 8. Server and database

**Server function `isles`.** `handler.ts` holds the logic with the database passed in, `entry.ts` the plumbing, and `index.ts` is generated by `npm run build:functions -- isles`. It checks sign-in with `_shared/signIn.ts` and checks the teacher switch itself.

**Actions:**

| Action | What it does |
|---|---|
| `load` | The island, today's drift, the next question, and the news |
| `answer` | Marks the turn question |
| `turn` | Checks and plays the turn, returns the result and the next question |
| `raceStart` / `raceAnswer` / `raceFinish` | Runs a Sky Race |
| `ropeOffer` / `ropeAccept` / `ropeUntie` | Friendship ropes |
| `market` | Buys or sells at the class market |
| `guideDone` | Marks the guided first go as finished |

**Migration `20261102000100_isles.sql`** (a free number on 2 Nov 2026 from `node scripts/migration-numbers.mjs`; on hold in `supabase/migrations-on-hold.txt`; check again at go-live). New tables, all prefixed `isles_`, RLS on, pupils read only through `my_isles()` and `isles_sky()` (own class only, via `my_school()` and class membership):

| Table | Holds |
|---|---|
| `isles_islands` | One per pupil per season: spots (kind and level), resources, upgrades, seed, turns used today, guide state |
| `isles_turns` | One row per turn played, with a unique turn number (so a turn sent twice counts once) |
| `isles_questions` | Server only: the stored questions and marks |
| `isles_races` | Who, result, prize |
| `isles_ropes` | Pairs of islands, offered or tied |
| `isles_market` | One row per class: today's prices and today's sales |
| `isles_news` | Short good-news lines, class only, kept for the season |
| `isles_hall` | Season winners, kept for good |

**Teacher settings** (`app_settings` columns, `teacher_set_isles(…, target_class)`):
- `isles_enabled` (off to start).
- `isles_races` (on).

That's all **(chosen)**: keep settings few.

**Hooks:**
- `hub_games` row with `switch_column`, `counts_fn`, `rules_fn`, `season_fn` (clears islands, ropes, market and news), `last_played_fn` and `keep_achievements`.
- Achievement measures and types.
- Points through `add_game_points`.

**Requests (estimate):** per pupil per day, about 6 turns × 2 requests + 2 races × 5 + a few loads and trades, so about 25.
- A class of 28 playing every school day: about 3,500 a week, 15,000 a month.
- Six classes: about 90,000 a month, against the free size's 500,000.
- Other games share that too, so the market and news are read with `load`, not polled.

---

## 9. Testing (at most 8, `docs/TESTING.md`)

| # | Kind | What it checks |
|---|---|---|
| 1 | Server | Wrong answer marked wrong; an answer sent twice counts once; another pupil's seed refused; not signed in refused |
| 2 | Server | A turn sent twice counts once; a 7th turn in a day refused; an impossible spend refused |
| 3 | Server | A race can't be rigged by the browser; the result comes from the seed and the marked answers; the challenged island loses nothing |
| 4 | Maths | Every ladder skill comes through and shows (copy Marble's `maths.test.ts`) |
| 5 | Rules | A turn rolls the same from the same seed and choices (the server and preview agree) |
| 6 | Rules | `starterRace` can't be lost on any of 1,000 seeds |
| 7 | Screen | Accessibility: contrast, target size, reduced motion (copy Clan Quest's) |
| 8 | Screen | The guided first go: a pupil can press through it, skip it, and it catches up |

**Not counted in the 8:**
- `supabase/tests/database/isles.test.sql`: server-only tables refused (42501), own class only, a save sent twice counts once.
- The "index.ts is up to date" check.

**Balance and pace go in `scripts/isles-sim.mjs`, not in tests:** time to Grand Isle for daily, 3-day and 1-day players, all-wrong maths, tax strategies, and whether coins pile up unused.

---

## 10. Teacher

- **The `teacher` part of the definition:**
  - `switch` (the game on or off for a class) and Settings (races on or off).
  - `useSummary` for the Games table: how many played this week, and Grand Isles reached.
  - A `StudentPanel` with the island's size, turns played and Lighthouse stages.
  - `studentSummary`: one line per student.
- **`hardest(classId)`:** the focus skills Sky Isles questions get wrong most this week.
- **`alerts(classId)`:** a pupil whose island has had no food for 3 turns in a row (they may be stuck).
- **Reset a pupil's island** from the student panel: a card asks the teacher to confirm, and achievements are kept.
- **`SeasonPanels`:** the class's Hall of the Skies.

---

## 11. Stages

Stop for James after each.

| Stage | What | James sees |
|---|---|---|
| **S.0** | Rule sheet `docs/ISLES-RULES.md`, `shared/isles/config.ts`, simulator. Numbers tuned for the pace in 6.1. | The simulator's pace table |
| **S.1** | Rules engine in `shared/isles/` (turn, collect, feed, spend, weather, races, `starterRace`, `nextStep`), pure and seeded. Tests 5 and 6. | Nothing to play yet |
| **S.2** | Migration, server function (single-player turns and maths), database test, tests 1, 2 and 4. Number in `migrations-on-hold.txt`. | Nothing live |
| **S.L** | **Choose the look.** Test scenes in 8 to 10 styles painted on the gaming PC, shown side by side. Once James picks, write `docs/ISLES-ART-PLAN.md` and paint the pictures the screens need first. | **Styles side by side; James chooses** |
| **S.3** | Screens (island, turn, upgrades, How to play) built around the chosen paintings, and a **preview** with a trial backend, no sign-in. | **The preview on his phone** |
| **S.4** | The class sky: races, ropes, market, news. Test 3. | Updated preview with pretend classmates |
| **S.5** | Pip: guided first go, next-step line, tips, help levels. Test 8. | **James tries the guided first go** |
| **S.6** | Hub parts: teacher contract, achievements, points, season hooks, Hall, accessibility (test 7), code switch, `docs/prompts/isles-golive.md`. | The go-live list |
| **S.7** | The rest of the painted art (weather, endings, the home page card) in the chosen style, `scripts/isles-art.py`, `CREDITS.md`, `art.test.ts`. Must be done before go-live: top-notch graphics are part of the game. | Pictures to check |
| **S.8** | Go live, one step at a time (guide section 8). | Each step asked for |

---

## 12. Questions for James

**Answered 1 Nov 2026:** James said yes to the plan, so questions 1 to 3 and 6 stand as chosen. He added one thing: the graphics must be top notch, with lots of styles mocked up on his gaming PC to choose from (stage S.L). Questions 4 and 5 are about shared functions. They are still open and get asked again at stage S.6, when they matter.

1. **Name and theme.** "Sky Isles", floating islands in a shared class sky (chosen). Other ideas: "Island Keepers" (sea islands with boats), "Cloud Kingdoms".
2. **Races.** Keep Sky Races as the head-to-head part, with nobody losing anything, and a teacher switch to turn them off (chosen)? Or leave classmates out of it apart from the market and ropes?
3. **Turns a day.** 6 (chosen), about 10 to 15 minutes. More turns means a longer daily session.
4. **The school season.** Which shared function should Sky Isles read the season through, the same way Clan Quest shares Dragon Maths' date?
5. **The home page "Left today" chip.** Do you want it? It means an in-place edit to the shared `my_moves_left()`, as its own small step.
6. **The guide.** Is Pip the sky-gull right, or would you like a different character?

---

## 13. Stage results

*(Filled in after each stage: what was built, decisions, tests, what is untested, the go-live list.)*

### S.0 results (rules, numbers, simulator), 1 Nov 2026

**Built:**
- `shared/isles/config.ts`: every number.
- `shared/isles/engine.ts`: the turn rules, pure and seeded. It covers a new island, a new day, collect, feed, `beforeSpending` (for the spend screen), every spend choice with `problemWith`, the end of a turn, weather, `playTurn` and `islandWorth`.
- `scripts/isles-sim.mjs` (`npm run isles:sim`).
- `docs/ISLES-RULES.md`: the rule sheet with the pace table.

**Numbers changed from the plan's first guesses while tuning:**
- **Smaller numbers:** start with 150 coins, 30 people, and half a food per person.
- **Coins limit growth, not the drift.** Chunks cost 22 × plots, so the drift of 3 a day rarely runs out. (Changed again on 2 Nov, below.) That makes choices and maths matter: with the first guesses everyone reached Grand Isle on the same day, whatever they did.
- **Houses rebalanced.** Houses now hold 30 people and tax is per 2 people at Fair. Before, a House plus its Farm earned less than two Mines.
- **Upgrades are ×1.5,** so a Library is worth building.
- **Fair wind is ×1.15,** so all-wrong maths still reaches Grand Isle (week 3 for a daily player), just a little later.
- **The Lighthouse costs 3,350 coins and 70 goods in all.**

**Decisions:**
- Fog takes half of the turn's Dock coins (the plan said Docks earn half; same thing, done at the end of the turn).
- An impossible choice refuses the whole turn, and the turn isn't used.
- **A pupil who plays 1 day a week doesn't reach Grand Isle** (about 8 or 9 spots). The small-island extra chunk and the saved turns help in a real class, but the simulator doesn't model them. Worth a look in S.4, once classmates are in the simulator.

**Open for later stages:**
- **Coins pile up for daily players after the Lighthouse is lit** (about 30,000 by season's end). It needs something worth spending on after the goal: gifts to roped friends, or island decorations that show on the sky map. To decide in S.4.
- **High tax plus land-grabbing** is slightly the fastest route to the Lighthouse for a 3-day player. Fine as a trade-off for now (it gives fewer people and lower worth). Watch it.
- Races are only modelled in the simulator (an even chance, the day's first win brings 30 coins and 5 goods). The real race rules come in S.1.

**Tests:** none yet (tests 5 and 6 come with S.1). The engine type-checks.

**Untested:** everything in the browser and on the server (not built yet).

### Rule change: building spots and levels, 2 Nov 2026

Decided with James because 40 small plot tiles looked crowded and "stuck on". Built in `shared/isles/config.ts` and `engine.ts`; `docs/ISLES-RULES.md` and `docs/ISLES-ART-PLAN.md` are brought up to date. The S.0 notes above are the 1 Nov version.
- **Building spots instead of plots.** 6 to start, 16 for Grand Isle (was 40 plots). Spots keep the order they were claimed.
- **Every building has levels 1 to 3.** Level 2 makes twice a level 1, level 3 three times. Raising costs the build price × 4, then × 9 plus 6 goods. New action `raise`.
- **Land:** a chunk costs 85 × spots owned. The drift is 1 a day, unused chunks wait (up to 3), small islands get one extra.
- **Upgrades renamed:** Tall Houses is now Bunk Beds, Bright Docks is now Welcome Lanterns (same costs and effects).
- **Sky Race prizes:** no free land. First win of the day 30 coins and 5 goods, a later win 15 coins.
- **Island worth:** 10 a spot, 5 a building level, 1 a person, 15 an upgrade, 50 a Lighthouse stage.
- **Why:** far fewer, bigger things on the island, standing in painted clearings joined by paths. Growth shows as bigger buildings, not more tiles.
- **Pace (`npm run isles:sim -- --runs 50`):** a daily pupil reaches Grand Isle on day 15 to 17 (week 3), a 3-days-a-week pupil on day 24 to 29 (weeks 4 to 5). Building levels matter: a pupil who only grabs land is a week or more behind. **1 day a week still doesn't reach Grand Isle** (about 8 or 9 spots). Coins still pile up after the Lighthouse (S.4).

### S.1 results (the rules engine), 2 Nov 2026

**Built (all pure functions in `shared/isles/`, every number in `config.ts`):**
- **`race.ts`: Sky Races.**
  - `runRace(seed, you, them, right)`: speed is 30 + sky-boats (3 × √boats, up to 16) + Swift Sails (+3) + happiness (up to +4) + 5 for each right answer + luck (0 to 12). The side that wasn't asked questions gets a home wind of +5. Ties go to the challenger.
  - The result comes only from the seed, the two boats and the number of answers marked right, so the server can work it out at `raceFinish` and the browser can't rig it.
  - It returns what the animation and the result card need: each boat's speed part by part (for the working), where each boat is at the end of each of 8 legs (0 to 1), and the legs where the gusts blow.
  - `gullRiders(you)`: the Gull Riders bring the same boats and sails as the challenger (happiness 70), so a race against them is decided by the gusts and a little luck.
  - `starterRace(seed, you, right)`: the first race can't be lost; the Gull Riders finish 86% to 96% of the way.
  - `raceProblem`: one race a turn, 2 a day, a turn left, never the same classmate twice a day, a classmate challenged at most 3 times a day, and no challenging an island in its calm start.
  - `settleRace`: counts the race, gives the prize (first win of the day 30 coins and 5 goods, later wins 15 coins) and the 5-coin "well raced" gift to the other side, win or lose. Nobody loses anything.
- **`nextStep.ts`: Pip's next step.** `nextStep(island)` gives one sentence with real names and numbers and the button it means (`spot-<n>`, `drift`, `upgrade-<id>`, `lighthouse`, `market`, `race` or `end-turn`). It covers food running out, a full island, an empty spot, an upgrade ready, the Lighthouse, a chunk in the drift, a building worth raising, a race, and saving up. Examples it gives: "Your food runs out in 3 turns: build a Farm on your empty spot." "Raise your Dock to level 2 for 120 coins: it will earn about 18 coins a turn instead of 9." "Save up for stage 1 of the Sky Lighthouse: you need 300 more coins and 6 more goods."
- **`engine.ts`:** the island now remembers today's races (races, wins, classmates raced, times challenged, the turn of the last race) and races won this season; a new day clears today's.
- **`config.ts`:** the race numbers, the calm start (12 turns), and a `does` line for each upgrade in pupil words.
- **Checked against the stage table:** turn, collect, feed, spend and weather were already built in S.0; races, `starterRace` and `nextStep` are new. Nothing else S.1 lists is missing. Friendship ropes, the market's moving prices and the news board are S.4.

**Simulator:** races are now real (the Gull Riders, twice a play day, race questions right as often as turn questions, the season's first race is the starter race). **Grand Isle days didn't move.** The Lighthouse did, because race wins bring goods: a 3-days-a-week pupil with all maths right now nearly always lights it in week 5 (under half before); an every-day pupil with all wrong wins about 1 race in 6 and lights it about a quarter of the time (about half before). Pupils win about 98% of races with all right, 80% with 70% right, and 16% with none. The pace table in `docs/ISLES-RULES.md` is updated.

**Decisions (James can change any):**
- **The home wind** (+5, one gust of +5) for the side that wasn't asked: two right answers beat an even match about 5 times in 6; none right wins about 1 in 6 (James's answer, below).
- **Gull Riders match your boats,** so even a big island needs its questions to beat them, and a small island isn't hopeless against them.
- **The calm start is 12 turns** (about 2 days of play). The plan didn't give a number.
- **A classmate who wins at home** gets the win counted (Race Winner achievement) but no prize, so nobody earns coins by sitting still. The challenger who lost gets the "well raced" gift.
- **A race needs a turn left today,** and counts as part of the turn it's in.
- **The starter race's result card** shows the Gull Riders' luck as below nothing (they're taking it easy). The S.4 screen can hide their luck.

**Tests (2 of the 8, `shared/isles/isles.test.ts`):**
- Test 5: two turns with a race between them roll the same from the same seed and choices, and the classmate who was raced loses nothing.
- Test 6: `starterRace` is won on all 1,000 seeds, with every number of right answers; the same boats in an ordinary race can lose.

**Untested:** everything in the browser and on the server (not built yet). `nextStep`'s wording was checked by eye on a dozen islands, not by a test (the guide says not to test wording).

**Questions for James, answered 2 Nov 2026:**
1. **Races and maths:** "About 1 in 6." A pupil with no answers right should win about 1 race in 6, not 1 in 4, so maths counts more. Done: a gust is now +5 (was +4) and the home wind +5 (was +4). Against the Gull Riders: about 1 in 6 with none right, half with 1, 5 in 6 with 2, and nearly always with 3. A new island against a big one (14 boats and Swift Sails) wins almost half its races with all 3 right (was 1 in 3). Re-simulated: Grand Isle days didn't move; an every-day pupil with all wrong lights the Lighthouse about a quarter of the time (a third before this change).
2. **Winning at home:** "Win counted only." Kept as built: the win counts for Race Winner, no prize.
3. **Calm start:** "12 turns." Kept.

### S.2 results (the server), 2 Nov 2026

**Built:**
- **Migration `20261102000100_isles.sql`** (on hold in `supabase/migrations-on-hold.txt`, not live).
  - Four tables: `isles_islands` (one per pupil: seed, version, NZ day, the island, guide done), `isles_turns` (one row a turn, unique per pupil, season and turn), `isles_questions` (server only; one set per turn, three per race; each answer marked once) and `isles_races` (one open race at a time; finished once).
  - Row security is on, with no policy and no grant, on all four.
  - Pupils read only through `my_isles()` (their own island, never the seed) and `isles_sky()` (own class only, own school, pupils only, hidden profiles left out).
  - Only the server key can save: `record_isles_start`, `_turn`, `_questions`, `_answer`, `_race_start`, `_race_finish` and `_guide_done`, plus `isles_load`, `isles_question_set` and `isles_race`.
  - Teacher switches `isles_enabled` (off) and `isles_races` (on), set with `teacher_set_isles(enabled, races, target_class)`.
  - A `hub_games` row with every hook (counts, point rules, players, season, last played, keep achievements).
  - 7 measures and 7 achievements (True Friend waits for ropes in S.4).
  - Points: 1 a turn, 2 a race won, 10 for Grand Isle, 5 for each Lighthouse stage.
  - Every new function is revoked from public, anon and authenticated at the end. Only what is needed is granted back.
- **Server rules in `shared/isles/server.ts`**, like Kingdom Keeper's `shared/kingdom/server.ts`, so the S.3 preview runs the same code. `shared/isles/memoryServices.ts` is the in-memory database for tests and the preview.
- **Server function `supabase/functions/isles`.** `handler.ts` is thin: sign-in with `_shared/signIn.ts`, 60 requests a minute. `entry.ts` is the database plumbing. `index.ts` is generated. It is added to `FUNCTIONS` in `scripts/build-functions.mjs`.
- **Actions:** `load`, `answer`, `turn`, `guideDone`, and `raceStart` / `raceAnswer` / `raceFinish` against the Gull Riders (the season's first race is the starter race). Classmate races, ropes, market prices and news wait for S.4. `raceStart` against a classmate answers "coming soon".

**Decisions (James can change any):**
- One question per turn, made on load and kept. Answering it before the turn gives the fair wind. A turn played without answering has no wind, and that question is then gone.
- A turn is known by its turn number. If it is sent twice, the second reply is the island as it is now ("already").
- The turn's random numbers come from the island's own seed and the turn number, so the server and the preview roll the same turn. The browser never sees a seed.
- The day rolls over when the island is next loaded (no save is needed just to open the game). Turns pile up for missed days as the rules already say (up to 18).
- One race is open at a time. Pressing Race again carries on the same race with the same questions, so a pupil can't throw away a bad start and try again.
- Market prices are the normal ones until S.4.
- Happy Isle counts a day with at least 3 turns, all ending at happiness 90 or more.
- Achievement counts come from this season's island. Achievements already earned stay (`keep_achievements`).
- New Season empties the island and clears its turns, questions and races. It keeps the row so the guide stays done. The next load makes a fresh island with a new seed.
- Answers up to a billion are accepted (test 4 found that rounding to the nearest million gives answers over a million).
- Not yet in the migration: Sky Keeper portrait, island names, ropes, market, news, Hall of the Skies (S.3, S.4, S.6). They can go into this same file while it is on hold.

**Tests (now 5 of the 8):**
- Test 1 (`supabase/functions/isles/handler.test.ts`): a wrong answer is marked wrong, a send twice counts once, another pupil's question is refused, not signed in is refused, switch off is refused.
- Test 2 (same file): a turn sent twice is played once, a seventh turn in a day is refused, an impossible spend is refused and the turn is not used, six more turns the next day.
- Test 3 (same file, added early for the Gull Riders): the result comes from the stored seed and the marked answers, never from what the browser says. The starter race can't be lost. One race a turn. Another pupil can't finish it. The races switch works. S.4 extends it for classmates.
- Test 4 (`src/games/isles/maths.test.tsx`): every built ladder skill, typed and tapped, comes through the server for a turn question and race questions, shows in `QuestionModal` without its answer, and the right answer is marked right.
- Also the "index.ts is up to date" check, and `supabase/tests/database/isles.test.sql` (42 checks: tables and server functions refused to pupils with 42501, switches, own class only, a save sent twice counts once, a race once, counts, New Season). It ran on a throw-away copy of the database and passed. The copy is dropped.

**Checks run:** type check, `npm run test:all` (338 files, 5,933 tests) and build all passed.

**Untested:** the real server function against a real database, end to end (`entry.ts` is only type-checked). Nothing is deployed. The browser side is S.3.

**Noticed, not fixed (not this branch's to change):** Kingdom Keeper's server refuses answers over 1,000,000, so a pupil whose focus is rounding to the nearest million may have right answers refused there. Worth its own small fix.

**Go-live list additions:**
- Take `20261102000100` out of `migrations-on-hold.txt` in the go-live PR.
- Check the migration number again.
- The `isles` function deploys itself when its `index.ts` lands on main.

### S.3 results (the screens), 2 Nov 2026

**Built:**
- **Art.** A Sonnet helper picked the best of the three tries of each painting. James saw the picks on a private page (https://claude.ai/artifact/3x51vVcDisdSvET8Gw1eQr) and kept them all. The picks are in `docs/isles-art/picks.json`.
  - `scripts/isles-art.py tidy` cuts each piece out and writes `.webp` files to `src/games/isles/art/` (2.4 MB in all; keepers in `art/keepers/`).
  - Pip's white body was being cut away, so his mask also fills in from the corners.
  - Spot positions were placed by hand, in claim order, and are in `picks.json` (`spots`). `CREDITS.md` sits beside the art.
  - `art.test.ts` checks that no picture is missing or spare, and that each base has one position per spot. It is not one of the 8.
  - Every picture falls back to a shape drawn in code if it fails to load.
- **Screens** in `src/games/isles/`, all `.si-`, hub tokens and hub buttons:
  - My island: the painted island with tappable spots, the drift island, the lighthouse and the keeper. The resources bar, turn pips, the road to Grand Isle, and Pip's next step with "Show me".
  - The turn: island report, the sky pilot's question (`QuestionModal`), the collect sum (`beforeSpending`), spending, End turn. All choices go in one `turn` request. Every greyed-out button says why (`problemWith`, with the numbers: "Needs 85 coins. You have 40."). There is Undo last, Clear all and "Back without playing".
  - Upgrades, a Sky Race against the Gull Riders (boats sail leg by leg; reduced motion jumps to the end; the working is shown), the Sky Keeper choice (40 portraits), How to play (numbers from `config.ts`) and the resting message when the day's turns are used.
  - The class sky, the market and the news show "coming soon".
- **Data and switch:** `src/data/isles.ts` (the live server, behind the `IslesBackend` interface in `backend.ts`), `switch.ts` (`ON = false`, `VITE_ISLES_ON`) and `index.tsx`. Not in the registry.
- **Preview:** `preview/isles/` and `vite.isles-preview.config.ts` (`npm run isles:preview`). It runs the real server rules (`handleIsles` with `memoryServices`) in the browser for a pretend pupil with a fixed focus, never calls the live server, and has "Skip to tomorrow" and "Start again". Private preview page: https://claude.ai/artifact/Q7phU2vhvHx4yYSPBUxpE6
- **Sky Keeper in the migration** (still on hold): a `keeper` column (only `b01` to `b20`, `g01` to `g20`), kept through New Season. `record_isles_keeper(player, keeper)` (server key only). It is returned by `isles_load`, `my_isles()` and `isles_sky()`. Server action `keeper`.

**Decisions (James can change any):**
- James chose: keep the Sonnet picks, and put the extra spots past each base's painted clearings on grass.
- A pupil picks a keeper before the first turn (it can be changed later).
- A tax or workshop choice replaces the earlier one in the same turn, so there is only ever one of each.
- A race happens between turns (one per turn), not in the middle of one.
- The 17th spot and beyond show as a list under the island instead of on the picture.

**Tests (now 6 of the 8):**
- Test 7 (`src/games/isles/Accessibility.test.tsx`): text contrast 4.5:1, every control at least 44 px, reduced motion, focus moves to each screen's heading, and a whole turn by keyboard.
- `isles.test.sql` now has 47 checks (keeper added: refused to pupils, saved and loaded, only from the list, false with no island). It ran on a throw-away copy and passed. The copy is dropped.
- Test 8 (the guided first go) is left for S.5.

**Checks run:** the type check, the build and the preview build passed. `npm run test:all`: 5,938 of 5,939 passed. The one failure was a Dashboard Season test (not Sky Isles), which passes when run by itself, so it is slow under load rather than broken.

**Checked by hand** in the preview at 1366×640 and 844×390: choosing a keeper, My island, a turn (right answer gives the fair wind, the collect sum, building, End turn), a race won with its working, and "Show me". There is no sideways scroll at phone width. Screenshots are in `docs/isles-screens/s3/`.

**Untested:** the live server function and `src/data/isles.ts` against a real database. Nothing is deployed and the switch is off.

**Art notes for James (from the helpers):**
- The bases have fewer painted clearings than spots (7 of 8, 9 of 10, 10 of 13, 11 of 16). Extra spots sit on grass.
- Farm levels 2 and 3 sit on a wide wheat slab. Workshop levels 2 and 3 are windmills, but level 1 is a shed.
- Some keepers came out with lighter skin than asked (b01, b10, b11, b15, b20, g01, g06, g10, g11, g20). Some look younger than their age (b13 to b16, g16). g09 has two pairs of goggles.
- Worth checking with families: b17 (turban) and g13 (hijab). Nothing unsuitable for children was found.

**James's answers (2 Nov 2026):** leave the keepers as they are. Repaint farm levels 2 and 3 (no wide wheat slab) and workshop level 1 (so all three levels are windmills). Do this in S.4: `scripts/isles-art.py`, then `tidy --force` for those pieces.

### Step-by-step turn results, 2 Nov 2026

James found the S.3 turn confusing: after the collect sum, one big spend panel offered land, spots, tax, workshops, festival, upgrades, the Lighthouse and the market all at once. **The turn is now the same 11 steps every time, one choice per screen** (section 2). Nothing on the server, the migration or the rules engine changed.

**Built:**
- `src/games/isles/TurnSteps.tsx`: the 11 steps, the "Step 5 of 11" strip with a dot for each step, and Pip's one line for each step. `Spend.tsx` (the big panel) is gone; what's left of it is `Spot.tsx` (a spot's choices, the tax words, and the spot card on My island).
- **Each step:** one heading, one question, one main button, and a quieter "Not this turn" or Next. Focus moves to the step's heading (and again when "Build another?" or a chosen spot changes it).
- **Steps that can't happen** are greyed, say why using `problemWith` and `whyNot` on the island as it will be after the earlier steps ("Needs 510 coins. You have 180.", "There is no land left in the drift today.", "You have no Workshop yet.", "Cool Cellars: Needs 4 ideas. You have 1.", "The market opens soon."), and have Next.
- **Land:** "Anchor a chunk from the drift for 510 coins?" Anchor it / Not this turn, then "Anchor another?" Yes / No, thanks while it's possible. Tapping the drifting chunk on the picture anchors too, on this step only.
- **Build:** only on this step can the spots be tapped (on other steps of a turn they're pictures). A tapped spot shows raise, build or change. After one, "Build another?" Yes / No, thanks.
- **Tax and Workshops** start on last turn's choice, so Next keeps it. **Festival** and **Big projects** move on after one choice. Big projects shows what's possible as buttons, and one line each for why the rest wait.
- **Market** says "The market opens soon" with Next. S.4 fills it in; the step stays so the order never changes.
- **Check and end:** this turn's choices, "Coins left", Undo last and End turn. End turn still sends everything in one `turn` request.
- **Pip:** during a turn he sits under the island and talks about this step only. If his next step (`nextStep`) is about this step, he says it with "Show me"; otherwise the step's own line. On My island, "Show me" for a button that lives in a turn lights up "Play a turn", and the button stays lit when its step comes. `nextStep()`'s targets didn't need to change (the same `data-pip` names, now each on its own step).
- **Phone on its side (844×390):** a tighter layout (smaller header, the turn pips hidden during a turn, Pip under the island, wider step panel, three tax cards in a row, smaller build buttons). Every step's main buttons show without scrolling. A long step (the build choices for a spot, or many upgrades ready at once) scrolls inside its own panel, with Back and Next or "Not this turn" pinned at the bottom.

**Decisions (James can change any):**
- Back takes away the choices of the step you go back to (and of the step you were on), so it can be chosen again.
- Festival and Big projects have one choice each per turn, so they move on straight after it, with no "another?".
- "Back to my island" stays on step 1 (before the turn starts), as before.
- A Sonnet helper checked the screenshots. Its fixes are in: the upgrade buttons are light, not all dark; Land with no drift says so plainly instead of showing a price; the tax cards line up and the picked one has a tick and a thicker border, with plainer happiness words; Undo last sits away from End turn.
- The replay script `scripts/isles-turns/play-three-turns.mjs` plays the three turns and retakes the screenshots in headless Chrome. It needs the preview running on port 5191.

**Tests:** still 6 of 8. Test 7 now walks all 11 steps by keyboard, checks each step's heading gets focus and the strip says "Step n of 11", checks that Land (which can't happen yet) is greyed with "Needs 510 coins. You have …" and that its Next works, and checks Back.

**Checks run:** the type check, `npm run test:all` (340 files, 5,939 tests, all passed), the build and the preview build. The one-file preview is republished to the same private page, https://claude.ai/artifact/Q7phU2vhvHx4yYSPBUxpE6.

**Played in the preview** (headless Chrome, at 1366×640 and 844×390): a turn with lots of coins (question answered right, a chunk anchored, a Library and a Workshop built, High tax, a festival, Better Ploughs), a turn with almost no coins, and a turn after "Skip to tomorrow". Every turn showed the same 11 steps in order. Screenshots of steps 4, 5, 6, 9 and 11 (and a greyed step 4) are in `docs/isles-screens/turn-steps/`.

**Untested:** the live server function (unchanged, still not deployed).

### Race questions during the race: results, 2 Nov 2026

James thought a race would be more fun if the questions came during it, not all at the start. **Now the boats sail a stretch, stop, a question pops up, and a right answer is a gust of wind on the next stretch.** Races stay on My island, between turns, so the 11 turn steps didn't change.

**How it plays:**
- **Start:** both boats on the start line, Pip's one line, and **Set sail!**
- **Stretches:** the boats bob along to each stop (a quarter, a half, three quarters of the way; in general stop k is at k / (questions + 1)). The heading says "Sky Race: stretch 2 of 4" and gets focus each time.
- **At each stop:** "Race question 1 of 3" in the usual question box, with the race behind it. Right: "A gust for your boat!", Pip cheers ("Whoosh! A gust fills your sails!"), a "whoosh!" on your boat and a surge on the next stretch. Wrong: "No gust this time, keep sailing!" and your boat carries on at its usual speed.
- **The last stretch** comes with the result, then the working, as before.
- **Leaving mid-race:** coming back shows the boats at the stop before the stretch still to sail, "Welcome back!", and **Sail on!**; then the same question as before. One open race at a time, as before; it can't be thrown away.
- **Reduced motion:** each stretch jumps to its stop, and the boats don't bob.
- A screen reader hears who's ahead at each stop ("Your boat is ahead.").
- Fixed on the way: a lost race said "You still get 0 coins"; it now says 5, which is what the island gets.

**Keeping it fair (`shared/isles/race.ts`):**
- **The winner and the prize are worked out exactly as before:** the same speeds from the same random numbers, so the same chances. Checked against the old code on 20,000 seeds × 0–3 right answers × both kinds of race: every winner and every speed the same. The simulator gives the same table as before: about 1 in 6 wins with no right answers. The starter race still can't be lost (test 6, 1,000 seeds).
- **Each gust blows on the stretch straight after its question, only if that question was right.** Which questions were right moves the gusts; how many were right decides the race.
- **What's shown up to a stop never depends on a later answer.** Positions up to the last stop are distances on a course whose length is fixed at the start: as far as either boat could possibly go (the challenger with every gust). Those distances only use what's known before any answer (boats, sails, happiness, luck) and the gusts already earned. On the last stretch, when every answer is known, the course shrinks smoothly to the winner's distance, so the winner reaches the finish line and no boat ever moves backwards. With few right answers this shows as a sprint for both boats on the last stretch.
- **The lead only changes hands for a reason you can see.** Both boats share the same gusty-wind pattern on each leg, and each stretch is exactly a quarter of each boat's steady speed. So between any two points the gap moves only towards the boat with the higher steady speed, or towards you when a gust blows. The leader can be caught by a boat that has been closing in all race, or passed by your gust, but never overtaken out of nowhere. I chose this over keeping each boat's own random wobble (which let the lead swap back and forth for no reason) because that wobble could show you ahead at the last stop and then lose with nothing to explain it. The bobbing you see is now a gentle up-and-down on screen.
- **The starter race:** the Gull Riders keep their share (86–96%) of your steady speed on the way and catch up that share of your gusts on the last stretch, so they are always just behind you and it still looks close.

**Server (`shared/isles/server.ts`):** `raceStart` (and `load`, for an open race) sends the race so far, up to the first stop (`soFar`). Each `raceAnswer` reply adds the next stretch (after the last question it stays at the last stop). `raceFinish` sends the last stretch with the result, as before. Questions are answered in order: question 2 is refused ("Answer the race questions in order.") until question 1 is marked. An answer sent twice is marked once: the second reply gives the first mark and the same stretch, with `already`. Nothing is stored to say how far a race has got: it comes from the marked answers, which can't change, so **the migration didn't change** (no database test needed) and there is no new column. For S.4's classmate races nothing more is needed: the challenged island answers nothing, gets its home wind, and loses nothing, exactly as now.

**What the browser could learn:** the stretch shown before question 1 tells a curious pupil roughly how fast the Gull Riders are this race (their luck). It can't change anything: the questions still decide the gusts, and the server still decides the result.

**Tests:** still 6 of 8.
- Test 3 now checks: each stretch comes from the server, in order, and each reply keeps what was shown before; question 2 can't be answered before question 1; an answer sent again (even with the right answer) changes nothing; coming back mid-race gets the same stretches; the finished race starts with exactly the stretches shown; gusts are on the legs after questions 1 and 3 when only those were right.
- The rules tests (5 and 6) gained a check over 150 pairs of boats × all 8 ways of answering × both kinds of race: the winner and speeds depend only on how many were right, gusts are only after right answers, nobody goes backwards, the winner reaches the finish, the lead only changes as described above, and what's shown after each answer is the start of the finished race whatever comes later. Test 6 also checks the Gull Riders are never ahead in the starter race. No expected numbers changed.
- Test 7 now races by keyboard with reduced motion: focus on the start heading, Set sail!, each stretch's heading, three questions, "No gust this time, keep sailing!", and the result. (Its trial backend now uses a seeded random instead of one fixed number, because the fixed number gave the turn's and the race's question sets the same id.)

**Played in the preview** (headless Chrome, `scripts/isles-race/play-three-races.mjs`, at 1366×640 and 844×390): every answer right (the starter race: won, 30 coins and 5 goods), every answer wrong (lost, 5 coins), and leaving after question 1 and coming back (carried on from the first stop with "Sail on!", the same question 2, then won). Screenshots are in `docs/isles-screens/race-steps/`.

**Untested:** the live server function (changed, not deployed).

### S.L so far (style try-outs), 1 Nov 2026

**Painted:** 10 styles × 3 test pictures (island, class sky, Sky Race) × 2 tries = 60 pictures, on the gaming PC with `scripts/isles-style-art.py`. About 25 seconds each.
- The tries are in `~/isles-art-inbox/styles/` on James's Mac, outside the repo.
- Side-by-side page (private): https://claude.ai/artifact/ULgc79JgvwemsydB8Qs2U8

**Checked:** a helper checked every picture. Nothing unsuitable for children was found.

**Claude's top 3:**
- **Papercut:** the most distinctive, and builds up piece by piece well.
- **Cosy 3D:** the chunkiest island for a growing game piece. The races need tidying.
- **Bright fantasy:** the most polished, but close to Kingdom Keeper's animated-film look.

**Waiting:** James chooses the style. Then write `docs/ISLES-ART-PLAN.md`.

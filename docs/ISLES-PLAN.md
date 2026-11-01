# Sky Isles: plan

*An original kingdom-building game for School Games Hub, in the BBS "empire game" genre. Asked for by James on 1 November 2026, after we read [Immortal Barons](https://github.com/andy5995/immortal-barons) together. Written from that reading, `docs/GAME_DEVELOPMENT_GUIDE.md` (main `92735a2`) and the other games' plans. Branch `isles`, worktree `~/games-hub-isles`.*

**Status: PLAN ONLY. Nothing is built.** Every choice marked **(chosen)** was made for James. He can change any of them, and most are cheap to change until stage S.2. The working name "Sky Isles" (id `isles`, CSS prefix `.si-`) is one of them.

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

- You keep a **small floating island** in a sky shared by your class. You start with 8 plots of land. Each day the wind brings new chunks of land drifting past, and you can anchor them to grow your island.
- **Six turns a day (chosen).** Each turn: answer the sky pilot's question, collect what your island made, feed your people, then spend: anchor land, build, set your tax, trade. About 2 minutes a turn, so a lesson's six turns fit 10 to 15 minutes.
- **Six kinds of plot (chosen):**
  - Farms make food.
  - Mines make coins steadily.
  - Docks make more coins when your people are happy.
  - Houses hold people.
  - Workshops build sky-boats and goods.
  - Libraries make ideas that unlock upgrades.
  The choices are what to build, how high to set your tax, and whether to grow now or save.
- **The big goal:** grow your island to **Grand Isle** (40 plots) and build its **Sky Lighthouse** in four stages, inside one 5-week season.
- **Classmates:**
  - **Sky Races:** challenge a classmate's island. The winner gets a free chunk of land from the wild sky, and the other side gets a small gift of coins. Nobody loses anything.
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
- 8 plots: 2 Farms, 2 Houses, 1 Mine, 1 Dock, 1 Workshop, 1 empty.
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
5. **Spend** (any order, as much as the coins allow):
   - **Anchor a chunk.** Only from today's drift (a set number of chunks a day per island). The price rises with island size, which slows the biggest islands and lets small ones catch up.
   - **Build or change a plot.** A fixed price each, more for a Library.
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
| Tall Houses | 6 | Houses hold more people |
| Bright Docks | 6 | Docks earn more at every happiness level |
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
- **Their speed** comes from boats they keep home. They don't need to be online.
- **Winner:** a free chunk from the wild sky (outside the daily drift) and race points.
- **The other island** gets a small "well raced" gift of coins. **Nobody ever loses land, boats or anything else** **(chosen)**.
- **Limits (chosen):**
  - One race a turn, and at most 2 a day.
  - Never the same classmate twice in a day.
  - An island can be challenged at most 3 times a day.
  - Islands in their calm start can't be challenged (section 6).
- **When no classmate is free,** the **Gull Riders**, a computer crew, are always there to race.
- **The server decides the result** from the race's seed and the marked answers.
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

- **Good news only:** "Ana's island reached 20 plots!", "Rawiri won a Sky Race against the Gull Riders", "Storm over the east sky, Wind Walls held."
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

- **The goal:** **Grand Isle** means 40 plots, then the **Sky Lighthouse** in 4 stages (each costs coins and goods). A lit Lighthouse shines on everyone's sky map for the rest of the season.
- **Pace:** the simulator should show a pupil who plays 3 to 4 days a week (about 18 to 24 turns a week) reaching Grand Isle around week 4 and lighting the Lighthouse in week 5. A pupil who plays every day gets there in week 3 or 4.
- **After the goal:**
  - Keep growing, past 40 plots, for island worth.
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
  - Chunks are cheap for small islands, because the price follows island size.
  - Small islands get one extra chunk in the drift while they are under half the class's median size **(chosen)**.

### 6.3 A set number of moves a day: yes, 6 turns

- **Why:** more turns means more land. A pupil playing every night at home would leave the class behind, and the game is meant to be a little each day across a season.
- **Maths still gets practised:** races, plus the hub's other games.
- **Counted on the server,** which refuses a seventh turn. Days roll over at New Zealand midnight (`nzDate`).
- **When turns run out:** "Your island is resting. See you tomorrow!" The pupil can still look around, trade at the market and manage ropes.
- **Home page "Left today" chip:** needs an in-place edit to `my_moves_left()`. That is a shared function, so it's its own small step later. **Question for James.**

### 6.4 Progress bars

- **In the game:**
  - The **road to Grand Isle**: plots from 8 to 40, then the 4 Lighthouse stages.
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
| Grand Isle | Grow your island to 40 plots | `grand_isles` ≥ 1 | About half, by the season's end |
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
| Opens the game | Shows an island and 6 kinds of plot | Too much at once | The guided first go shows one thing at a time. Plot names have pictures. |
| First question | The sky pilot asks a sum | "Why am I doing maths?" | Pip: "Get it right for a fair wind: everything grows more this turn!" |
| Collect | Numbers pop up | Doesn't know where they came from | Each number sits on its plot, then they add up in a sum line. |
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
- **Next-step line, always there.** One sentence with real names and numbers ("Your food runs out in 2 turns: build a Farm on your empty plot"), worked out fresh by a pure function `nextStep(island)`, with a "Show me" button that lights up the button it means.
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
1. **My island.** The island picture with its plots, and the resource bar: coins, food, people, happiness, ideas, boats. The next-step line and the turn pips are here. Tapping a plot builds or changes it.
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
  - Every plot type is painted at each of its upgrade levels.
  - The island is painted as layered pieces (base rock, plots, buildings, sky-boats), so it can grow plot by plot.
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

**Migration `20261101000100_isles.sql`** (next free number on 1 Nov 2026; check again at go-live). New tables, all prefixed `isles_`, RLS on, pupils read only through `my_isles()` and `isles_sky()` (own class only, via `my_school()` and class membership):

| Table | Holds |
|---|---|
| `isles_islands` | One per pupil per season: plots, resources, upgrades, seed, turns used today, guide state |
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
- **Coins limit growth, not the drift.** Chunks cost 22 × plots, so the drift of 3 a day rarely runs out. That makes choices and maths matter: with the first guesses everyone reached Grand Isle on the same day, whatever they did.
- **Houses rebalanced.** Houses now hold 30 people and tax is per 2 people at Fair. Before, a House plus its Farm earned less than two Mines.
- **Upgrades are ×1.5,** so a Library is worth building.
- **Fair wind is ×1.15,** so all-wrong maths still reaches Grand Isle (week 3 for a daily player), just a little later.
- **The Lighthouse costs 3,350 coins and 70 goods in all.**

**Decisions:**
- Fog takes half of the turn's Dock coins (the plan said Docks earn half; same thing, done at the end of the turn).
- An impossible choice refuses the whole turn, and the turn isn't used.
- **A pupil who plays 1 day a week doesn't reach Grand Isle** (about 20 plots). The small-island extra chunk and the saved turns help in a real class, but the simulator doesn't model them. Worth a look in S.4, once classmates are in the simulator.

**Open for later stages:**
- **Coins pile up for daily players after the Lighthouse is lit** (about 30,000 by season's end). It needs something worth spending on after the goal: gifts to roped friends, or island decorations that show on the sky map. To decide in S.4.
- **High tax plus land-grabbing** is slightly the fastest route to the Lighthouse for a 3-day player. Fine as a trade-off for now (it gives fewer people and lower worth). Watch it.
- Races are only modelled in the simulator (an even chance, 1 prize chunk a day). The real race rules come in S.1.

**Tests:** none yet (tests 5 and 6 come with S.1). The engine type-checks.

**Untested:** everything in the browser and on the server (not built yet).

### S.L so far (style try-outs), 1 Nov 2026

**Painted:** 10 styles × 3 test pictures (island, class sky, Sky Race) × 2 tries = 60 pictures, on the gaming PC with `scripts/isles-style-art.py`. About 25 seconds each.
- The tries are in `~/isles-art-inbox/styles/` on James's Mac, outside the repo.
- Side-by-side page (private): https://claude.ai/artifact/ULgc79JgvwemsydB8Qs2U8

**Checked:** a helper checked every picture. Nothing unsuitable for children was found.

**Claude's top 3:**
- **Papercut:** the most distinctive, and builds up plot by plot well.
- **Cosy 3D:** the chunkiest island for a growing game piece. The races need tidying.
- **Bright fantasy:** the most polished, but close to Kingdom Keeper's animated-film look.

**Waiting:** James chooses the style. Then write `docs/ISLES-ART-PLAN.md`.

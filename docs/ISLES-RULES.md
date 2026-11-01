# Sky Isles: rule sheet

*The rules as built in `shared/isles/` (`engine.ts` the turn, `race.ts` Sky Races, `nextStep.ts` Pip's next step). Every number comes from `shared/isles/config.ts` (this sheet copies them as of stage S.1, 2 Nov 2026; the config wins if they ever differ). It's an original game: none of the rules or numbers come from Immortal Barons or Barren Realms Elite. Plan: [ISLES-PLAN.md](ISLES-PLAN.md).*

## A new island

**At the start of each season:**
- 6 building spots: Farm, House, Mine, Farm, Dock and 1 empty spot. Spots are kept in the order they were claimed.
- Every building starts at level 1.
- 150 coins, 60 food, 30 people, happiness 70, 2 sky-boats.
- Tax is Fair, and half the workshops' work goes to sky-boats.

## Each day

- **6 turns a day.** Unused turns pile up to 18, so a pupil who misses two days can catch up.
- **The drift:** the wind brings **1 chunk** of land past each island a day. Each chunk is one new building spot.
  - Unused chunks wait, up to 3.
  - Star Map adds one a day and lets 4 wait.
  - An island under 0.7 of its class's middle size gets one extra.
- **One festival a day.**
- Days start at New Zealand midnight.

## A turn, in order

### 1. The sky pilot's question

A right answer gives a **fair wind**: everything collected this turn is ×1.15. A wrong answer changes nothing else.

### 2. Collect

Every amount is for a level 1 building. A level 2 building makes twice as much, and a level 3 building three times.

| Building | Each turn (level 1) |
|---|---|
| Farm | 10 food (15 with Better Ploughs) |
| Mine | 6 coins, always |
| Dock | 2 coins, plus up to 10 more with happiness: 9 at happiness 70, 12 at 100. Welcome Lanterns ×1.5 |
| House | Room for 30 people (45 with Bunk Beds). Every other spot has room for 2 |
| Workshop | 10 work. A sky-boat takes 30 work and one goods takes 10. The boat/goods slider sets the split (0, 25, 50, 75 or 100% to boats) |
| Library | Half an idea |

**Tax:** people ÷ 3 at Low, ÷ 2 at Fair, ÷ 1.5 at High, in coins.

### 3. Feed

- **Each person eats half a food.** One level 1 Farm feeds 20 people.
- **Not enough food:**
  - Half of the hungry people leave to stay with a neighbour.
  - Happiness drops 12.

### 4. Spend

Any order, as many as the coins allow. Each choice is checked against the island as it is at that moment.

| Choice | Cost |
|---|---|
| Anchor a chunk (from the drift) | 85 coins × spots the island already has (510 at 6 spots, 1,275 at 15) |
| Build on a spot, or change what is there (starts again at level 1) | Farm 25, House 25, Mine 30, Dock 30, Workshop 35, Library 50 |
| Raise a building one level | To level 2: the build price × 4. To level 3: the build price × 9 plus 6 goods |
| Tax: Low, Fair or High | Free |
| Boat/goods slider | Free |
| Festival (once a day) | 40 coins: +15 happiness |
| Upgrade | Ideas (below) |
| A Sky Lighthouse stage (at Grand Isle) | 600 coins and 10 goods, then 750 and 15, 900 and 20, 1,100 and 25 |
| Sell at the class market | Food 2, goods 6 coins each (the server moves today's prices) |
| Buy at the class market | 1.5 × the price, rounded up |

### 5. End of the turn

- **Food that goes off:** food over the store goes off at a tenth a turn (half that with Cool Cellars). The store is 40 plus 20 for each Farm level, doubled with Cool Cellars.
- **Happiness** moves a fifth of the way towards its resting point: 90 at Low tax, 70 at Fair, 40 at High.
- **People arriving:** while there is room, people arrive. Each turn they move 15% of the way to the room there is, scaled by happiness (×0.5 at 0, ×1.5 at 100), halved at High tax. At least 1 arrives while happiness is 30 or more.
- **People leaving:**
  - Over the room, a tenth of the extra leave.
  - Under happiness 30, 5% leave each turn.
- **Weather,** about 1 turn in 8:

| Weather | What it does |
|---|---|
| Rainbow | +15 food |
| Golden geese | +25 coins |
| Fog | Half this turn's Dock coins lost |
| Storm | A tenth of the food blown away (nothing with a Wind Wall) |
| Warm breeze | +10 happiness |
| Lost traveller | +3 people |

Weather never takes land or boats.

**One impossible choice refuses the whole turn,** and the turn isn't used.

## Upgrades

| Upgrade | Ideas | Does |
|---|---|---|
| Better Ploughs | 4 | Farms ×1.5 food |
| Cool Cellars | 4 | Store doubled, food goes off half as fast |
| Bunk Beds | 6 | Houses ×1.5 room |
| Welcome Lanterns | 6 | Docks ×1.5 coins |
| Wind Wall | 6 | Storms blow nothing away |
| Swift Sails | 8 | Faster sky-boats in races (+3 speed) |
| Sky Bridge | 8 | Friendship ropes give twice the bonus (S.4) |
| Star Map | 10 | One more chunk in the daily drift |

## The goal

- **Grand Isle:** 16 building spots.
- **Then the Sky Lighthouse:** 4 stages (costs above).
- **Island worth,** for the Hall of the Skies: 10 a spot, 5 a building level, 1 a person, 15 an upgrade, 50 a Lighthouse stage. Never anything about maths.

## Sky Races

**Who and when:**
- Race a classmate's island, or the **Gull Riders**, a computer crew who are always free.
- **One race a turn, 2 a day.** A race needs a turn left today.
- Never the same classmate twice in a day. An island can be challenged by classmates **3 times a day** (the Gull Riders don't count).
- An island in its **calm start** (fewer than 12 turns played, about its first 2 days) can't be challenged by classmates. It can still race the Gull Riders.

**The race:**
- The challenger answers **3 questions**. Each right answer is a **gust**: +5 speed.
- Each boat's speed is 30, plus:
  - sky-boats: 3 × the square root of the boats (up to 16 boats), so 2 boats give 4.2, 9 boats 9 and 16 boats 12. A big fleet helps less and less.
  - Swift Sails: +3.
  - happiness: up to +4 (happiness ÷ 25).
  - wind: the challenger's gusts. The other side (an island at home, or the Gull Riders) gets a **home wind** of +5, one gust's worth.
  - luck: from 0 up to 12, each side.
- The faster boat wins. A tie goes to the challenger.
- **The Gull Riders** bring the same boats and Swift Sails as the challenger, with happiness 70. So a race against them is decided by the gusts and a little luck: about 1 in 6 with no answers right (James, 2 Nov 2026), half with 1, 5 in 6 with 2, and nearly always with 3.
- **A small island can win.** A new island (2 boats) against a big one (14 boats and Swift Sails) wins about 1 race in 7 with 2 answers right and almost half with all 3 right.
- **The result comes only from the race's seed, the two boats (taken when the race starts) and the answers the server marked right.** The browser can't change it.
- The animation is 8 legs long. The boats bob ahead and behind on the way, and each gust blows on its own leg (legs 2, 4 and 6).

**The first race** (turn 2's guide) is against the Gull Riders and **can't be lost**, whatever the answers: they take it easy and finish between 86% and 96% of the way, so it still looks close.

**Prizes. Nobody ever loses anything.**
- The winner: the day's first win brings **30 coins and 5 goods** (goods help raise buildings to level 3). A later win brings **15 coins**. No free land.
- The other side gets a **"well raced" gift of 5 coins**, win or lose.
- A classmate who wins at home gets the win counted (for Race Winner), but no prize.

## Pip's next step

One short sentence with real names and numbers, and the button it means (for "Show me"). The first that fits wins:
1. No turns left: "Your island is resting. See you tomorrow!"
2. Food runs out in 3 turns or fewer: build a Farm on an empty spot, raise a Farm, or buy food at the market.
3. The island is full (room for 2 more or fewer): build or raise a House.
4. An empty spot, and coins to build on it: what to build (Farm if food is tight, House if it's full, then a Library, a Workshop, then a Dock or Mine).
5. An upgrade ready (the cheapest first), with what it does.
6. A Sky Lighthouse stage the island can pay for.
7. A chunk in the drift the island can pay for (not while a Lighthouse stage is still to build).
8. A building worth raising (cheapest first, money-makers first), as long as it leaves at least half the price of the next chunk or Lighthouse stage.
9. No race yet today: try a Sky Race.
10. Saving up: for the next Lighthouse stage, a building on the empty spot, or the chunk in the drift, with the numbers.
11. Otherwise: press End turn.

## Pace (from `npm run isles:sim -- --runs 300`, stage S.1, 2 Nov 2026)

Median day reached in a 35-day season. The pretend pupil plays 6 turns a play day, builds sensibly, and races the Gull Riders twice a play day with the real race rules (their race questions right as often as their turn questions).

| Pupil | Maths right | Grand Isle | Lighthouse lit |
|---|---|---|---|
| Every school day | 100% | day 15 (week 3) | day 19 (week 3), nearly all |
| Every school day | 70% | day 16 (week 3) | day 22 (week 4), nearly all |
| Every school day | 0% | day 17 (week 3) | day 25 (week 4), about a quarter |
| 3 days a week | 100% | day 24 (week 4) | day 33 (week 5), nearly all |
| 3 days a week | 70% | day 26 (week 4) | day 33 (week 5), about half |
| 3 days a week | 0% | day 29 (week 5) | not lit |
| 1 day a week | any | not reached (about 8 or 9 spots) | no |

**What changed with real races (S.1):** Grand Isle days didn't move. The Lighthouse did, because race wins bring goods: pupils who get race questions right light it sooner (a 3-days-a-week pupil with all right: under half lit before, nearly all now), and pupils who get them all wrong win about 1 race in 6 and light it less often (every day, all wrong: about half lit before, about a quarter now).

**What the simulator also shows:**
- **Building levels matter.** A pupil who only grabs land is a week or more behind one who raises buildings. With all maths wrong, a pure grabber doesn't reach Grand Isle on 3 days a week.
- **High tax is a real trade-off.** Greedy (High tax) pupils light the Lighthouse soonest but have fewer people.
- **Coins still pile up after the Lighthouse.** A known issue, to look at in S.4.

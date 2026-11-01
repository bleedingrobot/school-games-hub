# Sky Isles: rule sheet

*The rules as built in `shared/isles/engine.ts`. Every number comes from `shared/isles/config.ts` (this sheet copies them as of stage S.0, 1 Nov 2026; the config wins if they ever differ). It's an original game: none of the rules or numbers come from Immortal Barons or Barren Realms Elite. Plan: [ISLES-PLAN.md](ISLES-PLAN.md).*

## A new island

**At the start of each season:**
- 8 plots: 2 Farms, 1 Mine, 1 Dock, 2 Houses, 1 Workshop and 1 empty plot.
- 150 coins, 60 food, 30 people, happiness 70, 2 sky-boats.
- Tax is Fair, and half the workshops' work goes to sky-boats.

## Each day

- **6 turns a day.** Unused turns pile up to 18, so a pupil who misses two days can catch up.
- **The drift:** the wind brings **3 chunks** of land past each island a day.
  - Star Map adds one more.
  - An island under half its class's middle size gets one more.
- **One festival a day.**
- Days start at New Zealand midnight.

## A turn, in order

### 1. The sky pilot's question

A right answer gives a **fair wind**: everything collected this turn is ×1.15. A wrong answer changes nothing else.

### 2. Collect

| Plot | Each turn |
|---|---|
| Farm | 10 food (15 with Better Ploughs) |
| Mine | 6 coins, always |
| Dock | 2 coins, plus up to 10 more with happiness: 9 at happiness 70, 12 at 100. Bright Docks ×1.5 |
| House | Room for 30 people (45 with Tall Houses). Every other plot has room for 2 |
| Workshop | 10 work. A sky-boat takes 30 work and one goods takes 10. The boat/goods slider sets the split (0, 25, 50, 75 or 100% to boats) |
| Library | Half an idea |

**Tax:** people ÷ 3 at Low, ÷ 2 at Fair, ÷ 1.5 at High, in coins.

### 3. Feed

- **Each person eats half a food.** One Farm feeds 20 people.
- **Not enough food:**
  - Half of the hungry people leave to stay with a neighbour.
  - Happiness drops 12.

### 4. Spend

Any order, as many as the coins allow. Each choice is checked against the island as it is at that moment.

| Choice | Cost |
|---|---|
| Anchor a chunk (from today's drift) | 22 coins × plots the island already has (176 at 8 plots, 858 at 39) |
| Build on a plot, or change one | Farm 25, House 25, Mine 30, Dock 30, Workshop 35, Library 50 |
| Tax: Low, Fair or High | Free |
| Boat/goods slider | Free |
| Festival (once a day) | 40 coins: +15 happiness |
| Upgrade | Ideas (below) |
| A Sky Lighthouse stage (at Grand Isle) | 600 coins and 10 goods, then 750 and 15, 900 and 20, 1,100 and 25 |
| Sell at the class market | Food 2, goods 6 coins each (the server moves today's prices) |
| Buy at the class market | 1.5 × the price, rounded up |

### 5. End of the turn

- **Food that goes off:** food over the store goes off at a tenth a turn (half that with Cool Cellars). The store is 40 plus 20 a Farm, doubled with Cool Cellars.
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
| Tall Houses | 6 | Houses ×1.5 room |
| Bright Docks | 6 | Docks ×1.5 coins |
| Wind Wall | 6 | Storms blow nothing away |
| Swift Sails | 8 | Faster sky-boats in races (S.1) |
| Sky Bridge | 8 | Friendship ropes give twice the bonus (S.4) |
| Star Map | 10 | One more chunk in the daily drift |

## The goal

- **Grand Isle:** 40 plots.
- **Then the Sky Lighthouse:** 4 stages (costs above).
- **Island worth,** for the Hall of the Skies: 10 a plot, 1 a person, 15 an upgrade, 50 a Lighthouse stage. Never anything about maths.

## Sky Races (rules for the race itself come in stage S.1)

- **2 races a day.**
- **Prizes:** the first win of the day brings a free chunk of land. Later wins bring coins.
- **The other side never loses anything.**

## Pace (from `npm run isles:sim -- --runs 200`, 1 Nov 2026)

Median day reached in a 35-day season. The pretend pupil plays 6 turns a play day and builds sensibly.

| Pupil | Maths right | Grand Isle | Lighthouse lit |
|---|---|---|---|
| Every school day | 100% | day 15 (week 3) | day 19, all |
| Every school day | 70% | day 16 (week 3) | day 24, all |
| Every school day | 0% | day 17 (week 3) | day 26, most |
| 3 days a week | 100% | day 24 (week 4) | day 33, about half |
| 3 days a week | 70% | day 26 (week 4) | day 33, a few |
| 3 days a week | 0% | day 29 (week 5) | rarely |
| 1 day a week | any | not reached (about 20 plots) | no |

**What the simulator also shows:**
- **Building matters.** A pupil who builds Libraries and gets upgrades does better than one who only grabs land.
- **High tax is a real trade-off.** High tax gives fewer people (and a lower island worth) but more coins for the Lighthouse.
- **Grabbing hurts.** A pupil who spends every coin on land, with every question wrong, goes hungry in 1 turn in 5.

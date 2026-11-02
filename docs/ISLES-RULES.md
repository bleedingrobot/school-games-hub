# Sky Isles: rule sheet

*The cosy rules as built in `shared/isles/` (`engine.ts` the turn, `race.ts` Sky Races, `nextStep.ts` Pip's next step). Every number comes from `shared/isles/config.ts` (this sheet copies them as of stage C.1, 3 Nov 2026; the config wins if they ever differ). Plan: [ISLES-COSY-PLAN.md](ISLES-COSY-PLAN.md), which changes [ISLES-PLAN.md](ISLES-PLAN.md). It's an original game: none of the rules or numbers come from Immortal Barons or Barren Realms Elite.*

**Nothing ever goes wrong.** There's no food, hunger, tax or happiness, nobody leaves, and the weather is only ever good.

## A new island

**At the start of each season:**
- 6 building spots: Farm, House, Mine, Farm, Dock and 1 empty spot. Spots are kept in the order they were claimed.
- Every building starts at level 1.
- 150 coins, 20 islanders, 0 sky crystals.

## Each day

- **6 turns a day.** Unused turns pile up to 18, so a pupil who misses two days can catch up.
- **The drift:** the wind brings **1 chunk** of land past each island a day. Each chunk is one new building spot.
  - Unused chunks wait, up to 3.
  - The Star telescope adds one a day and lets 4 wait.
  - An island under 0.7 of its class's middle size gets one extra.
- Days start at New Zealand midnight.

## A turn: 4 steps

### 1. The sky pilot's question

A right answer gives a **fair wind**: everything collected this turn is ×1.15. A wrong answer shows the right one and changes nothing else.

### 2. Collect

Every amount is for a level 1 building. A level 2 building makes twice as much, and a level 3 building three times.

| Building | Each turn (level 1) | Its job |
|---|---|---|
| Farm | 6 coins | Crops you can see |
| Mine | 8 coins | The steady coin-maker |
| House | 3 coins | Room for 20 islanders |
| Dock | 4 coins | One more sky-boat for races |
| Workshop | 2 coins, ¼ sky crystal | Slowly makes sky crystals |
| Library | 7 coins | A pretty building that earns well |

Sky crystals go in steps of a quarter; whole ones are shown and spent.

### 3. Build

Any order, as many as the coins allow. Each choice is checked against the island as it is at that moment.

| Choice | Cost |
|---|---|
| Anchor a chunk (from the drift) | **300 coins, always** |
| Build on a spot, or change what is there (starts again at level 1) | Farm 25, House 25, Dock 30, Mine 35, Workshop 35, Library 40 |
| Raise a building one level | To level 2: the build price × 4. To level 3: the build price × 9 plus 6 sky crystals |
| Put up a decoration on a free decoration place | Its price (below) |
| Move a decoration to another free place, or back to the shelf | Free |
| A Sky Lighthouse stage (at Grand Isle) | 600 coins and 10 crystals, then 750 and 15, 900 and 20, 1,100 and 25 |

### 4. Race or rest

A Sky Race (if one is left today), or End turn. Then the end of the turn:
- **Islanders arrive:** while there's room, they move 15% of the way to the room there is (at least 1), twice as fast with a Welcome arch. **They never leave.** Houses have room for 20 per level, and every other spot (an empty one too) for 2.
- **Lucky weather,** about 1 turn in 8:

| Weather | Gives |
|---|---|
| Rainbow | 1 sky crystal |
| Golden geese | 25 coins |
| Lost traveller | 3 islanders |
| Warm breeze | +2 speed in the next race |

**One impossible choice refuses the whole turn,** and the turn isn't used.

## Sky-boats

2, plus 1 for every Dock level on the island. Nothing else to manage.

## Decorations

- **Decoration places:** Little island 4, Growing 6, Big 8, Large 10, Grand 12. Once the Sky Lighthouse is lit, **the sky garden** floats alongside with 20 more.
- The pretty ones can be bought as many times as there are places. The three helps can be had once each, and they work even when on the shelf. A decoration can't be sold.

| Decoration | Price | Does |
|---|---|---|
| Flower beds | 40 | Pretty |
| Picnic bench | 60 | Pretty |
| Stone lantern | 80 | Pretty |
| Cherry blossom tree | 120 | Pretty |
| Wind chimes | 150 | Pretty |
| Little bridge | 200 | Pretty |
| Fountain | 300 | Pretty |
| Hot-air balloon | 500 + 5 crystals | Pretty |
| Rainbow arch | 800 + 10 crystals | Pretty |
| Sail flags | 250 | +3 race speed |
| Welcome arch | 200 | Islanders arrive twice as fast |
| Star telescope | 600 + 5 crystals | One more chunk drifts by each day |

## The goal

- **Grand Isle:** 16 building spots.
- **Then the Sky Lighthouse:** 4 stages (costs above). Lighting it brings the sky garden.
- **Island worth,** for the Hall of the Skies: 10 a spot, 5 a building level, 1 for every 5 islanders, a tenth of each decoration's coin price, 50 a Lighthouse stage. Never anything about maths.

## Sky Races

**Who and when:**
- Race a classmate's island, or the **Gull Riders**, a computer crew who are always free.
- **One race a turn, 2 a day.** A race needs a turn left today.
- Never the same classmate twice in a day. An island can be challenged by classmates **3 times a day** (the Gull Riders don't count).
- An island in its **calm start** (fewer than 12 turns played, about its first 2 days) can't be challenged by classmates. It can still race the Gull Riders.

**The race:**
- The challenger answers **3 questions during the race**, one at each stop (a quarter, a half and three quarters of the way). Each right answer is a **gust**: +5 speed, blowing on the stretch straight after it.
- Each boat's speed is 30, plus:
  - sky-boats: 3 × the square root of the boats (up to 16 boats), so 2 boats give 4.2, 9 boats 9 and 16 boats 12. A big fleet helps less and less.
  - Sail flags: +3.
  - a warm breeze: +2 (the challenger's next race only; the race uses it up).
  - wind: the challenger's gusts. The other side (an island at home, or the Gull Riders) gets a **home wind** of +5, one gust's worth.
  - luck: from 0 up to 12, each side.
- The faster boat wins. A tie goes to the challenger.
- **The Gull Riders** bring the same boats and Sail flags as the challenger (no breeze). So a race against them is decided by the gusts and a little luck: about 1 in 6 with no answers right (James, 2 Nov 2026), half with 1, 5 in 6 with 2, and nearly always with 3.
- Happiness used to add up to +4 to both sides alike. Taking it out changed nobody's chances.
- **The result comes only from the race's seed, the two boats (taken when the race starts) and the answers the server marked right.** The browser can't change it.
- The race is 8 legs long, in 4 stretches of 2 legs; the stops come after legs 2, 4 and 6. Each gust blows on the first leg after its question. The server sends one stretch at a time, and what it has shown never depends on a later answer. A boat that hasn't quite finished never shows on the line, so a photo finish still shows the right winner.

**The first race** (turn 2's guide) is against the Gull Riders and **can't be lost**, whatever the answers.

**Prizes. Nobody ever loses anything.**
- The winner: the day's first win brings **30 coins and 5 sky crystals**. A later win brings **15 coins**.
- The other side gets a **"well raced" gift of 5 coins**, win or lose.
- A classmate who wins at home gets the win counted (for Race Winner), but no prize.

## Pip's next step

One short sentence with real names and numbers, and the button it means (for "Show me"). The first that fits wins:
1. No turns left: "Your island is resting. See you tomorrow!"
2. An empty spot and coins to build: what to build (a House when it's nearly full, then a Workshop, then a Library or Mine).
3. A chunk in the drift the island can pay for.
4. A Sky Lighthouse stage it can pay for.
5. A building worth raising (cheapest first), as long as it leaves at least half the price of the next chunk or Lighthouse stage.
6. No race yet today: try a Sky Race.
7. Coins to spare, with nothing being saved for: a decoration (helps first).
8. Saving up: for the next Lighthouse stage, a building on the empty spot, or the chunk in the drift, with the numbers.
9. Otherwise: press End turn.

## Pace (from `npm run isles:sim -- --runs 300`, stage C.1, 3 Nov 2026)

The median day reached in a 35-day season. The pretend pupil plays 6 turns a play day, builds sensibly ("balanced": raises buildings to an average of level 1.5 before grabbing land), and races the Gull Riders twice a play day, getting race questions right as often as turn questions.

| Pupil | Maths right | Grand Isle | Lighthouse lit |
|---|---|---|---|
| Every school day | 100% | day 11 (week 2) | day 17 (week 3), all |
| Every school day | 70% | day 11 (week 2) | day 18 (week 3), all |
| Every school day | 0% | day 12 (week 2) | day 19 (week 3), all |
| 3 days a week | 100% | day 19 (week 3) | day 29 (week 5), all |
| 3 days a week | 70% | day 19 (week 3) | day 31 (week 5), all |
| 3 days a week | 0% | day 22 (week 4) | day 33 (week 5), nearly all |
| 1 day a week | any | not reached (9 or 10 spots) | no |

**What the simulator shows:**
- **Every-day pupils are held back by the drift, not by coins.** One chunk a day means at least 10 days to Grand Isle, whatever the price. A dearer chunk (400) slowed them by only a few days but stopped many 3-days-a-week pupils lighting the Lighthouse, so the price stays at 300 (James, 3 Nov 2026).
- **Every-day pupils finish in week 3 and then have coins to spare** (median 4,000 to 13,000 by the season's end), even with the sky garden's 32 places full. In a cosy game that's fine; they keep racing, visiting and giving gifts.
- **Raising buildings still matters.** A pupil who only grabs land (the "grabber") reaches Grand Isle as fast but lights the Lighthouse later. On 3 days a week, most grabbers don't light it at all.
- **Maths helps without deciding.** With every answer wrong, a pupil is 1 to 3 days behind and wins about 1 race in 6.
- **1 day a week** reaches 9 or 10 spots (8 to 10 across play styles), up from 8 or 9 before.

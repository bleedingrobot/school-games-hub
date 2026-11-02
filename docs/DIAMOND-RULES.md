# Diamond Drop: the rules

*A short rule sheet. Every number here comes from `shared/diamond/config.ts`; the pace tables come from `npm run diamond:sim` (Stage 1, 2 November 2026). If a number changes in the config, change it here too.*

## Playing a level

- A claw swings at the top of the ground, from 70° left to 70° right, 60° a second. **One button: Drop.** The claw shoots straight out along its angle, grabs the first thing it touches (or reaches the edge), and reels it up.
- **Heavy things reel slowly.** Reel speed (field units a tick, 30 ticks a second): empty 24, light gems 13, medium 9, heavy 6, the Heart Diamond 4, small rock 5, big rock 3. Rocks are worth nothing.
- Each level has a **time limit** and a **gem target**. Gems' value counts towards the target and is paid as coins. Pass by banking the target before time runs out (level 10: bring up the Heart Diamond). After passing, keep digging or press Finish.
- **No game over.** Run out of time and you keep 12% of the coins and try again.
- **Mystery sacks** hold coins (55%), 5 extra seconds (30%) or a free boost for the next level (15%). **Cave crabs** (from level 6) scuttle side to side; 7 in 10 carry a gem.

## The 10 levels

| Level | Place | New gem | Time | Target |
|---|---|---|---|---|
| 1 | Grassy Topsoil | Quartz | 60 s | 15 |
| 2 | Clay Bank | Jade | 60 s | 25 |
| 3 | Old River Gravel | Amethyst | 60 s | 40 |
| 4 | Glow-worm Cave | Topaz | 70 s | 55 |
| 5 | Crystal Hollow | Emerald | 70 s | 70 |
| 6 | Underground Lake | Sapphire | 70 s | 100 |
| 7 | Fossil Seam | Ruby | 75 s | 145 |
| 8 | Hot Springs | Fire Opal | 80 s | 200 |
| 9 | Magma Edge | Star Sapphire | 80 s | 240 |
| 10 | The Diamond Heart | Heart Diamond | 90 s | catch the diamond |

Each field is made from the level's seed: that level's gems and the ones above it (rarer ones fewer, smaller and deeper), rocks, sacks and crabs. A field is only used if its gems are worth at least 1.5 times the target. On level 10 the Heart Diamond sits near the bottom with big rocks either side of a clear line down to it, at least 6 degrees of swing wide.

## Gems and Hold on!

| Gem | Value | Weight | Slip chance |
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
| Heart Diamond | 150 coins | very heavy | always, twice |

- Whether a caught gem slips, and where on the way up, comes only from the level's seed and the catch number.
- When it slips, **the clock stops** and a maths question from the pupil's own focus pops up. **Right:** the claw holds on. **Wrong:** the gem falls back into the rock 60 to 140 units further out along the claw's line, where it can be caught again.
- **At most 6 questions a level (8 on level 10).** After that nothing slips, so a pupil weaker at maths still gets every gem up, just more slowly.

## Stars

1 star for passing, 2 for passing with 15 seconds or more left (sack seconds added later don't count), 3 for that and catching every kind of gem buried on the level.

## One new level a day

- Levels already passed are always open to replay.
- The next level is open unless a new level was already passed today (New Zealand date). Tries at it are unlimited until it's passed.
- Passing a new level keeps all its coins. A replay, or a try that falls short, keeps **12%** (rounded down).

## Boosts (the next level only, at most one of each)

| Boost | Effect | Price |
|---|---|---|
| Strong Winch | everything heavier than light reels 50% faster | 20 + 10 × level |
| Lucky Charm | slip chances halved (not the Heart Diamond's) | 15 + 10 × level |
| Extra Time | 10 more seconds | 10 + 5 × level |
| Rock Blaster | the first rock grabbed turns to dust | 10 + 5 × level |

## The Claw Workshop

43 upgrades in 6 slots (claw head, rope, trail, catch effect, winch, Nugget's hat), looks only. Prices: **Common 100, Cool 250, Epic 600, Legendary 1,800** coins. Four are earned, not bought: Diamond Claw (find the Heart Diamond), Star Rope (3 stars on every level), Gem Rain Deluxe (catch every kind of gem), Miner Lamp (hold on to 10 slipping gems). The **special of the week** is 40% off (rounded to 5), chosen from the week number, never the same two weeks running. Upgrades are kept through New Season.

## New Season

Back to level 1: levels, coins, stars, the Gem Book and any free boost are cleared. Workshop upgrades, what's worn, achievement totals and the Hall are kept.

## Pace (from the simulator)

A 35-day season (25 school days), 40 bot pupils a row, 12-minute lessons. "Good" bots aim well and press within 2 ticks; "steady" within 4 and pick among their 3 best aims; "shaky" within 7 among their 6 best. Maths right: strong 90%, middling 70%, weak 45%. Half the bots save for a Legendary first; the rest pick an upgrade they like and save for that. Bots are probably steadier than real 9-year-olds, so try it with a class before trusting the tries column.

**How long the climb takes** (days a week: when they find the Heart Diamond)

| Days a week | Found the diamond | Week found (middle pupil) | School days played to get there |
|---|---|---|---|
| 2 | 99–100% of every kind of pupil | week 5 | 10 |
| 3 to 4 | 100% | week 3 | 10 |
| 5 | 100% | week 2 | 10 |

The one-new-level-a-day rule sets the pace: nearly every pupil passes each new level the day it opens, so it takes 10 play days for everyone, whatever their skill or maths.

**Tries and coins** (3 to 4 days a week)

| Pupil (aim / maths) | New levels passed in 1–3 tries | Levels a lesson | Coins earned | Upgrades bought | Owns a Legendary | Coins left at the end | Questions a level |
|---|---|---|---|---|---|---|---|
| good / strong | 100% | 12.6 | 4,972 | 9.1 | 88% | 581 | 2.1 |
| steady / middling | 100% | 9.4 | 4,037 | 7.8 | 85% | 520 | 2.7 |
| steady / weak | 100% | 8.3 | 3,636 | 6.8 | 80% | 534 | 3.3 |
| shaky / middling | 98% | 7.8 | 3,502 | 6.3 | 68% | 476 | 2.4 |
| shaky / weak | 98% | 7.4 | 3,358 | 6.0 | 63% | 410 | 2.7 |

2 days a week: about 2,200 to 3,000 coins and 3 to 6 upgrades. 5 days a week: about 4,400 to 7,200 coins and 8 to 16 upgrades. Boosts take 0 to 19% of coins (more for shaky pupils, who fail more first tries). Mean tries for each new level (steady / middling): 1.0 to 1.2 on every level.

**One try at each level** (300 fields each, middling maths): share passed

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| good | 100% | 100% | 100% | 100% | 99% | 100% | 100% | 100% | 100% | 100% |
| steady | 98% | 97% | 86% | 90% | 91% | 91% | 82% | 86% | 91% | 100% |
| shaky | 76% | 73% | 54% | 68% | 64% | 63% | 47% | 62% | 62% | 88% |

Re-run with `npm run diamond:sim` (season) and `npm run diamond:sim -- --levels 300` (single tries).

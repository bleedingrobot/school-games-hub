# Sky Isles: the cosy rework

*James, 3 Nov 2026: "simplify the game a bit, I want it just to have a cosy building feeling (keeping the maths of course). I love the races." He chose the **Cosy builder** shape and answered every question below on cards. This plan **changes** [ISLES-PLAN.md](ISLES-PLAN.md): where the two differ, this one wins. The rule sheet [ISLES-RULES.md](ISLES-RULES.md) gets rewritten in stage C.1. The old S.4 prompt (`docs/prompts/isles-s4.md`) is out of date: ropes and the market are gone.*

## 1. The feeling we want

You look after a small floating island. Every turn it makes coins, and you spend them on buildings, more land and pretty things. Little islanders move in and walk about. **Nothing ever goes wrong:** there's no hunger, nobody leaves, there's no tax and there are no storms. The maths gives you a fair wind (more coins) and gusts in races. The races stay exactly as they are.

## 2. What goes, what stays, what's new

| Goes | Stays | New |
|---|---|---|
| Food, hunger, food going off | Coins | **Sky crystals:** the special prize (from races, plus a trickle from Workshops) |
| Happiness, tax, festivals | Building spots, building levels 1 to 3 | **Islanders:** a cosy number that only goes up, shown as little walkers |
| People leaving | The daily drift of land (1 chunk a day, small islands get an extra) | **Land at one steady price** |
| Goods, the Workshop's boats/goods slider | **Sky Races, as they are now** (questions during the race, gusts, Gull Riders, nobody loses anything) | **Decorations** instead of upgrades: mostly pretty, a few with one small help |
| Ideas and the 8 upgrades | The pilot's question and fair wind | **Visit and gift:** leave a classmate a free gift once a day |
| Storms and fog | Grand Isle (16 spots), then the Sky Lighthouse (4 stages) | A **4-step turn** (was 11) |
| Friendship ropes, the class market | The news board (good news only), Pip, the Sky Keepers, all the painted art | |

## 3. The turn: 4 steps

The rule from the step-by-step work still holds: **one choice per screen**, greyed buttons say why, and the steps never change order.

1. **The sky pilot's question.** Right answer: a fair wind, so everything this turn makes is ×1.15. Wrong: shows the right answer, nothing lost.
2. **Collect.** Coins pop off each building, then add up in a sum line (the working shown, never a question). Crystals appear the same way. Islanders and lucky weather come at the end of the turn (they use the server's dice), so they're shown when the next turn starts (section 7).
3. **Build.** The island fills the screen. Tap a spot to build, raise or change it. Tap the drifting chunk to anchor it. Tap **Decorate** to open the decoration shelf. Each choice is one screen, then "Another?" (the same pattern as today's Land and Build steps). **Done building** moves on.
4. **Race or rest.** Two big buttons: **Sky Race** (if one is left today) or **End turn**. After a race, End turn.

**6 turns a day (kept),** pile up to 18. A turn should take about a minute, so a day's six take 6 to 8 minutes.

## 4. Buildings

Six kinds, levels 1 to 3, same art. Level 2 makes twice as much as level 1, and level 3 makes three times as much. **Every building makes coins** and has one simple, visible job. The numbers are a starting guess, and the simulator sets them in C.1.

| Building | Build | Each turn at level 1 | Its job |
|---|---|---|---|
| Farm | 25 | 6 coins | Crops you can see growing |
| Mine | 35 | 8 coins | The steady coin-maker |
| House | 25 | 3 coins, room for 20 islanders | Islanders move in |
| Dock | 30 | 4 coins, +1 sky-boat | More boats, so a little faster in races |
| Workshop (windmill) | 35 | 2 coins, ¼ crystal | Slowly makes sky crystals |
| Library | 40 | 7 coins | A pretty building that earns well (James: keep it as a building) |

- **Raising a building:** level 2 costs the build price × 4. Level 3 costs the build price × 9 plus 6 crystals.
- **Changing a building** starts it again at level 1.
- **A new island:** Farm, House, Mine, Farm, Dock and 1 empty spot. 150 coins, 30 islanders, 2 sky-boats, 0 crystals. That makes about 28 coins a turn, about the same as now.
- **Sky-boats** = 2 + the Dock levels on the island. The race formula is unchanged: boats count as 3 × the square root, up to 16.

## 5. Land

- **Every chunk costs the same: 300 coins** (James chose 300 over 250 on 3 Nov 2026, after the simulator).
- **The drift stays as it is:** 1 chunk a day, up to 3 waiting. An island under 0.7 of its class's middle size gets one extra. The drift sets the pace now, not the price.

## 6. Islanders

- Houses give room for 20 islanders per level, and every other spot gives room for 2.
- **Each turn, islanders move 15% of the way to the room there is (at least 1).** They never leave.
- Islanders count towards island worth, and a few little walkers stroll the paths on My island (more islanders, more walkers, up to about 8). Until their art is painted, they're small drawn-in-code figures.
- Islanders don't eat and don't pay tax. They're there for the cosy feeling, and they give each House a reason to exist.

## 7. Lucky weather (good only)

About 1 turn in 8, one of:

| Weather | Gives |
|---|---|
| Rainbow | 1 sky crystal |
| Golden geese | 25 coins |
| Lost traveller | 3 islanders |
| Warm breeze | Your next race gets a head start of +2 speed (shown on the race screen) |

Storm and fog are gone, and so is the Wind Wall.

## 8. Decorations (instead of upgrades)

- **Bought with coins** (the dearer ones also take crystals) in step 3, then put on one of the island's **decoration places**. These are spots around the edges and along the paths, kept separate from the building clearings. Each base gets its own places, set by hand in code with no repainting: Little 4, Growing 6, Big 8, Large 10, Grand 12.
- **The sky garden (James, 3 Nov 2026):** once the Lighthouse is lit, a little garden island floats alongside with 20 more decoration places, so every-day pupils who finish in week 3 still have something to make prettier.
- **They add island worth,** show on My island, and show on the class sky and when a classmate visits.
- **They give pupils something to spend on once the Lighthouse is lit,** which fixes the coins-piling-up problem from S.0.
- **Mostly just pretty. A few have one small help (James).** A first list for the simulator and art to work from:

| Decoration | Price | Does |
|---|---|---|
| Flower beds | 40 | Pretty |
| Picnic bench | 60 | Pretty |
| Stone lantern | 80 | Pretty |
| Cherry blossom tree | 120 | Pretty |
| Wind chimes | 150 | Pretty |
| Little bridge | 200 | Pretty |
| Fountain | 300 | Pretty |
| Hot-air balloon (tethered) | 500 + 5 crystals | Pretty |
| Rainbow arch | 800 + 10 crystals | Pretty |
| **Sail flags** | 250 | **+3 race speed** (was Swift Sails). One per island |
| **Welcome arch** | 200 | **Islanders arrive twice as fast.** One per island |
| **Star telescope** | 600 + 5 crystals | **One more chunk drifts by each day** (was Star Map). One per island |

The pretty ones can be bought more than once, up to the island's decoration places. A decoration can be moved or put back in the shelf for free, but never sold.

## 9. Sky crystals, the goal and the pace

- **Where crystals come from:**
  - the day's first race win: 5;
  - every Workshop: ¼ a turn per level;
  - a rainbow: 1.
- **What they're for:** raising a building to level 3, the Sky Lighthouse, and a few decorations.
- **The goal is unchanged:** Grand Isle (16 spots), then the Sky Lighthouse in 4 stages. The stages cost coins and crystals, with the same coin prices as now (600, 750, 900, 1,100) and crystals in place of goods (10, 15, 20, 25).
- **Island worth:** 10 a spot, 5 a building level, 1 for every 5 islanders, the decorations' worth (a tenth of the coin price), and 50 a Lighthouse stage. Never anything about maths.
- **Pace target (unchanged from ISLES-PLAN 6.1):**
  - A pupil who plays 3 to 4 days a week reaches Grand Isle around week 4 and lights the Lighthouse in week 5.
  - An every-day pupil gets there in week 3 or 4.
  - A pupil who gets every question wrong still gets there, a little later.
  - **New check:** a 1-day-a-week pupil should reach at least 10 spots. The steady land price and the small-island extra should help, and the simulator says.

## 10. Races (unchanged, two small tidy-ups)

- Everything in ISLES-RULES "Sky Races" stays: 3 questions during the race, gusts, the home wind, luck, the 1-in-6 chance with no answers right, the starter race that can't be lost, 2 races a day, the challenge limits, the calm start, nobody losing anything.
- **Happiness speed goes,** with nothing in its place. It gave both sides about the same amount, so nobody's chances move (the simulator still shows about 1 win in 6 with no answers right).
- **Swift Sails** becomes the Sail flags decoration (+3, the same as before).
- **The prize:** the first win of the day brings 30 coins and 5 crystals (goods become crystals). A later win brings 15 coins. "Well raced" brings 5 coins.
- **Warm breeze** adds +2 to your next race (section 7).

## 11. Classmates

- **Sky Races** against classmates' islands, as planned (stage S.4).
- **The class sky:** classmates' islands with their name, Sky Keeper, size and decorations. It shows who can be raced now (and why not), and has a **Visit** button.
- **Visit and gift (James: free to give, once a day):**
  - Visiting shows a classmate's island, look only. You see the buildings, decorations and islanders, never their coins or maths.
  - **Leave a gift:** pick one of 3 pictures (a bunch of flowers, a cake, a paper lantern). Each gives them **10 coins**. It costs you nothing.
  - You can send 1 gift a day. An island can receive up to 3 a day.
  - It works even when you have no turns left. The receiver sees "Ana left you a cake! +10 coins" next time they load.
- **The news board:** good news only, read on `load`, never polled. For example: "Ana's island reached 12 spots!", "Rawiri won a Sky Race against the Gull Riders", "Mere put up a fountain", "Tama lit the Sky Lighthouse!" It never says who lost or anything about maths.
- **Gone:** friendship ropes and the class market.

## 12. Achievements (changes to ISLES-PLAN 6.5)

| Name | What for | Measure |
|---|---|---|
| First Anchor | Anchor your first chunk of land | kept |
| Green Thumbs | Build 5 Farms on one island | kept |
| **Busy Village** (was Happy Isle) | 100 islanders on your island | `most_islanders` ≥ 100 |
| **Decorator** (was Bookworm) | Put up 8 decorations | `decorations_season_best` ≥ 8 |
| Race Winner | Win a Sky Race | kept |
| **Kind Heart** (was True Friend) | Send 10 gifts | `gifts_sent` ≥ 10 |
| Grand Isle | Grow your island to 16 building spots | kept |
| Lighthouse Keeper | Light the Sky Lighthouse | kept |

Points are unchanged.

## 13. Pip's next step (shorter)

The first that fits wins:
1. No turns left: "Your island is resting. See you tomorrow!"
2. An empty spot, and coins to build: what to build there.
3. A chunk drifting by and coins to anchor it.
4. A Lighthouse stage it can pay for.
5. A building worth raising (cheapest first).
6. No race yet today: try a Sky Race.
7. Coins to spare: a decoration it could buy.
8. Saving up: for what, with the numbers.
9. Otherwise: End turn.

## 14. What happens to what's already built

Nothing is live, and the migration is still on hold, so it can be changed freely.

| Part | What happens |
|---|---|
| `shared/isles/config.ts` | Rewritten around coins, crystals, islanders, decorations and the steady land price. Food, tax, happiness, upgrades, the market and storm numbers go |
| `shared/isles/engine.ts` | Much shorter: collect, islanders, build/raise/anchor/decorate, lucky weather |
| `shared/isles/race.ts` | Kept. Happiness becomes the flat +3, goods become crystals, and the warm-breeze head start is added |
| `shared/isles/nextStep.ts` | Rewritten to section 13 |
| `shared/isles/server.ts`, `memoryServices.ts`, the `isles` function | Trimmed to fit. Gift and visit come in S.4 |
| Migration `20261102000100_isles.sql` | The island JSON changes shape. S.4 adds a gifts table and news. No rope or market tables |
| `TurnSteps.tsx` | 11 steps become 4. `Spot.tsx` stays. `Upgrades.tsx` becomes `Decorations.tsx` |
| `Race.tsx` | Kept |
| `scripts/isles-sim.mjs` | Rewritten for the new rules. The new pace table goes to James |
| Tests 1 to 7 | Changed to match. Still within 8; no new numbered test |
| `ISLES-RULES.md` | Rewritten |
| Art | All kept, including the library. New pictures are listed in `docs/prompts/isles-cosy-art.md`, to paint tonight on the gaming PC |

## 15. Stages

Stop for James after each.

| Stage | What | James sees |
|---|---|---|
| **C.1** | The new rules: config, engine, race tidy-ups, next step, simulator, rule sheet. Tests 5 and 6 | The new pace table |
| **C.2** | The server and the on-hold migration trimmed to fit. Tests 1, 2 and 4, and the database test | Nothing new to play |
| **C.3** | The 4-step turn, the decoration shelf and decoration places (drawn in code until painted), islander walkers, the preview republished | **The preview on his phone** |
| **C.A** | Paint the new art on the gaming PC (`docs/prompts/isles-cosy-art.md`). It can happen any evening, before or after C.3 | Tries to pick from |
| **S.4** | The class sky: classmate races, visit and gift, the news board. Test 3 extended | Preview with pretend classmates |
| S.5 to S.8 | As ISLES-PLAN section 11 (Pip, hub parts, the rest of the art, go live) | |

C.1 and C.2 can be one session. C.3 is its own.

## 16. Stage results

### C.1 results (the new rules), 3 Nov 2026

- **Built:** `config.ts`, `engine.ts`, `race.ts`, `nextStep.ts`, `isles.test.ts` (tests 5 and 6, with new checks that nothing is ever lost, all weather is good, land is one price, decoration places and helps, crystals for level 3, and the warm breeze) and `scripts/isles-sim.mjs`, all to the cosy rules. `ISLES-RULES.md` is rewritten, with the new pace table.
- **James's choices, 3 Nov 2026:**
  - land at 300 coins;
  - the sky garden (20 more decoration places once the Lighthouse is lit).
- **Pace:**
  - Every-day pupils reach Grand Isle in week 2 and light the Lighthouse in week 3. They're held back by the one-chunk-a-day drift, which no price changes much.
  - 3-days-a-week pupils reach Grand Isle in week 3 to 4 and light the Lighthouse in week 5.
  - 1-day-a-week pupils reach 9 or 10 spots.
  - Races: about 1 win in 6 with no answers right, as before.
- **Found and fixed:** in a photo finish (boats within about 0.05%), rounding could show both boats on the finish line. A boat that hasn't finished now stops at 0.999.
- **Not yet changed (on purpose):**
  - The server (`server.ts`, the `isles` function, the migration and the database test) still used the old rules: stage C.2 (done, below).
  - The screens still use the old rules too. That's stage C.3.
  - Until C.3 is done, the type check and the screen tests fail on the branch. Nothing is live, so nobody sees it.

### C.2 results (the server), 3 Nov 2026

- **`server.ts`:** no market prices; the choices it understands are anchor, build, raise, decorate, move and lighthouse (tax, the workshop slider, upgrades, the festival and buying or selling are refused as unreadable); new words for the new problems (not enough sky crystals, no such decoration place, place taken); race prizes are coins and crystals.
- **The on-hold migration:** `isles_turns` no longer keeps happiness. `isles_counts` counts islanders and decorations in place of happy days and upgrades (islanders never leave and decorations can't be sold, so the island's own numbers are the season's best). Happy Isle and Bookworm became **Busy Village** (100 islanders, 🏘️) and **Decorator** (8 decorations, 🌸). Kind Heart comes with gifts in S.4. Still on hold, and still needs a new number at go-live.
- **Tests:** the function's tests 1 to 3 (with the decoration choices and the old choices refused), the rules tests, and the database test (47 checks, on a fresh local database) all pass. The `isles` function file is rebuilt.
- **Still failing on purpose:** the Sky Isles screens and their tests (stage C.3).

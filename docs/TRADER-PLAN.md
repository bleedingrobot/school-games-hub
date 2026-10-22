# Star Trader: plan

A space trading game for the hub, in the spirit of the 2002 Palm game *Space Trader* by Pieter Spronck. Fly a small ship between planets, buy cargo cheap and sell it dear, upgrade your ship, dodge pirates, and save up to buy your own moon. **Maths is how a trader stays rich**: working out the bill, the change, the profit on a trip, the fuel for a jump and the price after a market event.

Written 18 October 2026 for James, from his pasted plan ("Math Trader", section 1), the original game's source code (section 2) and the hub's other plans on `origin/main`.
**Status: ANSWERED 18 Oct 2026 (section 13). REVISED 22 Oct 2026 against `docs/GAME_DEVELOPMENT_GUIDE.md` (section 14, which wins wherever it disagrees with sections 1–12). Not started, nothing built.** Branch `trader`, id `trader`, CSS prefix `.st-`. Next free migration number when revised: `20261022000400` (re-check before the first migration).

## The short version

- **The pasted plan is a good game idea but was written for a different website.** It assumes Grades 1–9, its own server (Node, Express, Socket.io), Firebase or MongoDB, Phaser, timed maths and free-form multiplayer. The hub is Years 4–6, GitHub Pages plus Supabase, no always-on server, no chat or typing between students, and no timed maths. Section 1 goes through it line by line.
- **Two of its four code links don't exist.** `stephankoch/SpaceTrader` and `joshisa/SpaceTrader` both return "not found" on GitHub. The real source of the original game is public and **GPL-2**, so, like Dragon Maths and Clan Quest, **the original is our rule book, not our code base**: same shape and numbers, our own code, writing and pictures.
- **What makes it different from the other maths games:** it's the hub's **money game**. No fighting for experience, no levels. You get better by making good trades, and every trade is real arithmetic with a reason to get it right. It's also the natural home for **coordinates**, **profit and loss**, **percentages** and **budgeting**.
- **One galaxy for the whole school, with a shared market** (James, 18 Oct). When students sell lots of Water on one planet, its price drops for everyone there, and it drifts back overnight. This is the pasted plan's best idea and it works on the hub without live sockets: prices are read when you land. Contracts, distress beacons and the space station are whole-school too.
- **Saved on the server, server is the boss**, the same way as Dragon Maths: each jump is one server request that checks your trades, moves your ship and hands out the next encounter.
- **Maths is short, never timed, and a wrong answer never blocks you.** The shop just shows the working and charges the right amount. **(Revised 22 Oct: the questions come from each pupil's shared maths focus, not from year bands; see section 14.)**
- **Size:** similar to Dragon Maths. Eight stages (section 12), with a test page for James after the single-player stage. It's built after Dragon Maths and Clan Quest, so it reuses their engine pieces and maths packs.

## 1. Review of the pasted plan

| Pasted plan | Keep? | Why, and what we do instead |
|---|---|---|
| Core loop: land, trade, upgrade, navigate, encounter | **Keep** | It's the original's loop and it's a good one |
| Grades 1–3 / 4–6 / 7–9 | **Change** | The hub is Years 4–6. Use the shared **Y4 / Y5 / Y6 bands** and the teacher's topic switches, like every other maths game |
| `Quantity × Unit Price = Total` before buying | **Keep, softened** | The best maths moment in the plan. But typing a sum for every purchase gets old by the tenth trade, so it's asked on about 1 trade in 3, and always on big ones (section 6) |
| Budgeting ("500 − 230 = ?") | **Keep** | As the change question after paying |
| Market events with % rises | **Keep** | The original already has them (drought, plague, war...). Easy bands use 10%, 25%, 50%; Y6 uses 15%, 12.5% |
| Distance formula (Pythagoras) for older kids | **Change** | Pythagoras is well beyond Year 6. Instead the **jump drive moves along grid lines**: fuel = across + up (section 5). That's coordinates and subtraction, which fit Y4–6 |
| Count grid squares for younger kids | **Keep** | Y4 band |
| Pirates: 3 rapid-fire questions on a time limit | **Change** | The hub has no timed maths (Gem Keep only *records* quick answers). Pirate fights are turn-based: each round, a "charge the lasers" question. Right = full-power shot, wrong = half power and the working shown (section 7). No timers at all (James, question 6) |
| Global economy driven by all players | **Keep, whole school** | One market for the whole school, with limits so one student can't crash a price (section 8) |
| Player contracts | **Keep, from buttons** | No typed text. Contracts are built from lists ("Deliver 20 Ore to Kepler for 600") and the server holds the reward until delivery (section 8) |
| Co-op goal: "solve 10,000 equations" | **Change** | Counting answers rewards rushing and guessing, and the hub never shows maths scores. Instead the class **delivers cargo** to build a class space station (like Clan Quest's village chest) |
| Distress beacons | **Keep** | A lovely idea. A computer tow is always there too, so nobody waits on another student to keep playing |
| Fleets (guilds) and pooled net worth | **Leave out** | Picking teams leaves someone out. The whole school is the team (the space station) |
| Leaderboard: "Most equations solved" | **Leave out** | Hub rule: classmates never see anyone's maths. Boards show net worth and distance only |
| Phaser.js / React + Tailwind | **React, no Phaser, no Tailwind** | It's a menu game, like the original. The hub is React with its own CSS. The pirate fight is simple enough for SVG and CSS |
| Node + Express, Socket.io | **No** | The hub has no always-on server (brief, section 2). Supabase server functions do the checking; prices are read when you land, so no sockets are needed |
| Firebase or MongoDB, Firebase Auth | **No** | The hub already has Supabase and school Google sign-in. Firebase was ruled out in docs/PLAN.md (needs a card for server code) |
| SpaceTraders API as a blueprint | **Read only** | Real (spacetraders.io), but it's a puzzle for programmers playing through code. Nothing to reuse |
| `phaserjs/examples` | **Not needed** | Real, but we're not using Phaser |
| Name "Math Trader" | **Change** | The hub uses NZ spelling ("maths"). Now **Star Trader** (question 1) |

## 2. What we found (18 Oct 2026)

**The original:** *Space Trader* 1.2.2 by Pieter Spronck, for Palm OS (2002). Written in C. **Licence: GPL-2** (checked in its `License.txt`; the author's download page says the same and he has objected to ports that didn't share their code). Copying its code or text would mean sharing the hub's code under GPL-2, which is James's decision, not something to slip in. **So: no copied code, no copied text.** Rules and numbers aren't owned the same way, and we credit the game for them.

**Real places to read it** (checked):

| Repo | What | Use |
|---|---|---|
| `videogamepreservation/spacetrader` | Original C source, GPL-2 | The rule book. Read and cloned |
| `abotkin/spacetraderPalmOS` | Same source, version 1.2.2, GPL-2 | Backup copy |
| `SaschaV313/Space-Trader-Web-Port` | A web port, GPL-2 | Look at how it lays out screens; no copying |
| `alexbeatnik/SpaceTrader` | A TypeScript remake that says Apache-2.0 | Licence is unclear for a remake of GPL code, so read only |
| ~~`stephankoch/SpaceTrader`~~, ~~`joshisa/SpaceTrader`~~ | **Don't exist** | The pasted plan's links are wrong |

**The original's rules, from the source:**

| Part | The original | Ours |
|---|---|---|
| Galaxy | 120 systems on a 150 × 110 map | **About 24 planets on a 20 × 20 grid**, so a whole galaxy fits on a Chromebook screen and a 9-year-old can learn it |
| Goods | 10: Water, Furs, Food, Ore, Games, Firearms, Medicine, Machines, Narcotics, Robots | 10, two renamed: **Firearms → Fireworks**, **Narcotics → Lollies** (some planets ban them, which keeps the original's smuggling idea gentle) |
| Price | Base price + tech level × a step; ×4/3 if the planet wants it; less with lots of traders; less on big planets; ×3/4 or ×4/3 for special resources; 0 if the planet can't use it | **Same formula**, prices divided by 10. The formula is itself good maths: "Robots cost a third more here" |
| Events | Drought, plague, war, crop failure, boredom... raise one good's price | Same, kid-worded ("A water pipe burst on Juno!") |
| Fuel | 1 fuel per parsec, straight-line distance, tanks of 13–17 | Grid-line distance, tanks of 8–14 |
| Ships | 10 to buy (Flea to Wasp), cargo 10–60 holds | **6 ships** (Flea, Gnat, Firefly, Bumblebee, Beetle, Hornet), our own pictures |
| Encounters | Police, pirates and traders, chance set by the planet's government | **Pirates, customs and friendly traders**, chance set by the planet (section 7) |
| Police record, bribes, criminal record | Yes | **Out.** Customs just take banned Lollies and Fireworks and charge a small fine |
| Bank loans with interest, debt | Yes, 10% a day, police trouble if you owe too much | **In, with gentle limits** (James, question 7): section 9 |
| Death, insurance, escape pod | You can lose everything | **Escape pod always fitted**: lose the cargo, keep your money, get a free Flea |
| Goal | Retire, ideally after buying a moon | **Buy your moon** before the season ends (section 9) |
| Special quests | Space monster, Dragonfly, Jarek, tribbles, reactor... | 6 of our own, written fresh (stage T.6) |

## 3. How it fits with the other games

| | Dragon Maths | Clan Quest | Wormholes & Black Holes | Star Trader |
|---|---|---|---|---|
| Feel | One hero, forest fights | Four-person clan, empire | Dice race | **A small ship, buy low, sell high** |
| You get better by | Levelling up | Levelling up, building | Luck | **Better trading decisions** |
| Maths | At chosen moments | Everywhere | Between turns | **Money, profit, %, coordinates** |
| Social | Rival heroes | Class village | Live races | **Whole-school market, contracts, rescues** |

- **Overlap with Clan Quest:** its market also does "price with tax" and "change". Fine to share those question kinds; Star Trader adds **profit and loss, unit prices and coordinates** that Clan Quest doesn't.
- **Overlap with the space game:** same space theme. Star Trader can reuse its space facts (`shared/space/facts.ts`) for planet descriptions and the Star chart.
- **Overlap with Marble Rush:** Marble Rush has "Roll through C4" coordinate gates; Star Trader uses (x, y) coordinates. A shared `coordinates` question pack would serve both.
- **Engine pieces shared with Dragon Maths and Clan Quest:** seeded random encounters, server replay, daily reset on first play, computer-written news, seasons, and Clan Quest's market maths. Both are built first, so about a third of this game already exists when it starts. It doesn't need Clan Quest's class groups, because everything is whole-school.

## 4. A day in the game

About **10–15 minutes**, like the other daily games:

1. **Land.** See today's news ("Water prices crashed on Mars: lots of traders sold there yesterday") and the market.
2. **Trade.** Sell what you're carrying, buy new cargo. Maths moments (section 6).
3. **Shipyard** (sometimes). Refuel, repair, buy a bigger ship, cargo pods, shields or lasers.
4. **Pick a destination** on the star map and work out the fuel.
5. **Jump.** Maybe an encounter (pirates, customs, a trader, a distress beacon).
6. **Repeat** for up to **10 jumps a day** (question 3). Unused jumps don't carry over.

Everything resets on first play each NZ day, like Dragon Maths (nothing needs to run at midnight). A teacher **Practice Mode** gives extra jumps that earn no hub points.

## 5. The galaxy and fuel

- **A 20 × 20 grid** with about 24 planets, each with a picture, a tech level (0–7, as original), a size, a government (kid-worded: "Robot council", "Farming co-op", "Pirate haven"...), sometimes a special resource (rich soil, lots of water...).
- **Same galaxy for the whole school for a season**, made from a seed, so students can talk about it ("Ore is cheap on Kepler!") out loud.
- **The jump drive moves along grid lines.** Fuel for a jump = how far across + how far up. From (3, 4) to (9, 12) is 6 + 8 = 14 fuel. This is called "taxi-cab distance" and it's what Year 4–6 students can actually work out.
- **By band:**
  - **Y4:** the map shows the grid; "Count the squares across and up." Choices, not typing.
  - **Y5:** "Kepler is at (9, 12). You are at (3, 4). How much fuel?" Typed answer.
  - **Y6:** two-jump routes ("Is it cheaper to go via Juno?"), fuel cost in credits (14 fuel × 3 credits).
- A wrong fuel answer shows the working on the map and the jump goes ahead. Running out of fuel can only happen if you skip refuelling; then a distress beacon (section 8).

## 6. Maths moments (the heart of the game)

> **Revised 22 Oct 2026 (section 14, change 1–3):** the table below says what the game *does* with numbers at each moment. The game now does that arithmetic itself and shows the working. The *questions* a pupil answers are their own shared-focus questions, and the year-band columns, the "new question kinds" paragraph and the per-moment teacher switches no longer apply. Coordinates stay as a game puzzle that isn't recorded to the ladder.

| Place | Original rule | Maths moment | Topic (Y4–6) |
|---|---|---|---|
| **Buying** | Price × quantity | "12 Food at 15 each. What's the total?" About 1 trade in 3, always on the biggest trade of the visit | multiplication |
| **Change** | Credits left after a trade | "You had 600 and spent 180. What's left?" | subtraction to 1,000s |
| **How many can I afford?** | Max you can buy | "You have 500. Ore is 35 each. How many can you buy? What's left over?" | division with remainders |
| **Cargo space** | Holds | "Your ship has 25 holds and 17 are full. How many more?" | subtraction, Y4 |
| **Profit on a trip** | Buy here, sell there | "You bought Water for 4 and sold it for 7. 20 of them: how much profit?" | multi-step, ×, − |
| **Loss** | Prices fall | "You paid 90 and sold for 75. Did you make or lose money? How much?" | subtraction, comparing |
| **Market events** | Event raises a price | "A drought raised Water by 25%. It was 40. What is it now?" | percentages (Y6), halves and quarters (Y5) |
| **Wanted goods** | ×4/3 if wanted | "Robots cost a third more here. Normally 300. Now?" | fractions of amounts |
| **Fuel** | Fuel per distance | Section 5 | coordinates |
| **Refuelling** | Price per unit of fuel | "You need 9 fuel at 3 credits each." | multiplication |
| **Shipyard: trade-in** | Old ship's value | "The Gnat costs 1,000. They give you 400 for your Flea. How much more do you pay?" | subtraction |
| **Better buy** | Ships differ | "Cargo pod A: 5 holds for 200. B: 8 holds for 280. Which is cheaper per hold?" | unit rates, Y6 |
| **Laser charging** | Pirate fight | Section 7 | any topic |
| **Rescue** | Distress beacon | "Tow 6 squares at 4 fuel each..." | multi-step |

Rules for every moment, same as Clan Quest:

- **A wrong answer never blocks you.** The shop shows the working and charges the right amount. Maths is *how you check the bill*, not a gate.
- **Getting it right helps a little:** a right answer on a trade earns a small "sharp trader" discount (1–2%), which adds up over a season but never decides it. A wrong answer costs nothing.
- **No timers.** One hint (a worked step), then the answer.
- **"No thanks"** skips a question; you just don't get the discount.
- **Teacher switches** per moment and per band. Questions are made and marked by code, never an AI, and the server rebuilds each from its numbers to check it (`params`, as in `shared/maths/skillPack.ts`).
- **Recorded privately** in the shared maths records, like Gem Keep. Classmates never see accuracy.

**New question kinds needed** (go in `shared/maths/skillPacks/`, useful to the other games too): money totals and change, how-many-can-I-afford with remainder, profit and loss, percent increase, fraction of an amount, unit rate comparison, coordinates and grid distance.

## 7. Encounters

When you jump, the server picks an encounter from the seed and the planets' governments (as the original does). About 1 jump in 3 has one.

- **Pirates.** A turn-based fight of 3–6 rounds. Each round: **Charge the lasers** (a question: right = full shot, wrong = half shot and the working shown), **Raise shields**, or **Flee** (better engines flee more often). If they win, they take **some of your cargo** (never credits, never the ship). Beating them gives a small bounty. A fight can be won with no right answers if your ship is good, and lost with all of them right. It's a fight, not a test.
- **Customs.** Some planets ban Lollies or Fireworks. If you carry them, customs take them and charge a small fine (the original's police, without records or bribes). Students learn to check the planet before buying.
- **Friendly traders.** Offer to buy or sell a load at a special price: a quick "Is that a good deal?" comparison question.
- **Space junk / asteroid fields** (pasted plan): a question to steer through; wrong = a little hull damage, repaired at the next shipyard.
- **Distress beacons** (section 8).
- **Destroyed?** The escape pod always works: you lose cargo, keep credits, and get a free Flea. Nothing is lost forever.

## 8. Playing with the rest of the school

All of this is **whole-school** (James, 18 Oct): one galaxy, one market, one station. Year 4s and Year 6s trade in the same market; each still gets questions at their own band.

- **Shared market.** Every planet's price for each good is stored once for the school. Selling pushes the price down and buying pushes it up, by a set amount per unit. Every day prices drift halfway back to normal. Guard rails:
  - **Your price is fixed when you land.** You trade at the prices you saw; the market moves after you leave. No "the price changed while I was typing" confusion.
  - **One student's trades can move a price by at most 20% a day** at one planet, so nobody can crash a market for everyone.
  - **A price can't move more than 50% from normal in a day**, however many students trade. With a whole school trading, a popular planet could otherwise swing wildly in one lunchtime. Tune both limits with the simulator (stage T.5).
  - The news explains it: "Lots of traders sold Water on Mars: it's cheap there today." That's the supply-and-demand lesson, and nobody is named.
  - **Busy moments:** many students may trade the same planet at once. The server updates each price in one database step, so no trade is lost or counted twice.
- **Contracts** (stage T.6). Pick from lists: a good, an amount, a planet, a reward. The server takes the reward from your credits and holds it. Any student can deliver; the server pays them. Unclaimed after 3 days, it comes back. Only player names show. Computer contracts too, so there's always some. Limit: 2 open contracts each.
- **Distress beacons** (stage T.6). Out of fuel or towed after a fight? You can drop a beacon. Another student who lands on that planet that day can answer it with a rescue question and earns a reward (paid by the game, not by the stranded student). **If nobody answers in 10 minutes, a computer tow** gets you home for a small fee. Nobody is stuck waiting.
- **School space station** (instead of "solve 10,000 equations"): the whole school delivers cargo to build it in stages ("Stage 2: 400 Ore, 150 Machines"). Each stage gives everyone a small perk (cheaper fuel, a free cargo pod). A progress bar on the home screen. Delivering is optional and never taken from anyone. Stage sizes are set for the number of students playing.
- **No chat, no typing, no fleets, no attacking other students.** Pirates are always computer ones.
- **Live updates aren't needed.** Prices and contracts are read when you land. This keeps Supabase Realtime free for the live games.

## 9. Numbers that work for 9-year-olds

To be tuned with a simulator (stage T.1), like the other games:

- **Prices:** original divided by 10, so goods cost 3–500 credits. Y4 band rounds them to tens.
- **Starting money:** 100 credits and a Flea (10 holds). Original 1,000.
- **Moon:** **10,000 credits** (original 500,000). Target: a pupil playing 4 days a week buys it in **week 4 or 5** of a 5-week season, the same pace target as Dragon Maths.
- **Seasons:** 5 weeks, then everyone starts fresh with a new galaxy (the teacher sets the start date). Kept forever: achievements, a **Moon Owners** list per season.
- **Ships:** about 6, from 10 to 60 holds. Upgrades are the main thing to spend on before the moon.
- **Balance:** a sensible trader should make a profit on about 3 trips in 4 with no maths at all; the 1–2% discount for right answers makes it a little better.
- **Bank loans** (James, 18 Oct: for everyone, with gentle limits):
  - Borrow **up to 500 credits** at a time.
  - **10% simple interest, added once a week** on what you borrowed (never interest on interest). "You borrowed 300. After 2 weeks you owe?" is a maths moment.
  - **No police, no ship taken, no bad record** if you can't pay. Instead, part of each sale pays the loan off automatically until it's cleared, and the bank screen shows how much is left.
  - **Cleared at the end of the season**, so nobody starts the next one in debt.
  - Friendly wording: "loan" and "pay back", never "debt collectors". The teacher can switch loans off.

## 10. Saving, fairness and cost

The server decides everything that matters (credits, cargo, fuel, ship, position, jumps left, market prices). Engine in `shared/trader/`, the same shape as Dragon Maths:

- **New tables** (students can't write to them): `trader_ships` (one per student per season, including any loan), `trader_markets` (one row per planet and good, for the whole school), `trader_contracts`, `trader_beacons`, `trader_station`, `trader_news`.
- **New `trader` server function.** One request per jump: it carries the trades made at this planet, any shop purchases, the answers, and the destination. The server checks every trade against the prices you landed with, rebuilds and marks each question, updates the market, takes the fuel and a jump off today's count, picks the encounter with a seed and sends back the new planet. Pirate fights are played in the browser and replayed by the server in the next request. Sending the same request twice counts once.
- **Refresh-safe:** the ship is always saved on the server; a half-finished fight is kept.
- **Free-plan cost:** about 12–15 requests per student per day. 100 students playing every school day is about **30,000 a month**. With the other games (~70,000), Dragon Maths (~75,000) and Clan Quest (~90,000), that's about 265,000 of the 500,000 free. Still fits, but the hub is now using half its budget. Measure at stage T.5 and add the total to the README.
- **Database:** about 24 planets × 10 goods = 240 market rows for the whole school. Tiny.

## 11. Points, teacher, privacy, look

- **Hub points**, inside the shared 40-a-day cap, `ranked: false`. My pick: 1 point per 3 jumps that make a profit, 3 for beating pirates, 2 for a delivered contract or rescue, 10 for buying the moon. Right answers never earn points (hub rule).
- **Achievements (about 8):** first profit, first upgrade, beat 5 pirates, deliver a contract, rescue another student, help build the station, buy a moon, visit every planet.
- **Leaderboard:** top 10 and you by net worth this season, whole school. Net worth counts loans against you, so borrowing can't buy a place on the board. Never maths.
- **Teacher page:** game on/off; topics, bands and maths moments on/off (shared with the other games); jumps per day; Practice Mode; loans on/off; contracts and beacons on/off; season start date; reset a student's ship.
- **Privacy:** no new personal data. Names from the word lists. Maths answers recorded like Gem Keep (asked and right/wrong, never the typed answer). Add Star Trader's tables to docs/PRIVACY-SUMMARY.md before it goes live, and cover it in **New season**.
- **Look:** a bright star map (SVG) with the grid, planets with our own pictures (Kenney's space packs are CC0; check again at the start), a cockpit-style market table. Big buttons, keyboard and touch, screen-reader text for the map ("Kepler, 9 across, 12 up, 14 fuel away"), and the 1366 × 640 Chromebook fit. Sound made in code, off by default. Reduced motion respected.

## 12. Stages (when picked up)

> **Superseded by section 14.** The old T.2 (new question kinds) is dropped; the stage list in section 14 is the one to follow.

| Stage | What | Rough size |
|---|---|---|
| **T.0** | Rule sheet: every number taken from the original, the rescaled economy, renamed goods, the planet list. Licence and art checks | Small |
| **T.1** | `shared/trader/` engine: galaxy from a seed, prices, events, fuel, ships, encounters, pirate fight. Seeded random and replay. Simulator to tune the moon target | Medium |
| **T.2** | Maths: new question kinds (money, change, remainders, profit, %, fractions of, unit rates, coordinates) in the shared packs; maths moments wired in | Small–medium |
| **T.3** | Screens: market, shipyard, star map, fuel, encounters, pirate fight. **Test page for James**, single player, nothing saved | Big |
| **T.4** | Saving and fairness: migration, `trader` function, replay checks, daily reset, seasons, bank loans. **Class trial possible from here** (single player) | Medium |
| **T.5** | Shared whole-school market and the news. Simulate a busy lunchtime to tune the price limits. Measure function calls | Medium |
| **T.6** | Contracts, distress beacons, class space station, quests. Points, achievements, leaderboard, teacher page. **Go live**, needs James to say so | Medium–big |
| **T.7** | How to play, accessibility pass, slow-Chromebook check, privacy summary and README | Small |

Each stage ends with tests passing and a results section here, and stops for James's review, like the others.

## 13. James's answers (18 Oct 2026)

| # | Question | Answer |
|---|---|---|
| 1 | Name | **Star Trader** |
| 2 | Build order | **After Clan Quest** (my pick was after Dragon Maths) |
| 3 | Jumps a day | **10** |
| 4 | Market | **One market for the whole school** (my pick was per class group). Section 8 adds a daily price limit for this |
| 5 | Firearms and Narcotics | **Fireworks and Lollies**, banned on some planets |
| 6 | Timed pirate questions | **No timers** |
| 7 | Bank loans | **For everyone** (my pick was leave out), with **gentle limits**: 500 max, 10% simple interest weekly, paid from sales, no penalties, cleared each season (section 9) |
| 8 | Contracts and distress beacons | **Later, stage T.6** |
| 9 | Season length | **5 weeks** |
| 10 | Discount for right answers | **Yes, 1–2%** |
| 11 | Contracts, beacons and the station: whole school or per class? | **All whole-school** |

## Credits to carry over

- Game structure, rules and numbers adapted from *Space Trader* by Pieter Spronck (2002), released under GPL-2; no code or text copied.
- Planet and ship pictures from Kenney (CC0), if used.

## 14. Revision against the Game Development Guide (22 Oct 2026)

This plan was written on 18 Oct, two days before `docs/GAME_DEVELOPMENT_GUIDE.md`. Read against the guide, these things change. **James chose on 22 Oct: maths = shared focus questions, plus coordinates as a game mechanic.** Everything else James decided on 18 Oct (section 13) stands.

| # | Plan said | Guide says | Now |
|---|---|---|---|
| 1 | Own trade questions by Y4/Y5/Y6 band; teacher topic/band switches | Maths only from `makeFocusPack`, marked on the server, recorded with `recordMathsAnswers`; no focus controls of our own | **Focus questions only.** Totals, change, profit, % events and fuel price are done by the game and shown as working. "Sharp trader" moments (about 1 trade in 3, always the biggest of a visit; laser charge in a fight; steering past junk) ask the pupil's focus question in `QuestionModal`. Right = 1–2% discount or a full laser shot; wrong = nothing lost. Drop the band/topic switches; keep one `trader_maths` switch (`off/choose/on`, `parseMathsSwitch`) |
| 2 | Stage T.2 adds question kinds to `shared/maths/skillPacks/` | `shared/maths/` and `src/maths/` are off limits from a game branch; changing shared code makes other functions' `index.ts` stale and needs redeploying | **Dropped.** Trading-style packs, if ever wanted, are their own later branch |
| 3 | Fuel = across + up, typed by band | Server checks everything that counts; non-ladder maths isn't recorded as ladder facts | Coordinates are a **game puzzle**: the server works out the fuel from the rules and the jump goes ahead either way (a wrong count shows the working). Not recorded to `record_fact_answers`. Count-the-squares vs typed follows the pupil's focus level, never a shown year level |
| 4 | Questions rebuilt from `params` | Way A (Marble Rush): server makes and stores questions, sends `publicQuestion` | **Way A.** `trader_questions` (RLS on, no policy, no grant) and `trader_claim_answer` once per slot |
| 5 | Points in the 40 cap; achievements; New Season line | `hub_games` hooks; points via `add_game_points`; never re-create shared functions | Register in `hub_games` (`switch_column`, `counts_fn`, `rules_fn`, `season_fn`, `last_played_fn`), measures and achievements in our own migration. Copy `supabase/tests/database/game_hooks.test.sql` |
| 6 | Own 5-week seasons with a teacher start date | New Season is the teacher's button; it calls each game's `season_fn` | 5 weeks stays the **pace target**; the rollover is the hub's New Season through our `season_fn`. Moon Owners kept (`keep_achievements` / a table the hook doesn't clear) |
| 7 | One market for the whole school | Pupils only see their own school (`my_school()`); boards follow `marble_board()` | "Whole school" means **the pupil's school**. Market, contracts, beacons, station, news and board all carry `school_id` |
| 8 | Reuse Dragon Maths / Clan Quest engine pieces | Don't import other games' folders | Only shared pieces (`shared/seededRandom.ts`, `serverQuestions.seededRandom`) are reused; small bits (daily reset, news, seasons) are **copied** into `shared/trader/`. "A third already exists" was optimistic |
| 9 | One big teacher page of switches | `TeacherTrader.tsx` named in `GameDefinition.TeacherPanels`; settings = `app_settings` columns + `teacher_set_trader(…, target_class default null)` with `require_settings_target()` | Settings: on/off, jumps a day, Practice Mode, loans, contracts/beacons (T.5), maths switch, reset a ship. Code switch `traderOn()` plus teacher switch; **the server refuses while off** |
| 10 | Request estimate 12–15/pupil/day against ~265,000 | More games exist now; way A adds a request per answered question | Re-estimate at T.0 from `docs/SERVER-LOAD-PLAN.md`. Decide per-answer marking (like Marble) or batching answers into the jump request once the number is known |
| 11 | Names | Tables prefixed with the game | id `trader`; tables `trader_ships / markets / contracts / beacons / station / news / questions`; function `trader`; prefix `.st-` |
| 12 | Branch, preview, go-live prompt, privacy lines not mentioned | Guide sections 2, 6–9 | Added to the stages below |

### Stages (each ends with tests, a results section here, a commit, and a stop for James)

**Every stage:** merge `origin/main` first; `node scripts/migration-numbers.mjs` and write the number here; never `supabase db reset`; build only our function (`npm run build:functions -- trader`); no new dependencies; no edits to `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `_shared/`, other games or CLAUDE.md.

| Stage | What |
|---|---|
| **T.0** | Plan only. Rule sheet from the original (numbers, rescaled economy, planet list, licence and art check); `shared/trader/config.ts` listing every tuning number; request-cost estimate; migration number; list of shared files touched; James's answers to the questions below |
| **T.1** | `shared/trader/` engine (pure; seed + inputs = result): galaxy, prices, events, fuel, ships, encounters, pirate fight, daily reset. `scripts/trader-sim.mjs` (`npm run trader:sim`) tunes the 10,000-credit moon target |
| **T.2** | Screens in `src/games/trader/` (own `trader.css`, shared colour tokens and buttons, `QuestionModal`, 44 px targets, 1366 × 640 and 844 × 390). `preview/trader/` + `vite.trader-preview.config.ts` with a trial backend (fake focus, never calls the live server), published as a private Artifact for James. Nothing saved. A test that every `LADDER` skill shows in the game |
| **T.3** | Saving: migration (own tables, RLS, server-only functions revoked from `public, anon`, switches start off, `app_settings` columns added only), `trader` function (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`; `userIdFromToken`; `_shared/limits.ts`; `recordMathsAnswers` for focus answers; fights replayed; a repeated request counts once), loans, daily jumps, `trader_questions`. pgTAP `trader.test.sql` on a scratch copy. Class trial possible from here |
| **T.4** | School-scoped market and news; price limits tuned by simulating a busy lunchtime; measure requests and update the estimate |
| **T.5** | Contracts, beacons (computer tow after 10 minutes), school station, 6 quests. `hub_games` registration, 8 achievements, `GameDefinition` (`group`, `useTeacherSwitch`, `TeacherPanels`, `ranked: false`), `TeacherTrader.tsx`, net-worth board on the `marble_board()` pattern |
| **T.6** | `HowToPlay.tsx` reading its numbers from config, `Accessibility.test.tsx` (copy Clan Quest's), slow-Chromebook check, the one-line shared edits (`registry.ts` behind `traderOn()`, `build-functions.mjs`, `package.json` scripts at the end, `.gitignore`, `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, `docs/PLAN.md` migration note) |
| **T.7** | `docs/prompts/trader-golive.md` (copy `clans-golive.md`). Then, each only on James's words: pre-flight → apply migration → deploy `trader` → check from outside → merge to `main` → try as teacher with the pupil switch off → switch on. Auto mode blocks live deploys, so James leaves it first |

### James's answers (22 Oct 2026)

1. **Season end:** the hub's one New Season button. No separate Star Trader start date.
2. **Order:** whenever a session is free. No need to wait for Clan Quest.
3. **Marking cost:** decide after the T.0 request estimate.

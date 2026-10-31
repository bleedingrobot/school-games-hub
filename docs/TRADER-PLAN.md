# Star Trader: plan

A space trading game for the hub, in the spirit of the 2002 Palm game *Space Trader* by Pieter Spronck. Fly a small ship between planets, buy cargo cheap and sell it dear, upgrade your ship, dodge pirates, and save up to buy your own moon. **Maths is how a trader stays rich**: working out the bill, the change, the profit on a trip, the fuel for a jump and the price after a market event.

Written 18 October 2026 for James, from his pasted plan ("Math Trader", section 1), the original game's source code (section 2) and the hub's other plans on `origin/main`.
**Status: T.0 and T.1 done 22 Oct 2026 (sections 15, 16); T.2 built 22 Oct 2026 (section 18); T.3 built 22 Oct 2026, not applied or deployed (section 19); T.4 shared market built 22 Oct 2026, not applied or deployed (section 20). ANSWERED 18 Oct 2026 (section 13). REVISED 22 Oct 2026 against `docs/GAME_DEVELOPMENT_GUIDE.md` (section 14, which wins wherever it disagrees with sections 1–12). Not started, nothing built.** Branch `trader`, id `trader`, CSS prefix `.st-`. Next free migration number when revised: `20261022000400` (re-check before the first migration).

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
| Ships | 10 to buy (Flea to Wasp), cargo 10–60 holds | **6 ships** (Flea, Gnat, Firefly, Bumblebee, Beetle, Termite), our own pictures |
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

## 15. Stage T.0 results (22 Oct 2026): rule sheet, config list, request estimate

Plan only. Nothing built. Numbers below are **provisional**: T.1's simulator (`npm run trader:sim`) settles them. Source for every "original" number: the 1.2.2 C source (`Global.c`, `Traveler.c`, `Fuel.c`, `DataTypes.h`), used as a rule book only (GPL-2: no code, text or names copied).

### 15.1 The one thing T.0 found that changes the numbers

The plan said goods ÷ 10 and a 10,000-credit moon. If ships were also ÷ 10 (Hornet 100,000 → 10,000) the best ship would cost as much as the moon. In the original the moon (500,000) is 5× the *second-dearest* ship (Wasp, 300,000) and 500× the start money. So:

- **Goods ÷ 10** (as planned): prices of about 3 to 500 credits.
- **Ships and gear ÷ 50**, so every upgrade is a real saving goal but the moon is still the biggest: Gnat 200, Firefly 500, Bumblebee 1,200, Beetle 1,600, Termite 4,500.
- **Moon 10,000 (raised to 20,000 by the simulator, see section 16), start 100 credits and a Flea.** The ratio moon : start is 100 here against 500 in the original. T.1 checks whether that is too quick for a 5-week season, and moves the moon price, not the formulas.

### 15.2 Goods (original, then ours)

Original price at a planet: `base = low-tech price + tech level × step`; ×4/3 if the government wants it; × (100 − 2 × trader strength)%; × (100 − size)%; × ¾ if the planet's special resource makes it cheap, × 4/3 if it makes it dear; 0 if the planet's tech is below the good's usage level or the good is banned there; × 3/2 during the matching event; then ± a random variance. **We keep this formula exactly**, with prices ÷ 10 (rounded to the nearest credit, minimum 1).

| Good | Low-tech price | Step per tech | Variance | Event that doubles it | Cheap with | Dear with | Made at tech | Used at tech |
|---|---|---|---|---|---|---|---|---|
| Water | 30 | +3 | 4 | Drought | Lots of water | Desert | 0 | 0 |
| Furs | 250 | +10 | 10 | Cold | Rich animals | Lifeless | 0 | 0 |
| Food | 100 | +5 | 5 | Crop failure | Rich soil | Poor soil | 1 | 0 |
| Ore | 350 | +20 | 10 | War | Rich in minerals | Poor in minerals | 2 | 2 |
| Games | 250 | −10 | 5 | Boredom | Artistic | none | 3 | 1 |
| Fireworks (Firearms) | 1250 | −75 | 100 | War | Warlike | none | 3 | 1 |
| Medicine | 650 | −20 | 10 | Plague | Lots of herbs | none | 4 | 1 |
| Machines | 900 | −30 | 5 | Lack of workers | none | none | 4 | 3 |
| Lollies (Narcotics) | 3500 | −125 | 150 | Boredom | Weird mushrooms | none | 5 | 0 |
| Robots | 5000 | −150 | 100 | Lack of workers | none | none | 6 | 4 |

(Original columns shown; our price column = value ÷ 10. Variance ÷ 10 too, minimum 1. The best trade routes are the dear goods, so Lollies and Robots are capped in supply: stock × (5 − difficulty) ÷ (6 − difficulty) + 1, exactly as in the original, to stop one lucky load winning the season.)

The event-name list is the original's 7 (war, plague, drought, boredom, cold, crop failure, lack of workers). Each raises the matching good by half and cuts its stock to a fifth. Our wording and "% rise" are shown to pupils as a game fact, never asked as a question.

### 15.3 Governments (9 of the original 17, kid-worded)

Strengths run 0–7. "Customs" is the original's police. Fireworks / Lollies are the original's firearms / narcotics. Tech range is where the planet type is found.

| Our name (original) | Customs | Pirates | Traders | Tech | Fireworks | Lollies | Wants |
|---|---|---|---|---|---|---|---|
| Pirate haven (Anarchy) | 0 | 7 | 1 | 0–5 | ok | ok | Food |
| Merchant guild (Capitalist) | 3 | 2 | 7 | 4–7 | ok | ok | Ore |
| Class vote (Democracy) | 3 | 2 | 5 | 3–7 | ok | ok | Games |
| Scientists' council (Technocracy) | 6 | 3 | 6 | 4–7 | ok | ok | Water |
| Temple (Theocracy) | 6 | 1 | 4 | 0–4 | ok | ok | Lollies |
| Peace garden (Pacifist) | 2 | 1 | 5 | 0–3 | **banned** | ok | none |
| Star navy (Military) | 7 | 0 | 6 | 2–7 | ok | **banned** | Robots |
| Robot council (Cybernetic) | 7 | 7 | 5 | 6–7 | **banned** | **banned** | Ore |
| Farming co-op (Feudal) | 1 | 6 | 2 | 0–3 | ok | ok | Fireworks |

Dropped: communist, confederacy, corporate, dictatorship, fascist, monarchy, socialist, satori (too alike for a 24-planet map).

### 15.4 Ships (6 of the original 10; prices ÷ 50)

| Ship | Holds | Weapon / shield slots | Fuel range | Hull | Price (original → ours) | Fuel per unit (ours) |
|---|---|---|---|---|---|---|
| Flea | 10 | 0 / 0 | 20 | 25 | free (start) | 1 |
| Gnat | 15 | 1 / 0 | 14 | 100 | 10,000 → **200** | 1 |
| Firefly | 20 | 1 / 1 | 17 | 100 | 25,000 → **500** | 1 |
| Bumblebee | 25 | 1 / 2 | 15 | 100 | 60,000 → **1,200** | 1 |
| Beetle | 50 | 0 / 0 | 14 | 50 | 80,000 → **1,600** | 2 |
| Termite | 60 | 1 / 3 | 13 | 200 | 225,000 → **4,500** | 3 |

**A change from the plan:** it listed the Hornet as the sixth ship, but a Hornet has only 20 holds, so the "10 to 60 holds" range needs the Termite. **James chose the swap on 22 Oct: Termite replaces Hornet.** Fuel range is the original's number of parsecs; on our grid it is **grid squares**. The plan's "tanks of 8–14" is too tight for a Flea to cross a 20 × 20 map, so we keep the original ranges and check in T.1 that every planet can be reached from the start. Gear (÷ 50): pulse laser 40, beam laser 250, military laser 700; energy shield 100, reflective shield 400; 5 extra holds 50; hull repair 1 credit a point (Flea) up to 4. Weapon power 15 / 25 / 35; shield strength 100 / 200.

### 15.5 Encounters and planet count

- Original: every "click" of a trip rolls `random(44 − 2×difficulty)`; below pirate strength = pirates, below pirate+customs = customs, below pirate+customs+traders = a trader. That is many rolls per trip. **Ours: one roll per jump**, chance = `(pirates + customs + traders) ÷ 30` capped at 60%, which gives about 1 jump in 3 on an average planet (the plan's target). Which kind is picked in the same proportions as the original. Decided in T.1 with the simulator.
- **Planets: 24** on a 20 × 20 grid, minimum 2 apart, built from a seed, each with a tech level inside its government's range, a size (Tiny to Huge, price cut 0–4% ÷ 10 per size as the original), and 0 or 1 special resource. A galaxy that has any planet out of reach of a Flea is thrown away and re-made.
- **24 planet names: real ones (James, 22 Oct).** Planets and dwarf planets: Mercury, Venus, Earth, Mars, Ceres, Jupiter, Saturn, Uranus, Neptune, Pluto, Eris, Haumea, Makemake, Vesta. Moons: Europa, Io, Ganymede, Callisto, Titan, Enceladus, Triton, Charon, Titania, Phobos. (Earth's Moon is left out because "buy your moon" is the goal.) Their places on our 20 × 20 grid are made up; the game says so on the Star chart. Facts for each come from `shared/space/facts.ts` where it has them.

### 15.6 `shared/trader/config.ts`: every tuning number in one file

Moon price; start credits and ship; jumps a day (10); practice jumps; grid size (20 × 20) and planet count (24) and minimum gap; goods table (15.2); governments (15.3); ships and gear (15.4); price rounding and sizes; supply caps; event chance per planet per day and its size; encounter chance divisor and cap; pirate and customs strengths, laser and shield power, flee chance; fine and bounty sizes; sharp-trader discount (1–2%) and how often a question is asked; loan limit (500), rate (10% a week), repay share of each sale; market drift back per day, per-pupil and per-day price limits (20% / 50%); contract and beacon limits and timings (T.5); station stage sizes (T.5); points table (T.5); questions stored per day. How to play reads these.

### 15.7 Server request estimate

A pupil's day is 10 jumps. Questions asked (focus questions, never typed trade sums): about 1 per planet visit (10), about 1.3 fights × 4 laser rounds (5), about 1 steering question: **about 17 a day**. Trade buys and sells ride on the jump request, a fight is played in the browser and replayed in the next request.

| | Requests per pupil per day | Class of 28 in one 12-minute lesson | 100 pupils, 20 school days |
|---|---|---|---|
| **A. One request per answered question** (Marble Rush, the guide's way A) | 1 start + 10 jumps + 17 answers + 1 end ≈ **29** | ≈ **810**, about 1 a second class-wide | ≈ **58,000** a month |
| **B. Answers batched with the jump** | 1 start (also makes the day's questions) + 10 jumps carrying their answers + 1 end ≈ **12** | ≈ **340** | ≈ **24,000** a month |

- Both fit the 500,000 free limit by themselves. The earlier "265,000 of 500,000 for the other games" cannot be checked from here; the live total goes in at T.4 from the request records (`pg_stat_statements`, as `SERVER-LOAD-PLAN.md` does).
- **The real risk is the burst, not the month** (`SERVER-LOAD-PLAN.md`: a class doing the same thing at once). Both options start with 28 pupils pressing Start at the same second, which is the same as the lobby (28 every 20 seconds, which was fine after S.4). Market writes are the other hot spot: one database step per trade batch per planet; T.4 tests a busy lunchtime.
- **Trade-off:** B is less than half the load and works with the plan's "one request per jump". Its cost is that a pupil learns "right / wrong, here's the working" **after** the jump, not straight after answering. A shows it instantly. A middle road: B for steering and shop checks, A only for the laser rounds, where instant feedback matters most (about 5 extra requests a day, ≈ 17 total).
- **My pick: B for everything except laser rounds** (≈ 17 a day, ≈ 480 per class lesson, ≈ 34,000 a month). Your call (question 3 in section 14).

### 15.8 Migration, shared files and checks

- **Migration number:** next free across `main` and every branch on 22 Oct 2026 is `20261022000400` (`node scripts/migration-numbers.mjs`). Likely two files: `…000400_trader.sql` (tables, functions, `hub_games` registration, `app_settings` columns) and later a market/contracts one. **Re-check before each is written, and again at go-live.** Our function name is `trader`; not in `FUNCTIONS` yet.
- **Shared files we will touch, at the end only (T.6), one line each:** `src/games/registry.ts` (append behind `traderOn()`), `scripts/build-functions.mjs` (add `'trader'` to the end of `FUNCTIONS`), `package.json` (`trader:sim`, `trader:preview` at the end of `scripts`), `.gitignore` (`dist-preview-trader/`), `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, `docs/PLAN.md` (migration note). Nothing else shared; no new dependencies.
- **Reuse checked present:** `shared/seededRandom.ts`, `shared/maths/serverQuestions.ts`, `shared/space/mathsSwitch.ts`, `shared/space/facts.ts`, `src/training/switch.ts` (code switch), `src/games/clans/switch.ts` (teacher-switch hook), `supabase/functions/_shared/{http,limits,recordAnswers,signIn,stamp}.ts`, `marble_board()` in `20261019000900_marble.sql` (leaderboard pattern).
- **Licence:** the original is GPL-2 (re-confirmed from `License.txt`): rules and numbers used, no code or text. **Pictures:** nothing downloaded yet. Kenney's space packs (CC0) are the plan; **re-check the licence page and write it here at the start of T.2** before using any file. Anything not CC0 is drawn by us in SVG.
- **Decided by James, 22 Oct 2026:** Termite replaces Hornet (15.4); real planet names (15.5); **marking = batched with the jump, laser rounds answered one at a time for instant feedback** (15.7, about 17 requests a pupil a day).

### Next
Stage T.1 (the engine and simulator): James said start (22 Oct).

## 16. Stage T.1 results (22 Oct 2026): the engine and the simulator

Built on branch `trader`, in `shared/trader/` (pure rules, whole numbers only, no outside code), plus `scripts/trader-sim.mjs` and one line in `package.json` (`npm run trader:sim`). **Nothing is live, nothing is saved, no database, function or screen yet.**

### What's there
| File | What it does |
|---|---|
| `config.ts` | Every tuning number (goods, 9 governments, 6 ships, gear, encounters, loans, discounts) |
| `galaxy.ts` | 24 real-named planets on a 20 × 20 grid from a seed; "across + up" distance; throws away a galaxy where a planet is out of reach of a Flea or there are too few shipyards |
| `market.ts` | The original's price rule, events, stock; same answer for the same seed, planet and day |
| `state.ts` | The trader (ship, cargo, fuel, hull, loan) and every action: buy, sell, refuel, repair, ships, lasers, shields, pods, moon, borrow, repay, new day, jump |
| `encounter.ts` | One roll per jump (junk, customs, pirates, friendly trader), customs and junk results |
| `fight.ts` | Turn-based pirate fight (charge / shield / flee), escape pod after a wreck |
| `bot.ts`, `sim.ts` | A bot trader that sees tomorrow's prices (so it is a ceiling) and a "sloppy" setting to act like a pupil learning |
| `trader.test.ts` | 19 tests: galaxy, prices, trading, bank, encounters, fights, a whole repeatable game |

### Numbers changed by the simulator (provisional; replaces 15.1 and 15.4 where they differ)
First tries bought the moon on **day 4** (perfect bot). Fixes, in order:
1. **Rarer supply of dear goods:** stock per medium planet Water 60, Furs 30, Food 40, Ore 25, Games 20, Fireworks 6, Medicine 8, Machines 6, Lollies 3, Robots 2 (the original caps Robots and Narcotics the same way, so one lucky load can't win the season).
2. **Ships and gear ÷ 25, not ÷ 50:** Gnat 400, Firefly 1,000, Bumblebee 2,400, Beetle 3,200, Termite 9,000; pulse / beam / military laser 80 / 500 / 1,400; energy / reflective shield 200 / 800; cargo pod 100.
3. **Moon 20,000** (2.2 × the Termite, the same ratio as the original's moon to its 225,000 ship). 
4. **Gentler price swings than the original:** a wanted good +20% (was +33%), a cheap resource −15% (was −25%), a dear resource +18% (was +33%), an event +30% (was +50%), buying costs 9% more than selling (was 3 to 13%). Fuel is in tenths of a credit per square (Flea 0.5 up to Termite 1.5).

### Results (100 bot games each, 60 days, 10 jumps a day, 70% of focus answers right)
| Bot | Moon bought | Moon day (10th / median / 90th) | Credits at end of day 1 / 3 / 8 |
|---|---|---|---|
| Careful (sees every price) | 100% | 10 / **14** / 19 | 547 / 1,524 / 6,953 |
| Sloppy 40% of trips | 100% | 13 / **15** / 20 | 426 / 1,233 / 5,979 |
| Sloppy 70% of trips | 100% | 14 / **17** / 23 | 433 / 1,233 / 5,154 |

- A pupil is slower than any of these (they can't see tomorrow's prices, they skip days, they make mistakes), so the target of "most pupils buy the moon in week 4 or 5 (day 16–25)" looks about right, and **the careful bot is at day 14, a ceiling, not a typical pupil**. Real data from the class trial (stage T.3) is the real test; the moon price is one number in `config.ts`.
- A run is about 136 to 175 jumps; 96 to 98% of jumps make money (as an average bot would); pirate fights are about 1 jump in 7, won 55 to 62% by the bot; **about 0.4 to 0.5 wrecks per whole game** (you lose cargo and ship, keep money, get a free Flea). That feels about right for a "bad luck" moment and not a season-ender. Customs fines are 0 because a bot never carries banned goods; a pupil will.
- Credits at the end of day 1: about 430 to 550 from 100. That is fast for the first day. If the first day should end nearer 250, cut the early stock or raise the Flea's fuel price; **my pick is to leave it and let the first day feel rewarding.**
- Tests: 19 for Star Trader, all pass; whole-project typecheck is clean. Full `test:all`, build and database tests are for T.3 when there is something to build or a database.

### Not built yet / untested
- Nothing in the browser: no screens, no maths questions wired in (the engine takes "was the answer right?" as a yes/no), no preview. That is T.2.
- No shared market pressure from other pupils' trades, no events beyond the per-planet daily ones, no contracts, beacons or station (T.4, T.5).
- Weapon and shield effects in fights are simple (laser power and shield points). The pupil-facing balance of fights, and whether the first Flea (no lasers, flee only) is fun, needs a human to try it in T.2's preview.
- The bot never uses the bank, never buys cargo pods, and never meets a customs fine. Those paths are covered by the unit tests, not the simulator.

### Questions for James
1. **Moon at 20,000** (was 10,000 in the plan): OK? The simulator needed ships and the moon to be dearer; the moon is still the biggest thing to save for.
2. **Start T.2** (the screens and a phone preview for you to try)?

## 17. Graphics bar for T.2 (James, 22 Oct 2026: "on par with the Archery game")

Same approach as Archery Challenge (`docs/ARCHERY-PLAN.md` section 10): **2D canvas, all art drawn in code, no pictures from anywhere, no new libraries** (so no Kenney download and no licence question).

- **Space with depth:** 3 starfield layers that drift with the camera, twinkling, and a nebula sky tinted per planet, drawn once to off-screen canvases.
- **Planets that look like planets:** drawn from a planet's tech, government and resource: rocky, ocean, ice, desert, lava and gas giants (banded), with continents or bands that slowly turn, clouds, an atmosphere glow, a day/night edge, city lights on high-tech worlds and rings on some. Real names are used; the look is ours.
- **Ships with character:** the six player ships and three pirate kinds drawn in parts (hull, wings, cockpit, engines) with an engine flame, damage smoke, and a docked/flying/warp pose.
- **Effects worth watching:** a warp jump with streaking stars and a flash, laser bolts, shield ripples, hit sparks, explosions, escape-pod flash, cargo crates tumbling when pirates grab them.
- **Chromebook-safe:** fixed-step loop with drawing blended between steps, canvas sized for the screen's pixel density (capped at 1.5), a particle cap, **automatic simpler graphics** when frames are slow, and a reduced-motion mode (still stars, no shake, gentle effects), as in Archery.
- **Screens:** a full-screen "cockpit" with the animated scene behind dark, high-contrast panels (4.5:1), 44 px targets, keyboard and touch, checked at 1366 × 640 and 844 × 390.

## 18. Stage T.2 results (22 Oct 2026): the screens and a phone preview

Built on branch `trader`. **Nothing is live, nothing is saved, no database or server function yet.** The game runs entirely in the browser on the shared rules; its maths questions are made and marked in the browser for a pretend pupil.

### What's there (all in the game's own folders)
| Where | What |
|---|---|
| `src/games/trader/art/` | `space.ts` (nebula + 3 twinkling, drifting star layers), `planets.ts` (24 planets drawn to look like their real namesakes: bands, rings, craters, ice, volcanoes, clouds, polar caps, city lights, atmosphere glow, slowly turning), `ships.ts` (6 trader ships and 3 pirates; lit hulls, engine pods, flames, windows, panel lines; pirates have glowing red eyes, fangs, horns, a skull prow, a dark aura; no blood), `fx.ts` (sparks, smoke, explosions, laser bolts, shield ripples, tumbling crates) |
| `renderer.ts`, `SpaceCanvas.tsx` | One full-screen canvas: planet scene, warp jump, pirate fight (shots, shields, wrecks, fleeing, robbery). Automatic simpler graphics when slow, "less movement" mode |
| `TraderGame.tsx` | The cockpit: top strip (credits, fuel, hull, jumps left), tabs, title screen, jump flow, junk, customs, friendly traders, the fight, the moon |
| `Panels.tsx` | Market (buy/sell steppers, "cheap/dear here" tags from the galaxy average, running totals), Ship (fuel, repair, 5 ships with pictures, lasers, shields, pods, the moon), Bank |
| `StarMap.tsx` | The star chart: 20 × 20 grid, diamond showing how far your fuel reaches, planet pictures, an across-then-up route, a fuel sum the pupil can count and check ("Show me"); a wrong sum never blocks the jump |
| `Encounter.tsx`, `Ask.tsx`, `api.ts` | Encounter panels; every maths check opens the hub's own question box (`QuestionModal`) from the pupil's focus via `makeFocusPack`. Right = small discount (1% / 2% on big trades) or a full laser shot; wrong or "No thanks" = nothing lost |
| `tradePlan.ts` | A trade plan (sells first, then buys) run through the shared rules, so the screen shows what the server will work out |
| `trader.css`, `prefs.ts`, `text.ts` | Styles (`.st-` prefix, shared dark panels at 4.5:1 or better, 44 px targets), the pupil's picture settings, true planet facts and kid-worded text |
| `preview/trader/`, `vite.trader-preview.config.ts` | The preview (`npm run trader:preview`), with test tools (pretend credits, pretend tomorrow, any ship fitted, any pirates) and two picture pages (`art.html`, `ships.html`). Never calls the live server |

Preview for James (private, one page): https://claude.ai/artifact/HmwsFd6Eph9D7YDPLZMtYo . One-file build: `TRADER_INLINE=1 npx vite build --config vite.trader-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-trader star-trader-test-page.html`.

### Decisions this stage
- Fight and warp are drawn on the canvas; the maths box is the hub's, so every kind of ladder question already shows and is spoken.
- A trade asks a question when it is 150 credits or more, or on about 1 trade in 3. Config numbers, not code.
- `acceptDeal` now refuses a friendly trader's load that doesn't fit the hold (found while wiring the screen).
- The preview's maths is the ladder's first (times-table) questions for a pretend pupil; the real game uses the pupil's own focus (T.3).
- Still on the dashboard? No: not in `registry.ts` yet (T.6).

### Tests
`npx vitest run src/games/trader shared/trader`: 29 pass (19 rules, 5 trade plan, 5 screen: title to market, button names, buying with the right money, star chart jump with a warp and the working shown, a wrong fuel sum not blocking). `tsc --noEmit` is clean. Checked by eye in Chromium at 1366 × 640 and 844 × 390 (title, market, star chart, fight with the maths box). Full `test:all`, build and the accessibility test are for T.6.

### Not done / untested
- No sound yet (T.6). No How to play (T.6). No Accessibility test file or contrast check by code yet (T.6).
- Only checked in Chromium; WebKit (iPad/Safari) and a real Chromebook not yet.
- The fight panel is squeezed on short screens; the ships stay in view, but the 844 × 390 phone fight screen wants a human look.
- Market table scrolls on short screens (10 rows).
- Pirate fights, shields and shots are tuned only by the T.1 simulator; whether the Flea (no laser: shield or run) is fun needs a human.

### Next
James tries the preview. Then T.3 (saving: migration, the `trader` function, loans, daily jumps, questions kept on the server). Nothing is applied or deployed without his words.

### Change after James tried the chart (22 Oct 2026): real coordinates, origin in the middle
James asked for the destination's coordinates and for 0, 0 in the middle with x and y from −10 to +10. Done: the grid is now **21 lines each way** (−10 to +10) with planets on the crossing points (`GRID_SIZE` 21, `GRID_HALF` 10; `chartPoint()` and `coordText()` in `shared/trader/galaxy.ts`; y points up). Every planet shows its coordinates on the chart (always for the one you pick and the one you are at), in the top strip, and in screen-reader names. The fuel sum is now worked from the two sets of coordinates ("x goes from 2 to 4, which is 2. y goes from −6 to 1, which is 7. 2 + 7 = 9 fuel"), which brings in negative numbers; the answer is still just across + up, a wrong guess still never blocks the jump, and it is still not recorded to the maths ladder. The simulator is unchanged in feel (careful bot: moon on day 13 median; sloppy 40%: 15; sloppy 70%: 17). 30 tests pass.

### Change 2 (22 Oct 2026): type the coordinates to jump, no counting
James: kids should not count squares; they should type the coordinates of where they want to go, and the maths learning comes from that. **The fuel sum is gone** (it replaces section 5's "work out the fuel" puzzle and the "Show me" button). Now:
- The jump box takes **x** and **y** (each −10 to +10, with a ± button because a phone's number keypad often has no minus). The pupil reads a planet's place off the chart or its card (tapping a planet shows its facts and coordinates but does not fill the boxes in) and types it.
- The chart shows **where the typed point lands** (dashed lines in from the axes and a crosshair), and rings the planet if there is one. The game names it, works out the fuel and shows "It needs 9 fuel; you have 20". The pupil is never asked to calculate fuel.
- An empty spot, or a number outside −10 to 10, says so in plain words and does not jump. If the pupil has tapped a planet to read about it, the message says whether to **check x or check y** for that planet.
- The learning: reading and plotting coordinates in all four quarters (negatives), x before y, and matching a point on the chart to a pair of numbers. Not recorded to the maths ladder (no ladder skill covers it); a record of how often a pupil needs a second try could be kept privately later if James wants it.
- Tests: 31 pass (typing coordinates jumps; an empty spot, a wrong number and which-number-to-check; the ± button).

## 19. Stage T.3 results (22 Oct 2026): saving and fairness

Built on branch `trader`. **Nothing is applied, deployed, merged or switched on.** The code switch (`src/games/trader/switch.ts`) is `false`, so the hub shows no Star Trader card; the card line in `registry.ts` is in, behind that switch. Migration number used: **`20261031000100`** (re-check with `node scripts/migration-numbers.mjs` at go-live).

### How it works (the server is the boss)
- **The server keeps each pupil's game** (`trader_games`: ship, cargo, money, fuel, loan, jumps left, and any one thing in progress: space junk, a trader's offer, or a pirate fight) with a **version number**. Every request carries the version it was made from and a request id: sent twice it counts once (the first reply is sent again); made from an old version (another tab or device) it is refused with a hint to reload. A pirate fight in progress is kept on the server, so a reload or a new device picks it up.
- **The server works out every move** with the shared rules (`shared/trader/server.ts`): trades (selling first), fuel, repairs, shipyard, bank, the moon, jumps, the encounter for each jump (the same seed gives the same encounter), fight rounds, space junk, friendly traders. A batch of moves is **all or nothing**, and a refused request never uses up a question.
- **Maths** (way A, from the pupil's own focus): the server makes today's 40 questions the first time the pupil plays that day (`trader_days`, which pupils can't read), sends them without answers, and they are used **strictly in order**; each answer is marked by the server, recorded for the maths ladder with `recordMathsAnswers` (once per question), and a right answer gives the 1% / 2% discount. The pupil can say "No thanks" and lose nothing. With maths off for the class there are no questions and lasers always fire at full power.
- **Requests** (the plan's pick, 22 Oct): quiet moves (fuel, repairs, the shipyard, the bank, a trade with no check) wait in a queue on the screen, shown at once using the same shared rules, and are sent together with the next trade that has a check, the next jump, the moon, after 30 seconds, or when the page is hidden or closed. Each laser round, junk steer and trader's offer is its own request (instant feedback where it matters). About **15 to 20 requests a pupil a day**.
- **A new day** (New Zealand midnight) brings the jumps back (the teacher's number, 1 to 30, default 10), reads the prices again, adds any weekly loan interest, gives a new question list, and drops a half-finished event.
- **The school's galaxy:** `trader_schools` gives each school one seed (so the whole school talks about the same galaxy); a New Season gives it a new one and clears the games, **keeping the Moon Owners list** (`trader_moons`).

### What was added
| Where | What |
|---|---|
| `shared/trader/server.ts`, `plan.ts`, `questions.ts` | The server's rules (also run by the screens), the trade plan (moved here from the screens), the day's questions |
| `supabase/migrations/20261031000100_trader.sql` | Teacher switches on `app_settings` (`trader_enabled` OFF, `trader_jumps`, `trader_loans`, `trader_maths`) with `teacher_set_trader()`, `teacher_reset_trader()`; tables `trader_schools`, `trader_games`, `trader_days`, `trader_requests`, `trader_moons` (all closed to pupils: row security on, no policy, no grant); the server's functions (`trader_save` with the version check and the answers saved in the same step); the `hub_games` hooks (switch, New Season, last played). No shared function re-created. No points or achievements yet (T.5) |
| `supabase/functions/trader/` | `handler.ts` (load, act, fight, junk, deal), `entry.ts`, `index.ts` (generated), `handler.test.ts` |
| `src/data/trader.ts` | The transport, `traderApi` (one retry with the same request id), settings reads and saves |
| `src/games/trader/trialBackend.ts` | The preview's pretend database: runs the REAL server function logic in the browser, so the preview behaves exactly like the real game |
| `src/games/trader/TraderGame.tsx` and panels | The game now plays through the server: queue and flush, the fight and junk and deal as server requests, loading and "not switched on" screens |
| `src/games/trader/index.tsx`, `switch.ts`, `TraderPlay.tsx`, `src/pages/TeacherTrader.tsx` | The hub card (off), the page, the teacher panel (on/off, jumps a day, bank, maths) and a per-student "reset this ship" |
| `supabase/tests/database/trader.test.sql`, `security.test.sql` | 35 database checks; the two teacher functions added to the security list |

### Tests
- `shared/trader`: 40 (rules, plan, the server's moves). `supabase/functions/trader/handler.test.ts`: 14 (sign-in, switch off, opening a game, a trade applied once, refused moves keep nothing and use no question, marking and recording, old versions refused, a new day, parsing, the New Zealand day, the built file up to date). `src/games/trader`: 13 (screens against the real server logic). Database: 35 pass on a scratch copy built from `main`'s migrations plus this one; `game_hooks`, `progress_access`, `archery_hub`, `security` also pass there (security's one remaining error, "no partition of relation messages", is the known copy-only one).
- **Whole project:** `npm run test:all` 262 files, 4,821 tests pass (1 skipped as before); typecheck clean; build succeeds.

### Not done / untested
- Not tried with the real school server, a real sign-in, or two devices at once (the version check is tested, not tried live).
- The Flea-with-no-laser fight, balance on real pupils, and how the 30-second queue feels on a flaky connection need a human.
- Points, achievements, the board, the Moon Owners screen, contracts, beacons, the station: T.4 and T.5. How to play, sound, the accessibility test: T.6.
- **Go-live list (T.7, each step only on James's word):** apply migration `20261031000100` (check the number first); deploy `trader` (`--no-verify-jwt --use-api`; unsigned curl must answer a 401 message); check from outside (pupils get 42501 on every `trader_` table and function); set the code switch `ON = true`; merge; try as a teacher with the class switch off, then on.

## 20. Stage T.4 results (22 Oct 2026): the school's shared market and news

Built on branch `trader`. **Nothing is applied, deployed, merged or switched on.** New migration: **`20261031000200_trader_market.sql`** (was `20261022001100`, renumbered 27 Oct 2026 because main's question-skips switch took that number, then `20261027000100`; on 31 Oct 2026 both trader migrations moved after everything on `main`: T.3's to `20261031000100`, this one to `20261031000200`; re-check at go-live). Comes after T.3's `20261031000100`, which is not edited.

### How it works
- **One market per school** (`trader_markets`: school, planet, good → how far the price is pushed, how far it moved today, the day it last changed). Selling pushes a price down and buying pushes it up. A normal day's stock of a good is a "full" push (`MARKET_FULL_STOCK_BP`, 25%), so dear goods with small stock move more per unit.
- **The market is as deep as the school is big** (new; found by the simulator, see below): each pupil's push is divided by the number of pupils who played in the last 7 days (at least 5). A whole school moves a price about as much as one pupil alone would, so school size doesn't decide how rich pupils get, and a price only moves a lot when a big share of the school piles into the same trade.
- **A quiet zone** (new; `MARKET_QUIET_BP`, 12%): the first 12% of a push doesn't change the price. Ordinary trading spread over the galaxy leaves prices alone; only pile-ups move them.
- **Guard rails, as James decided:** one pupil moves a price at one planet by at most 20% a day (kept in the pupil's own saved game as `pushed`, saved in the same step as the trade; with the depth this is 20% in a school of 5 or fewer and less in bigger ones); a price stays within 50% of normal however many trade (applied in the database in one step).
- **Drift back overnight is worked out on read** from the day a row last changed: a push keeps 25% each night (`MARKET_KEEP_PCT`), i.e. three quarters of the way back. **Changed from "halfway"**: with halfway, a crowded price stayed low for days and a herd of pupils lost much more (only 42% reached the moon by day 30).
- **Your price is fixed when you land** (already true from T.3): the landing prices are read with the school's push on load (new game, new day) and on each jump, and kept in the game for the visit.
- **Busy moments:** each push is one `insert … on conflict do update` per row, inside `trader_save` (the same step as the game save, and only after the version check passes), rows locked in the same order (planet, good) every time so two requests can't block each other. A request sent twice is answered from `trader_requests` and never pushes twice. Numbers are stored in hundredths of a hundredth of a percent so small pushes in a big school aren't rounded away.
- **News** (`trader_news`, plus `shared/trader/news.ts`): a row is written when a price moves 15% or more in a day. The lines say "Lots of traders sold Water on Mars, so it's cheap there today", "Robots are still dear on Io after lots of buying yesterday", and the planets' events ("Mars: A drought has dried things up, so Water is dear."). Nobody is ever named: the database only knows how far a price moved. Shown on the market screen (this planet's lines, plus a "School news" list) and on a planet's star chart card. Goods whose price the school has moved get a "📉 lots sold" / "📈 lots bought" tag.
- **New Season** clears the school's market and news (`trader_season` re-made with `create or replace` in the new migration; the `hub_games` row is unchanged).
- **Stock stays per pupil per visit** (James's open question about shared stock: not built).

### Numbers chosen (simulator, `npm run trader:sim -- --school 28,60,100 --info none|news|all --play 0.85 --seeds 4`)
Bots now have their own tastes (so a class doesn't all pick the very same trip) and three levels of knowledge: `none` (only normal prices: a herd), `news` (normal prices plus the moves the news reports), `all` (every school price). Pupils play 85% of days. Moon day median / share by day 30:

| | alone (no shared market) | 28 pupils | 60 | 100 |
|---|---|---|---|---|
| herd (`none`) | 17.5 / 99% | 22.0 / 92% | 22.0 / 93% | 21.8 / 91% |
| reads the news | 17.5 / 99% | 20.5 / 97% | 20.0 / 98% | 19.8 / 96% |
| knows every price | 17.5 / 99% | 19.5 / 97% | 19.8 / 98% | 19.5 / 97% |

- About 7 news lines a day; no price reached the 50% limit; the biggest moves were 32 to 38%. School size makes no difference (the depth). Reading the news pays, which is the lesson.
- **What didn't work first**, so nobody tries it again: with the plan's straight numbers (no depth, no quiet zone), 28 herding pupils all went broke and well-informed ones bought the moon by day 6 to 8 by selling into prices other pupils had pushed up; even very gentle pushes either did nothing or ate half of every pupil's profit. Profit in this economy lives in thin gaps between planets, so many traders close them; the depth and quiet zone keep that gentle.
- **Solo numbers from T.1 unchanged** (`npm run trader:sim -- --games 100 --days 60`): careful bot moon day 13, sloppy 30% day 14, sloppy 60% day 17.

### Requests (`docs/SERVER-LOAD-PLAN.md`: fewer requests, and beware a whole class pressing the same button)
- **No new pupil requests.** The news and landing prices ride on the load and jump replies; a trade's push rides on the save it already made. Still about **15 to 20 requests a pupil a day** (T.3's count).
- **Database work inside them:** one extra small read (`trader_market`, at most 240 rows for the school) on each load and jump that is about 11 a pupil a day; a trade's save adds one count of the school's games this week (indexed) and one row update per good traded. A class all opening the game at once costs one extra read each; a class all selling the same good on the same planet waits on one row for well under a millisecond each.

### Tests
- `shared/trader`: 45 (15 new: drift, quiet zone, pupil limit, depth, cap, news rows, landing prices fixed, news wording, a busy lunchtime, the school simulator). `supabase/functions/trader`: 18 (4 new: a trade pushes once even when sent twice, refused requests push nothing, a jump lands at the school's prices with the news, a new day reads drifted prices, the market can't be read → normal prices). `src/games/trader`: 14 (1 new: the news and the moved-price tag on screen).
- Database (scratch copy, then dropped): new `trader_market.test.sql` 26 pass (pupils get 42501 on both tables and all three functions; one push per save, none for a refused or repeated one; depth; cap; news; drift numbers match the browser's; each school separate; New Season clears it). `trader.test.sql` 35, `game_hooks` 38 pass; `security` has its known copy-only error only.
- Whole project: `npm run test:all` 263 files, 4,844 pass (1 skipped as before); typecheck clean; build succeeds. `trader/index.ts` rebuilt.
- Preview: "Busy lunchtime (30 classmates)" in Preview tools runs 30 pretend classmates through a day on the school market; checked in Chromium (news appears, no errors). Published to the same private Artifact.

### Not done / untested
- Not tried with the real database under a real class (row locking is reasoned, not load-tested).
- **Found while James tried the preview (22 Oct):** a pupil can't see what other planets pay, so they can't find a profitable trip (the bots could). Needs a decision before T.5; see below.
- Go-live additions for T.7: apply `20261031000200` after `20261031000100`; deploy `trader`; check pupils get 42501 on `trader_markets`, `trader_news`, `trader_market()`.

### Change after James tried T.4 (22 Oct 2026): what other planets pay
James couldn't find a profit: nothing showed what other planets pay (the simulator's bots could see every price). **He chose two fixes**, both built:
1. **A planet's prices on its star chart card**: "They pay", "Buy here" and "Profit each" for every good (`shared/trader/priceGuide.ts`, `PriceList` in `StarMap.tsx`).
2. **"Sells best" on each good in the market**: the planet within a full tank's reach that pays most today, and "+N each" when that beats the price here.
Both use today's prices with the school's market, so the server now also sends the school's pushes (`prices`: [planet, good, push]) in the load and jump replies it already sends; still no new requests. A note on the card says prices can change before you land. Also fixed an older phone bug: the top strip wrapped onto two rows and covered the tabs at phone width. Tests: 3 new (best price within reach and at least one profitable trade from the start; school pushes included; the screen shows the hint and the card's price list); 80 Star Trader tests and the whole project pass (two space-game screen tests timed out once under load and pass alone).

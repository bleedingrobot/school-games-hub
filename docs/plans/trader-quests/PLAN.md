# Star Trader quests: plan

21 Nov 2026. James: "I want to plan some in game quests for Star Trader. A quests tab; a character wants to plan a party and you have to pick up the things they need from different planets; a currency reward at the end. Others might be defending planets from pirates, gathering robots from different places. The quests should make it very clear where to go. Plan 5 different quests, use different voices and make stories for them with the gaming computer."

**Status:** plan, stories and all 32 paintings done (#683), voices sampled (review page https://claude.ai/artifact/H1iYrYmdLjfDMqs4Ws8din). Q.0 done: no more reshuffle (migration 20261121000400_trader_keep_galaxy.sql). Q.1 done: the quest rules on the server (`shared/trader/quests.ts`, moves `quest-take`, `quest-pickup`, `quest-deliver`, `quest-drop`), no screens yet. Q.2 done: the Quests tab (key Q), step checklist, gold rings on the star chart, the jump line, the landing card, Bolt's next stop, gold quest boxes in the hold, Quest complete moment, and a What's new line. Q.3 done: each quest's story plays in the giver's own voice when you take it (pages 1–3) and when you finish it (pages 4–5), the 📖 Quest stories shelf, and the quest board painting on the Quests tab. Q.4 done: Commander Vex's pirates are real fights on arrival (Navy laser lent, gentle losses, a win ticks the step) and Lumi's trail is map clues ("From here, go 3 right and 2 down.") with Show me. Q.5 done: the 🎒 Quest Log keepsakes (kept through a New Season), 2 hub points per finished quest, the Star Quest Master achievement and season trophy (migration 20261121000500_trader_quest_log.sql), What's new line. Q.6 done: 📦 Today's jobs, one or two small delivery jobs a day once all five quests are finished. **The quest plan is finished.** More story quests can be added later.

## 1. The short version

- A new **Quests** tab (key **Q**) beside Trade, Shop, Bank and Map. It shows five quest cards, each with its quest-giver's painted face.
- Taking a quest plays its **story** (3 painted pages, read in that character's own voice, always skippable). Finishing plays 2 more pages and pays the reward.
- **Where to go is never a puzzle** (except the star whale's optional clues). Every step names the planet, its coordinates, how far it is from you, and whether you have the fuel. Quest planets glow gold on the star map with the step number, and Bolt says the next stop.
- **The map stops being reshuffled each season** (James, 21 Nov 2026: "that could come out"). With one fixed map, each quest has **its own fixed planets**, so the stories and voices can name them ("fly to Juno") and a quest is the same for every pupil, who can help each other.
- **One quest at a time.** Drop it any time, no penalty; you can take it again later.
- Rewards are **credits** (300 to 800; a new captain starts with 100 and the moon costs 20,000) plus a little keepsake in the Quest Log.
- **No new maths.** The game's usual maths moments carry on (fuel, trades, laser rounds). The quests give a reason to fly somewhere new.
- The server is the boss: it picks the planets, checks each pick-up, and pays the reward. The browser only shows it.

## 2. The five quests

| # | Quest | Giver (voice) | Type | What you do | Reward |
|---|---|---|---|---|---|
| 1 | Grandma Zuzu's Big Party | Grandma Zuzu, four-armed purple grandma (Kokoro `bf_isabella`) | Collect | Pick up Star-berries (farm planet), Sparkle Candles (high-tech planet) and a Robot Band (robot planet), take them to Zuzu | 300 |
| 2 | Professor Sprocket's Runaway Robots | Professor Sprocket, wild-haired inventor (`bf_lily`) | Gather | Find Beep (desert planet), Boop (water world), Clank (mining planet) and Fizz (fireworks planet), bring them back to the lab | 400 |
| 3 | Dr Nettle and the Sneezles | Dr Nettle, plant-person doctor (`am_puck`) | Trade | **Buy** 5 Medicine and 10 Water at real markets, deliver to his planet. He pays a set price, well above what you spend | about 300 profit |
| 4 | Commander Vex and the Rust Raiders | Commander Vex, Star Navy (`bm_george`) | Defend | Chase off 3 pirate ships waiting at 3 planets around a peaceful garden planet, then report to Vex | 600 |
| 5 | Lumi the Little Star Whale | Ranger Kai, space ranger (`af_sky`) | Trail | Follow 4 clues ("from here, go 3 across and 2 down") to Lumi's family. **Show me** lights up the planet if you're stuck | 800 |

The stories (5 pages each, at most 35 words a page) are in [stories.json](stories.json). Pages 1 to 3 play when you take the quest, pages 4 and 5 when you finish. Once the map is fixed, the stories can name the planets; the steps always show names and coordinates too.

## 3. Rules for every quest

1. **Order.** My pick: quest 1 is open from the start; the next one opens when you finish the one before, **and at most one new quest a day**, so the five last about a week of play and there's something to come back for. (Question for James.)
2. **Steps can be done in any order**, except the last ("Take them to Zuzu"), which waits until the others are done.
3. **Fixed planets.** Each quest's planets are chosen once, by hand, on the fixed map: the right kind of planet (a Farming co-op for berries, a Robot council for the band), every stop within 12 fuel of the one before, the whole trip about 6 to 10 jumps, so a quest fits in one or two days of jumps (10 a day).
4. **Quest cargo** (berries, robots, the band) is free and takes one hold each. Hold full? The step says "Make room: 1 free hold needed", with a Sell button for something in the hold. Quest cargo can't be sold, dumped or stolen by pirates.
5. **On a quest planet**, a gold card pops up on landing: "Pick up the Star-berries for Grandma Zuzu" (one tap). The same card is on the Quests tab.
6. **Dr Nettle's goods are real goods** from the market (5 Medicine, 10 Water; fewer if your ship is small). The quest shows the three nearest planets that sell each and today's price there, and what Dr Nettle will pay, so the profit is plain to see. It opens 3rd, so pupils have money by then.
7. **Commander Vex's pirates** are a fight on arrival at each marked planet, using the normal fight (laser questions and all). Vex lends a **Navy laser** for the quest, so even a Flea (no weapon slots) can fight. Quest pirates are Scrappy pirates or Raiders, never Captains. If you lose, they don't take cargo; your ship is knocked about as usual and the pirate is still there to try again. Fleeing is allowed and doesn't count.
8. **Lumi's clues** are the one puzzle: each clue is a move from the planet you're on ("go 3 across and 2 down"). The planet is shown straight away if the pupil's "Off hides coordinates" setting is on, or after **Show me**. The clue is never marked or recorded.
9. **Drop a quest** any time from its card. Nothing is lost except the steps done.
10. **New Season** resets quests; the Quest Log keeps the keepsakes earned.
11. **Hub points:** 2 points for a finished quest, inside the daily cap, as for a delivered contract.

## 4. Making it clear where to go

James's main ask. Five places say it:

- **Quests tab:** the steps as a checklist. Each line: what, where, the planet's coordinates, "5 fuel from here" and a ⛽ warning if the tank is short. Done steps get a tick.
- **Star map:** quest planets get a gold ring and the step number. Tapping one shows the step.
- **Jump screen:** a gold line "Quest: next stop Zarkon (3, −4), 5 fuel". One tap sets it as the jump.
- **Bolt** (the coach) says the next stop when you land, and points at the gold planet.
- **Landing:** the gold pick-up card. Leaving a quest planet without picking up gets a gentle "You left Zuzu's candles behind" line.

## 5. Art and voices (done in this PR)

- **32 paintings** (the Star Quest Master trophy too) from the gaming PC ([docs/stories-art/trader-quests.json](../../stories-art/trader-quests.json)): a quest board, 5 giver portraits and 25 story pages, 2 tries each, the better one picked. Same storybook style as the Star Trader opening story.
- **Voices:** each giver has their own Kokoro voice (table in section 2). Built the same way as the stories narrator: one clip folder per giver, `public/voice/quest-<id>/`, and a `VOICE_FOR` line each in `scripts/voice-clips.py`. Samples are on the review page.

## 6. Stages

| Stage | What | Size |
|---|---|---|
| **Q.0** ✅ | Stop the season reshuffle: keep this season's map for good (New Season keeps the planets, resets ships and prices as now) | Small |
| **Q.1** ✅ | Rules and server: quest list in `shared/trader/quests.ts` (one config entry per quest, so more can be added later), each quest's fixed planets, quest state in the saved game, moves `quest-take`, `quest-pickup`, `quest-deliver`, `quest-drop`; tests | Medium |
| **Q.2** ✅ | Quests tab, step checklist, gold map rings, jump-screen line, landing card, Bolt lines, key Q | Medium |
| **Q.3** ✅ | Stories in StoryBook with each giver's voice, the 📖 shelf, paintings tidied into the game | Small |
| **Q.4** ✅ | Commander Vex's pirate fights (Navy laser, gentle losses) and Lumi's clue trail | Medium |
| **Q.5** ✅ | Quest Log keepsakes, Star Quest Master achievement and trophy (migration), What's new line, go live | Small |
| **Q.6** ✅ | Daily jobs after all five: one or two computer-made deliveries a day, small rewards | Small |

Each stage goes live on its own (switched on), like the other Star Trader stages.

### What Q.6 built (21 Nov 2026)

- **Jobs from a seed:** `makeJobs` in `shared/trader/quests.ts` makes 1–2 jobs from the pupil and the Star Trader day, so a reload gives the same jobs. The pick-up is within one tank of the ship; the delivery is 4 to two tanks further on (short trips, 1–3 jumps). Real goods, legal at both planets, sold at the pick-up and bought at the delivery planet; 2–5 crates, never more than the ship's holds.
- **Made on the server:** `withJobs` runs in the trader function's load path (after the new day) and after every move, so jobs appear as soon as the fifth quest is done. Saved in `quests.jobs` (day, list, done). No migration. A New Season clears the quests, so jobs stop until all five are done again.
- **Reuses the quest steps:** a job is a two-step quest (`job-0`, `job-1`): pick up free crates (gold boxes in the hold, can't be sold), then deliver. The checklist, gold rings, Bolt's next stop and landing card all work as for story quests. One quest or job at a time.
- **Small pay:** a little more than trading the same goods yourself (the price gap, plus 10 cr and 5 cr a crate). No hub points, keepsakes or trophy. An undone job just goes at the end of the day, with its crates, and no penalty.
- **Quests tab:** "📦 Today's jobs" below the finished quests, with Take job / Drop, pick-up and delivery links, and "All done for today. New jobs tomorrow!" Note "📦 Job done! +N credits from the Star Post." What's new line.

### What Q.5 built (21 Nov 2026)

- **Quest Log table:** `trader_quest_log` (pupil, quest, season), server only. `trader_save` compares the old and new saved game: each quest newly in `quests.finished` calls `trader_quest_finished` (wrapped, so a problem there never loses the save). A New Season clears `trader_games` but never the log.
- **Hub points:** 2 per finished quest through `add_game_points` (inside the shared daily cap, `once` per pupil, season and quest, so a repeated save earns once). Star Trader's only hub points. Point rules line "Finish a quest: 2 points."
- **Star Quest Master:** achievement `trader-quest-master` (measure `trader_quests`, distinct quests ever, kept through New Season) and trophy `trader-quest-master` (`repeat 'season'`: all five in one Star Trader season; bronze, then silver, then gold on later seasons). Painting `star-quest-master-{bronze,silver,gold}` in `src/avatar/art/trophies` (bronze and silver recoloured from the gold painting).
- **Back-award:** quests already finished went into the log with no points, with the achievement and trophy where all five were done.
- **Keepsakes:** the 🎒 Quest Log on the Quests tab, one per giver (Party balloon, Lucky gear, Healing leaf, Navy badge, Star-scale), shown with the giver's last story painting; "Not yet" slots for the rest; the Star Quest Master line when all five are in. The load reply has `questLog` (from `trader_quest_log_of`), joined with this season's finished quests.
- **Quest complete moment:** shows "+2 hub points" (real game only), the new keepsake and, for the fifth, the Star Quest Master line; the trophy line and achievement pop come from the server.
- **Preview:** the try-out keeps a pretend Quest Log (kept through restart and New Season), and a "Finish all quests" tool.
- **Tests:** folded into the Quests screen test; database checks in `supabase/tests/database/trader_quest_log.test.sql`.

### What Q.4 built (21 Nov 2026)

- **Vex's pirates are fights.** Arriving at a pirate step's planet starts a fight there instead of the jump's random encounter (server `jump`). The first two are Scrappy pirates, the third a Raider, never a Captain (`questPirateTier`). The step can't be tapped any more ("Chase off the pirate ship first."); only a win ticks it, and the server decides (`applyFight`, `pending.quest`).
- **Navy laser:** `NAVY_LASER` (power 25) is lent for each quest fight only (`Fight.lent`, `fightPower`), so even a Flea can fire. It is never in the ship's weapons and goes when the fight ends.
- **Gentle losses:** new fight outcome `'knocked'` (`Fight.gentle`): if the hull runs out or the pirate dodges till the last round, nothing is taken, the hull stays at least 1 and the pirate stays. Fleeing doesn't count either. Try again with the new move `quest-fight` (the red "⚔️ Fight them" card on the Trade screen, or the checklist button); each try is a new seeded fight. The first-time pirate tip is skipped in quest fights (it talks about losing cargo).
- **Lumi's clues:** `trailClue(galaxy, from, to)` gives the move on the real chart from where the ship is: "From here, go 6 right and 6 up." Ranger Kai's clue shows on the Trade screen (blue card), the Quests tab checklist and the star chart's quest line, and Bolt says it. The planet stays hidden (no ring, no name) until **Show me**, which rings it and opens it on the chart. With help Off (coordinates hidden) every step is shown straight away. What was revealed is kept in the browser only: clues are never marked or recorded. Arriving still ticks the step as before.
- **Server input:** `quest-fight` added to the trader function's action check (`handler.ts`, function rebuilt). No migration.
- **Preview tools:** "Open Vex's quest" and "Open Lumi's quest" (`tools.openQuest`) to try them without finishing the earlier quests.
- **Tests:** folded into the server quest test and the Quests screen test (budget still 12).

### What Q.3 built (21 Nov 2026)

- **Voices:** each giver has their own Kokoro clip folder `public/voice/quest-<id>/` (Zuzu bf_isabella, Sprocket bf_lily, Nettle am_puck, Vex bm_george, Kai af_sky), five `VOICE_FOR` lines in `scripts/voice-clips.py`, checked by `src/games/trader/voiceLines.test.ts` (voice tests are outside the budget).
- **Stories:** `QUEST_STORIES` and `questStoryPart(id, 'start' | 'end' | 'all')` in `src/games/trader/stories.ts`. They are kept out of `ALL_STORIES` (that list is narrated by am_michael) but go through the words checks in `src/games/stories.test.ts`.
- **Taking a quest** opens the kit StoryBook on pages 1–3, with the giver's face in the corner. Esc or Skip closes it, and then you land on the Quests tab.
- **Finishing a quest** plays pages 4–5, then the Quest complete moment. The reward still comes from the server's reply.
- **📖 Quest stories shelf** at the bottom of the Quests tab: "The story so far" (pages 1–3) for an open quest, "The whole story" (all 5) for a finished one. Locked quests show nothing.
- **Paintings:** the quest board is now the Quests tab header; giver faces and story pages use the -800 sizes on phones (srcSet). Nothing was removed: every painting is used except `trophy-quest-master`, which Q.5 needs.
- **Tests:** folded into the existing Quests screen test in `TraderGame.test.tsx` (budget still 12). The first trade test ("a trade is sent with the next jump") flakes now and then on the credits timing; it does on main too.

### What Q.2 built (21 Nov 2026)

- **Quests tab** (`QuestsPanel.tsx`, key Q): five cards with each giver's face, each done, your quest now, ready (Take quest), opens tomorrow or locked. The open quest's steps as a checklist: what, where, coordinates (hidden when Bolt is Off), fuel from here, a ⛽ line when the tank is short, ticks when done. Dr Nettle's steps show how many are in the hold, the three nearest sellers with today's price, and what he pays, so the profit is plain.
- **Words and choices** live in `questGuide.ts`: step lines and buttons, the landing line, the gentle "you left it behind" line, the next stop (for Dr Nettle's goods, the nearest market selling them), and `doableHere`, which builds every step that can be done here with the server's own `applyBatch`, so the gold card only offers what the server will take.
- **Star chart:** quest planets get a gold ring and their step numbers; a tapped one shows its steps. The jump line "Quest: next stop …, 5 fuel" sets x and y in one tap (with Bolt Off it shows the planet instead).
- **Landing:** a gold card on the Trade screen does every step here in one tap, sent to the server at once. Flying off without it gives a gentle note.
- **Bolt** says the step to do here, or the next stop (fill the tank first if short), unless cargo should be sold here first.
- **Hold:** quest cargo shows as gold ⭐ boxes after the goods, with a line saying it can't be sold.
- **Quest complete!** moment with the giver's face and the credits; says the next quest opens tomorrow.
- **Try-out:** `trialBackend` has `moveTo(planet)` and `toQuestStop()`; the preview has a "Go to the next quest stop" button.

### What Q.1 built (21 Nov 2026)

- **Planets from the galaxy.** Each step says what kind of planet it wants, best first (berries: Farming co-op, then rich soil, then low tech). `questPlanets(galaxy)` picks the best set where every stop is within 12 fuel of the one before and no planet is used twice in a quest (planets used by an earlier quest count a little against). Same galaxy, same planets. On 300 test galaxies every stop is within 12 fuel, and most steps get their first wish.
- **Trip length.** With every stop at most 12 fuel apart, each stop is one jump for any ship, so a quest is 3 to 5 stops (15 to 46 fuel in all), plus the flight to the first stop and back to refuel. That fits easily in one day's 10 jumps; the "6 to 10 jumps" in rule 3 was a guess before the 12-fuel rule.
- **Vex:** the garden (Peace garden first) is picked first and the 3 pirate planets all wait within 12 fuel of it; you report to Vex at the garden. **Dr Nettle:** his planet can't make Medicine itself but has a Medicine market within 12 fuel. **Lumi:** the trail goes in order (the only quest that does); for now each clue is "arrive and tap" (Q.4 adds the clues and fights).
- **Quest cargo** is kept as its own count on the ship (`questCargo`): it fills holds but isn't in the market goods, so it can't be sold, dumped, fined or taken.
- **Dr Nettle** pays 100 for each Medicine and 15 for each Water: 650 for 5 + 10 (about 300 more than they cost), or 405 for 3 + 7 on a ship with under 15 holds (decided when the quest is taken).
- **Hub points:** Star Trader has never given hub points, so there is nowhere to add them yet. The reply says `points: 2` with the finished quest; Q.5's migration adds them to the shared cap.

## 7. Later, if pupils like it

- More quests are one config entry, 5 story pages, 6 paintings and a voice each.
- After all five, small **daily jobs** made by the computer ("Take 3 crates of Games to Vela for 120") so the tab never runs dry.
- A class quest link: a teacher's class quest could be "finish a Star Trader quest".

## 8. James's answers (21 Nov 2026)

1. **Order:** one at a time, in order; the next opens when you finish the one before, at most one new quest a day.
2. **Rewards:** keep 300 to 800 (Zuzu 300, Sprocket 400, Nettle about 300 profit, Vex 600, Lumi 800).
3. **After all five:** small daily delivery jobs made by the computer, so the tab never runs dry (stage Q.6). More story quests added later.
4. **All five done:** a "Star Quest Master" achievement (James renamed it, 21 Nov) and a painted trophy on the profile (migration in Q.5; trophy painting added to the art list).
5. **Map:** stop the season reshuffle (Q.0).

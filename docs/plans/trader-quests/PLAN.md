# Star Trader quests: plan

21 Nov 2026. James: "I want to plan some in game quests for Star Trader. A quests tab; a character wants to plan a party and you have to pick up the things they need from different planets; a currency reward at the end. Others might be defending planets from pirates, gathering robots from different places. The quests should make it very clear where to go. Plan 5 different quests, use different voices and make stories for them with the gaming computer."

**Status:** plan, stories and all 32 paintings done (this PR), voices sampled (review page https://claude.ai/artifact/H1iYrYmdLjfDMqs4Ws8din). Nothing built in the game yet. Next: Q.0.

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
| **Q.0** | Stop the season reshuffle: keep this season's map for good (New Season keeps the planets, resets ships and prices as now) | Small |
| **Q.1** | Rules and server: quest list in `shared/trader/quests.ts` (one config entry per quest, so more can be added later), each quest's fixed planets, quest state in the saved game, moves `quest-take`, `quest-pickup`, `quest-deliver`, `quest-drop`; tests | Medium |
| **Q.2** | Quests tab, step checklist, gold map rings, jump-screen line, landing card, Bolt lines, key Q | Medium |
| **Q.3** | Stories in StoryBook with each giver's voice, the 📖 shelf, paintings tidied into the game | Small |
| **Q.4** | Commander Vex's pirate fights (Navy laser, gentle losses) and Lumi's clue trail | Medium |
| **Q.5** | Quest Log keepsakes, Star Quest Master achievement and trophy (migration), What's new line, go live | Small |
| **Q.6** | Daily jobs after all five: one or two computer-made deliveries a day, small rewards | Small |

Each stage goes live on its own (switched on), like the other Star Trader stages.

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

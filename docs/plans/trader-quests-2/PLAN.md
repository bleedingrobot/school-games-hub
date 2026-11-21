# Star Trader quests 6 to 10: plan

22 Nov 2026. James: "can we plan another set of 5 quests for star traders please, should unlock after the first 5 are completed." He agreed to the plan below as drafted ("Yes, go ahead"), with the picks in section 7.

**Status:** plan, stories and all 31 paintings done (this PR), voices sampled (review page https://claude.ai/artifact/8fQgUpWKwJ4CKNKFQ6caAn). Nothing in the game yet: stages R.1 to R.4 below.

The first five quests are in [../trader-quests/PLAN.md](../trader-quests/PLAN.md). Everything there still holds (fixed planets, one quest at a time, gold rings, Bolt's next stop, gentle fights, drop any time); this plan only says what is new.

## 1. The short version

- **Five more quests**, numbered 6 to 10, on the same Quests tab, under a second heading **"More quests"**.
- **Quest 6 opens the day after quest 5 (Lumi) is finished**, then one at a time, in order, at most one new quest a day, as before.
- **Today's jobs keep going** from the day all of the first five are done, whether or not quests 6 to 10 are done. A job and a quest are still never open together.
- Each quest reuses the quest parts already built and adds **one new twist**: sharing goods out, a fuel-planning race, and a Captain-sized boss fight.
- Rewards **900 to 1,500** credits (5,700 for all five; the moon is 20,000), a keepsake each and 2 hub points each.
- **Star Quest Legend:** a new achievement and season trophy for all ten.

## 2. The five quests

| # | Quest | Giver (voice) | Type | What you do | Reward |
|---|---|---|---|---|---|
| 6 | Mayor Puddle and the Big Dry | Mayor Puddle, frog-person mayor (Kokoro `am_eric`) | Relief | Buy 12 Water anywhere, then hand 4 to each of 3 dry planets (3 each on a ship under 15 holds) | 900 |
| 7 | Chef Gorbo's Galaxy Feast | Chef Gorbo, pear-shaped orange space chef (`am_onyx`) | Collect + trade | Pick up a Moon-melon and Comet Cheese (the cheese on a pirate-ish planet), buy 5 Food and 3 Lollies, take it all to Gorbo's planet | about 1,000 |
| 8 | The Comet Cup | Zip Zoomer, race announcer (`am_fenrir`) | Race | From the start line, fly through 4 checkpoints in order **on one tank**: buying fuel after the start line puts you back to the start | 1,100 |
| 9 | Pip and Pop's Runaway Pets | Pip and Pop, alien twins (`af_nicole` and `af_bella`, a page each) | Gather + defend | Pick up Fluff, Splodge and Zoom from animal-ish planets; win Wiggles back from a pirate (a fight, like Vex's), then home to the twins | 1,200 |
| 10 | Captain Sable's Lost Treasure | Captain Sable, retired pirate queen (`bf_emma`) | Trail + boss | Follow 3 map clues like Lumi's (Show me if stuck), then beat Rust-Beard (a Captain pirate, gentle loss) at the treasure planet | 1,500 |

The stories (5 pages each, under 30 words a page) are in [stories.json](stories.json). Pages 1 to 3 play when you take the quest, 4 and 5 when you finish, as for the first five.

## 3. What's new in the rules

1. **Order.** `QUESTS` gets the five new entries after Lumi, so `nextQuest` opens them in order, one a day. A teacher can still take any quest in any order (#705).
2. **Jobs stay on.** `allQuestsDone` becomes "the first five are done" (a `FIRST_SET` of ids), so today's jobs don't stop when quest 6 opens. Star Quest Master stays "the first five".
3. **Quest 6, handing out goods (new):** a `buy-deliver` step with its own planet (`hands: true`), so Water is handed over at each dry planet, not at the giver's. The step shows "4 Water here (you have 12)". Mayor Puddle pays a set 900, so buying the water is part of the cost; he's at the last dry planet, and the three dry planets are within 12 fuel of each other, preferring desert and lifeless planets.
4. **Quest 7:** the existing pick-up and buy-deliver steps together. The cheese prefers a Pirate haven or Farming co-op (pirates 6 or more), so there's a little pirate risk on the way there (the cheese itself is quest cargo, so pirates can't take it). Gorbo pays 120 a Food and 60 a Lolly on top of 400 for the pick-ups (Lollies are banned at some planets: the step shows the nearest three that sell them, as for Dr Nettle).
5. **Quest 8, the race (new):** `ordered` steps of a new kind `checkpoint`. Taking the quest needs you to be at the start line (step 0, a `deliver`-like "Start line" step that ticks when you arrive with a full tank). The quest keeps `fuelAtStart`; buying fuel after that resets the done steps to just the start line, with a gentle "You refuelled, so it's back to the start line" note. Checkpoints are chosen so the whole loop is at most 13 fuel (the smallest tank), every leg 2 to 5 fuel, so every ship can do it and a pupil has to add up the legs. The Quests tab shows "Fuel left: 9. Still to fly: 7" so the sum is in plain sight.
6. **Quest 9:** three pick-ups and one pirate step (a Raider, `questPirateTier`), Navy laser lent, gentle loss, as for Vex. The pets prefer rich-animal, water and rich-soil planets.
7. **Quest 10, the boss (new):** three `clue` steps (ordered, as for Lumi) then a `pirate` step that is the treasure planet, with `tier: 2` (a Captain). The Navy laser is lent and the loss is gentle, so a Captain is hard but never costly; Rust-Beard stays till beaten.
8. **Planets:** `questPlanets` already takes every quest in order and counts planets used by earlier quests against a set, so quests 6 to 10 get their own planets without changing the first five's (they come first in the list). A test checks that the first five's planets are the same before and after.

## 4. Art and voices (done in this PR)

- **31 paintings** from the gaming PC ([docs/stories-art/trader-quests-2.json](../../stories-art/trader-quests-2.json)): 5 giver portraits, 25 story pages and the Star Quest Legend trophy, 2 tries each, the better one picked. Same style words as the first five. The quest board painting is shared.
- **Voices:** one Kokoro voice each (section 2). Pip and Pop take turns: Pip (`af_nicole`) reads pages 1, 3 and 5, Pop (`af_bella`) pages 2 and 4. Clip folders `public/voice/quest-<id>/` and `VOICE_FOR` lines in `scripts/voice-clips.py` come with stage R.3.

## 5. Stages

| Stage | What | Size |
|---|---|---|
| **R.1** | Rules and server: five config entries, `FIRST_SET` for jobs and Star Quest Master, `hands` buy-deliver steps, the race (`checkpoint`, `fuelAtStart`, reset on refuel), the boss tier; tests (fold into the quest test, the budget is full) | Medium |
| **R.2** | Quests tab: "More quests" heading, the new step lines (water per planet, race fuel sum, Rust-Beard card), Bolt lines, preview tools to open each new quest | Medium |
| **R.3** | Stories with each giver's voice (twins two voices), the 📖 shelf, paintings into the game | Small |
| **R.4** | Five more Quest Log keepsakes (Rain-drop, Golden spoon, Comet Cup, Pet collar, Treasure coin), 2 hub points each, Star Quest Legend achievement and season trophy (migration), What's new line, go live | Small |

Each stage goes live on its own, like the first five.

## 6. Later, if pupils like it

- A third set the same way: one config entry, 5 story pages, 6 paintings and a voice a quest.

## 7. James's answers (22 Nov 2026)

He said "Yes, go ahead" to the plan with these picks:

1. **Rewards:** 900, about 1,000, 1,100, 1,200, 1,500.
2. **All ten done:** a "Star Quest Legend" achievement and gold-and-purple season trophy, on top of Star Quest Master.
3. **Order:** strictly in order, one a day, after the first five.
4. **Twins:** two voices, a page each.

# Star Trader quests 6 to 10: plan

22 Nov 2026. James: "can we plan another set of 5 quests for star traders please, should unlock after the first 5 are completed." He agreed to the plan below as drafted ("Yes, go ahead"), with the picks in section 7.

**Status:** plan, stories and all 31 paintings done (this PR), voices sampled (review page https://claude.ai/artifact/8fQgUpWKwJ4CKNKFQ6caAn). R.1 done: the rules and server for all five (`shared/trader/quests.ts`). R.2 done: the Quests tab shows all ten (quests 6 to 10 under "More quests"), with their step lines, Bolt lines, the Comet Cup's fuel sum and painted moments, and Rust-Beard's entrance; no stories yet. R.3 and R.4 below.

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
| 8 | The Comet Cup | Zip Zoomer, race announcer (`am_fenrir`) | Race | From the start line, past the checkpoint, to the finish line, in order, **on one tank**: buying fuel after the start line puts you back to the start (R.1: three planets, not five; see "What R.1 built") | 1,100 |
| 9 | Pip and Pop's Runaway Pets | Pip and Pop, alien twins (`af_nicole` and `af_bella`, a page each) | Gather + defend | Pick up Fluff, Splodge and Zoom from animal-ish planets; win Wiggles back from a pirate (a fight, like Vex's), then home to the twins | 1,200 |
| 10 | Captain Sable's Lost Treasure | Captain Sable, retired pirate queen (`bf_emma`) | Trail + boss | Follow 3 map clues like Lumi's (Show me if stuck), then beat Rust-Beard (a Captain pirate, gentle loss) at the treasure planet | 1,500 |

The stories (5 pages each, under 30 words a page) are in [stories.json](stories.json). Pages 1 to 3 play when you take the quest, 4 and 5 when you finish, as for the first five.

## 3. What's new in the rules

1. **Order.** `QUESTS` gets the five new entries after Lumi, so `nextQuest` opens them in order, one a day. A teacher can still take any quest in any order (#705).
2. **Jobs stay on.** `allQuestsDone` becomes "the first five are done" (a `FIRST_SET` of ids), so today's jobs don't stop when quest 6 opens. Star Quest Master stays "the first five".
3. **Quest 6, handing out goods (new):** a `buy-deliver` step with its own planet (`hands: true`), so Water is handed over at each dry planet, not at the giver's. The step shows "4 Water here (you have 12)". Mayor Puddle pays a set 900, so buying the water is part of the cost; he's at the last dry planet, and the three dry planets are within 12 fuel of each other, preferring desert and lifeless planets.
4. **Quest 7:** the existing pick-up and buy-deliver steps together. The cheese prefers a Pirate haven or Farming co-op (pirates 6 or more), so there's a little pirate risk on the way there (the cheese itself is quest cargo, so pirates can't take it). Gorbo pays 120 a Food and 300 a Lolly (60 in the first draft; James changed it in R.1, since Lollies cost about 210 to 330) on top of 400 for the pick-ups (Lollies are banned at some planets: the step shows the nearest three that sell them, as for Dr Nettle).
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
| **R.1** ✅ | Rules and server: five config entries, `FIRST_SET` for jobs and Star Quest Master, `hands` buy-deliver steps, the race (`checkpoint`, `fuelAtStart`, reset on refuel), the boss tier; tests (fold into the quest test, the budget is full) | Medium |
| **R.2** ✅ | Quests tab: "More quests" heading, the new step lines (water per planet, race fuel sum, Rust-Beard card), Bolt lines, preview tools to open each new quest | Medium |
| **R.3** | Stories with each giver's voice (twins two voices), the 📖 shelf, paintings into the game | Small |
| **R.4** | Five more Quest Log keepsakes (Rain-drop, Golden spoon, Comet Cup, Pet collar, Treasure coin), 2 hub points each, Star Quest Legend achievement and season trophy (migration), What's new line, go live | Small |

Each stage goes live on its own, like the first five.

### What R.1 built (22 Nov 2026)

- **Five config entries** after Lumi in `QUESTS`: `puddle`, `gorbo`, `zip`, `pippop`, `sable` (900, 400 + goods, 1,100, 1,200, 1,500). `nextQuest` opens them one a day, in order, after Lumi; a teacher can still take any quest in any order.
- **`FIRST_SET`** (the first five ids): `allQuestsDone` means the first five, so today's jobs come on after Lumi and stay on while quests 6 to 10 are played (a job and a quest are still never open together). Star Quest Master is unchanged: the database log and trophy only know the first five (R.4 adds Star Quest Legend). `FIRST_QUESTS` keeps the Quests tab, Quest Log and Quest complete moment on the first five until R.2 shows the rest.
- **New step fields:** `hands` (a buy-deliver step handed over at its own planet), `same` (a step at another step's planet), `tier` (a quest pirate's tier), `fullTank` (a step that ticks only with a full tank), and a quest's `race` legs. New step kind `checkpoint` (done with the `quest-pickup` move, like a clue). No new moves, so the trader function's action check is unchanged; the function is rebuilt.
- **Mayor Puddle:** 4 Water at each of 3 dry planets (desert, then lifeless, then poor soil), 3 each on a ship under 15 holds (`small`, now for any quest with a smaller order). The three are within 12 fuel of each other; he waits at the third. He pays a set 900.
- **Chef Gorbo:** Moon-melon (rich soil) and Comet Cheese (Pirate haven or Farming co-op) pick-ups, and 5 Food and 3 Lollies bought anywhere (4 and 2 on a small ship), handed over at his planet. `questReward` is now the reward plus the goods: 400 + 120 a Food + 300 a Lolly = 1,900 (1,480 small), about 1,000 more than the Food and Lollies cost. James picked 300 a Lolly (22 Nov 2026): at 60 each the Lollies lost money. A planet where goods are handed over never bans them (so Gorbo's planet always allows Lollies).
- **The Comet Cup:** ordered steps: the start line (`checkpoint`, `fullTank`), the checkpoint, and the finish line where Zip waits. Ticking the start line keeps `fuelAtStart`. Any move that adds fuel after that (`applyBatch` compares the fuel before and after each move) clears the steps done, so the start line is next again, and the reply says `raceReset: true` for a gentle note. Drop, finish or a new quest clear `fuelAtStart`.
  - **Change from the plan:** planets are 3 to 5 apart, so only about half of all galaxies have four planets in a row within 13 fuel (measured on 300 galaxies). The race is three planets (two legs of 2 to 5 fuel, 13 at most in all, checked on 300 galaxies), so it fits every ship's tank in every school. Zip's page 2 in [stories.json](stories.json) now says "past the checkpoint". A longer race would need either fewer schools or a bigger fuel limit than the Termite's 13. James agreed (22 Nov 2026): "Keep 3 planets".
- **Pip and Pop:** Fluff (rich animals), Splodge (lots of water), Zoom (rich soil), then the Raider with Wiggles (`tier: 1`, on a pirate-ish planet), then home to the twins (Peace garden or Temple). A fight on arrival, Navy laser lent, gentle loss, as for Vex.
- **Captain Sable:** three map marks in order (`clue`, as for Lumi), then Rust-Beard (`tier: 2`, a Pirate captain) at the treasure planet, then the treasure at the same planet. Navy laser lent, gentle loss; he stays till beaten. A Captain is hard on a Flea (hull 25), easy on a Gnat or better.
- **Quest pirates in general:** a win ticks any open quest's pirate step (was Vex only); `questPirateTier` takes the step's `tier` first.
- **First five unchanged:** the test checks the first five quests' planets for the test galaxy against the ones taken on main before this change, and a checksum of them on 300 galaxies.
- **Tests:** folded into the existing quest test (`shared/trader/quests.test.ts`), budget still 12.

### What R.2 built (22 Nov 2026)

- **Quests tab:** the first five cards, then a **✨ More quests** heading with cards 6 to 10 (`QUESTS`, not `FIRST_QUESTS`, in `QuestsPanel.tsx`, the Quest complete moment's "Next quest" and the try-out's "Finish all quests", which now finishes all ten). Quest 6's locked card says "Finish the first five quests to open this one." The count says "N of 10 done". Giver faces come from the R.0 paintings already in the game folder. Chef Gorbo's card says "400 cr + what he pays for the goods (1,500 cr)" (1,080 on a small ship), his checklist reward "(400 cr, plus what Chef Gorbo pays for the goods)". Star Quest Master, the Quest Log and its keepsakes stay on the first five (`FIRST_SET`); the master line on Quest complete only shows for one of the first five.
- **Taking quests 6 to 10** goes straight to the Quests tab (their story pages come with R.3).
- **Step lines** (`questGuide.ts`):
  - **Mayor Puddle:** "4 Water here (you have 12)" at each dry planet, button "💧 Hand out 4 Water". The three lots of Water are one shop: the Goods box shows once ("0 of 12 Water"), "Mayor Puddle pays 900 cr when it's all handed out" and what you make after buying; "Buy 12 Water here", and "Then hand them out at the dry planets" at other markets. Landing card: "Hand out 4 Water here for Mayor Puddle (you have 12)". (`stillToBuy` adds up every undone step wanting a good, so Dr Nettle's and Gorbo's lines are unchanged.)
  - **The Comet Cup:** a blue race box on the checklist. Before the start: "The race is 4 + 5 = 9 fuel. Your tank holds 20, so one full tank gets you round." Once racing: "Fuel left: 20. Still to fly: 9 (4 + 5)" with a gauge, and "✓ Enough to finish, with 11 to spare" or "⛽ Not enough to finish. Buying fuel now sends you back to the start line." The start line's step has the full-tank hint ("Arrive with a full tank: you have 10 of 20", Buy fuel link). Buttons "🚦 Start the race!", "💨 Through!", "🏁 Cross the line!". The "too far, buy fuel" line is not shown mid-race.
  - **`raceReset`:** a refuel move that sends the race back gives the gentle note "You refuelled, so it's back to the start line. The Comet Cup is flown on one tank: fill up at the start line, then no more fuel till the finish." (checked with the shared rules as the move is made, as every quiet move is).
  - **Rust-Beard:** "Beat Rust-Beard, the pirate Captain" (not "a pirate ship"); his waiting card says "Rust-Beard's ship is still here."; the fight screen's heading is "Rust-Beard attacks! ☠️" with "Captain Sable's Navy laser is fitted ... If you lose, he takes nothing"; a win says "You beat Rust-Beard! 🏴‍☠️🎉" and "Ticked off for Captain Sable".
  - **Captain Sable's map:** her marks work like Lumi's clues ("Follow mark 1 of Captain Sable's map", "Captain Sable: From here, go ...", Show me), and so does Rust-Beard's planet (the clue to the treasure planet). The treasure (`same` as Rust-Beard's step) is hidden with his planet and shown once he's beaten (`isHidden` takes the steps done). Which quests hide their planets is now "has clue steps" (`isTrail`), not `ordered`, so the Comet Cup's lines are always shown.
  - **Pip and Pop:** "Find Fluff" / "Scoop up Fluff"; "Win Wiggles back from the pirate" and the fight line "Win Wiggles back for Pip and Pop! Their Navy laser ...".
  - **Hand-over words** (`DELIVER`) for all five and **"who is here"** lines (`WHO_HERE`: Lumi's family, "This is the finish line.", "Captain Sable's treasure is here."; the others "X is here."). "Still to do" lines say "hand out the Water at 2 dry planets", "win Wiggles back", "beat Rust-Beard", "follow Captain Sable's map".
- **Bolt:** at the start line with a part tank, "Comet Cup: this is the start line. Fill your tank to the top (10 of 20) ..."; once racing, "Comet Cup: Fuel left: 16. Still to fly: 5. Fly to ... No more fuel till the finish!" (never "fill your tank first" mid-race). Captain Sable's map marks: "Captain Sable's map: ...". The star chart's quest line names the trail and who gives the clue.
- **Gold rings:** a planet with two steps (Puddle's last dry planet and the Mayor, Rust-Beard and the treasure) gets a double gold ring (`st-planet--quest2`) and both step numbers.
- **Painted moments** (`QuestFx.tsx`, using R.0 story paintings already in the game): the start line fills the window with the starting-lights painting, the three lamps light red, amber, green, then GO! slams in with comet streaks; the checkpoint and the finish use the finish-ring painting, the finish with waving chequered flags. Tap or any key skips. Rust-Beard's rusty ship sails in above his fight with a shake and his name slamming down. Less motion: still pictures, no shaking.
- **Preview tools:** "Open Puddle's quest", "Open Gorbo's quest", "Open the Comet Cup", "Open Pip and Pop's quest", "Open Sable's quest".
- **First-time pirate tip:** already skipped for every gentle quest fight, Rust-Beard included (checked).
- **Tests:** folded into the Quests screen test in `TraderGame.test.tsx` (More quests and Quest 10 locked; Puddle's water lines and pay; the Comet Cup's lamps, fuel sum, Gorbo's card and the refuel note; Rust-Beard's card, heading and entrance). Budget unchanged.

### Left for R.3

- **Stories:** `QUEST_STORIES` entries for puddle, gorbo, zip, pippop, sable from [stories.json](stories.json), with the paintings (`<id>-1` to `-5` are already in `src/games/trader/art/quests`); pages 1 to 3 on taking, 4 and 5 on finishing (`questMove` already plays them once `questStoryPart` finds them), and the 📖 shelf (already reads `QUESTS`).
- **Voices:** Kokoro clips in `public/voice/quest-<id>/` and `VOICE_FOR` lines in `scripts/voice-clips.py`: Puddle `am_eric`, Gorbo `am_onyx`, Zip `am_fenrir`, Sable `bf_emma`; Pip and Pop take turns (Pip `af_nicole` pages 1, 3 and 5, Pop `af_bella` pages 2 and 4), which `questClips` and the voice test don't do yet (one voice per quest today).
- The race and Rust-Beard moments reuse `zip-3`, `zip-4` and `sable-2`; the stories will show them again as pages, which is fine.

### Left for R.2 (done above)

- **Quests tab:** a "More quests" heading with cards 6 to 10 (switch `FIRST_QUESTS` back to `QUESTS` in `QuestsPanel.tsx`, `TraderGame.tsx` and the try-out's "Finish all quests", keeping Star Quest Master to `FIRST_SET`). Rewards on the cards: Gorbo's "400 + what he pays for the goods" like Dr Nettle's.
- **Step lines** (`questGuide.ts`): "4 Water here (you have 12)" for each dry planet; the race's "Fuel left: 9. Still to fly: 7", the full-tank hint on the start line and the gentle "You refuelled, so it's back to the start line" note from `raceReset`; Rust-Beard's card (Captain, not "a pirate ship"); Sable's marks as clues ("Follow mark 1 of Captain Sable's map", Show me), including the clue to the treasure planet; the twins' Wiggles fight line; delivery words for each giver (`DELIVER`), and the "who is here" lines (Lumi's is special-cased by id).
- **Landing card and Bolt** for the new kinds (checkpoint, hands water), and the gold rings for planets shared by two steps (Puddle, Sable).
- **Preview tools** to open each new quest (`tools.openQuest` already takes any id).
- The first-time pirate tip is skipped in quest fights already; check it for the Captain.

## 6. Later, if pupils like it

- A third set the same way: one config entry, 5 story pages, 6 paintings and a voice a quest.

## 7. James's answers (22 Nov 2026)

He said "Yes, go ahead" to the plan with these picks:

1. **Rewards:** 900, about 1,000, 1,100, 1,200, 1,500.
2. **All ten done:** a "Star Quest Legend" achievement and gold-and-purple season trophy, on top of Star Quest Master.
3. **Order:** strictly in order, one a day, after the first five.
4. **Twins:** two voices, a page each.
5. **Comet Cup (asked during R.1):** keep it to 3 planets (start line, checkpoint, finish line), so it fits every ship in every school.
6. **Gorbo's Lollies (asked during R.1):** 300 each, not 60.

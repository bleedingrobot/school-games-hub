# Archery Challenge: getting kids to do the maths (plan, 28 Oct 2026)

James: kids aren't really answering the questions or getting better weapons. Redesign how and when the questions are asked so they do them, and make the upgrades much easier to reach. Nothing is built yet.

## What's happening now (live data, 28 Oct)

- **Kids fight but skip the maths.** In the last 2 days 25 kids played 72 fights, but only 16 did a speed round (90 rounds).
- **Rounds pay badly.** The average round earns **41 coins out of 100**. The timer drops from 10 s to **1 s** (`shared/archery/speed.ts`), so the last few questions are close to impossible.
- **Hardly anyone has upgrades.** 29 players, only 12 have bought anything, only **2 own a bow**. The most anyone has ever spent is 660 coins. Average bank: 59 coins.
- **Prices are high for what a round pays.** Steel Arrows 50 for 2, special arrows 100–500 each, bows 250–600, and the top Armory level needs 2,000 coins spent (`shared/archery/shop.ts`, `arrows.ts`, `gear.ts`). At 41 coins a round, a bow is 6–15 rounds.
- **The maths is off the path.** Coins come only from a speed round on the home screen, or an optional "Speed round for coins" button between fight rounds. Kids press Play and never meet a question.

## Options

### A. Friendlier numbers (small)
Keep where the questions are; make them pay.
- Speed-round timer goes 10 s down to **5 s** (not 1 s), so a good round is reachable.
- **Prices about halved** (bows 150–300, special arrows 30–250) and **Armory levels at 0 / 100 / 300 / 600 / 1,000** coins spent.
- Everyone starts the season with **100 coins**, so the first trip to the Armory buys something.
- Home shows a goal: "60 more coins for a Longbow" with the speed-round button beside it.

*Good:* quick, no new screens. *Bad:* kids still have to choose to go and do maths, and most don't.

### B. Maths on the path + friendlier numbers (medium) — **recommended**
Everything in A, plus questions turn up where kids already are, short and worth it.
1. **Loot chest after every fight.** 3 questions, 10 s each. Each right answer: **20 coins** if you won, **10** if you lost. A Skip button is there but small.
2. **Restock between rounds of a bot fight.** Instead of the optional button, 3 quick questions appear before the next round (10 coins each, Skip is small).
3. **Streak bonus** in every question set: +5 coins for each right answer after 3 in a row.
4. **Daily cap by coins, not rounds:** up to 600 coins a day from maths (then practice, maths still counts), so short sets don't use up the cap.
5. The full speed round stays on Home for kids who want a big pay day.

A typical fight then asks 6 questions and pays 60–120 coins, so a bow takes 2–4 fights.

*Good:* every kid who fights does maths, and upgrades arrive within a lesson. *Bad:* more work (server and screens); a small migration.

### C. A question every shot (big)
Before each turn, one question. Right: you can fire a special arrow this shot for free. Wrong: Plain Arrow. Coins and the Armory are then only for bows and shields.

*Good:* the most maths per minute, and special arrows get used a lot. *Bad:* slows every fight, and changes the game the pupil designed. Classmate fights get slower too.

## Building B (if chosen)

1. **Numbers** (`shared/archery/speed.ts`, `shop.ts`, `arrows.ts`, `gear.ts`): the 5 s floor, new prices and levels, streak bonus, coin cap. Re-run the balance simulator.
2. **Server:** reuse the speed-round machinery with a `size` (3) and a `kind` (`chest` / `restock` / `speed`); a chest's coins depend on the fight's result, read from `archery_fights`. Migration for the new columns, the coin cap and the 100-coin season start. Database and function tests.
3. **Screens:** the chest after a fight, the restock between rounds, the Home goal bar, How to play updated.
4. **Preview and try-out**, then live: the existing players get topped up to 100 coins if below.

Bots and classmate fights work as now. Classmate fights are one round, so they get the chest only (each player their own).

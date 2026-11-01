# Prompt: Diamond Drop Stage 1 (the rules engine and the balance simulator)

Paste everything below the line into a new Claude session opened in `~/games-hub-claw`.

---

You are continuing **Diamond Drop** (short id `diamond`, CSS prefix `.dd-`, branch `claw`) for James's **School Games Hub**. James teaches Years 4–6 at Douglas Park School, and the hub has games for his class. Diamond Drop is an **original** claw-and-winch digging game: a claw swings at the top of a cut-away view of the ground, one Drop button grabs gems, and pupils work down 10 levels towards a Heart Diamond. Rare gems can slip on the way up, and a maths question from the pupil's own focus ("Hold on!") keeps them. Reply to James in plain, simple words, without jargon, file paths or commit hashes unless he asks. **Ask James every question on clickable cards** (AskUserQuestion), your recommendation first. Use Sonnet or Haiku helper agents whenever they fit (searching, reading widely, checking tests, routine edits); no need to ask.

Stage 0 (the plan) is done, and James has answered every question in it. **This session builds Stage 1: the rules engine in `shared/diamond/` as pure, seeded functions, plus the balance simulator.** There's nothing to play yet: no screens, server or database.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/DIAMOND-PLAN.md` all the way through. Pay most attention to:
   - Section 3 (the claw, the 10 levels, gems and Hold on!, the boost shop, the Claw Workshop).
   - Section 5 (the server replays each level, so the engine must give exactly the same result from the same seed and drops).
   - Section 6.1 to 6.3 (the big goal, New Season back to level 1, one new level a day).
   - Sections 10 (tests) and 11 (stages).
3. Read the engines this one should be shaped like:
   - `shared/archery/`: a fixed angle table and only + − × ÷ and square root while playing.
   - `shared/marble/` and `shared/mine/`: replay from a seed and recorded inputs.
   - `shared/kingdom/` and `shared/trader/`: a recent `config.ts` and simulator.
   - `nzDate` in `shared/lord/engine.ts`: the New Zealand day.
4. Work only in this worktree, on branch `claw`. Never commit to `main`, never `supabase db reset`, and push only with `git push origin claw`. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`). Run `npm ci` if `node_modules` is missing.
5. Keep the game original. Take nothing from the gold-miner repo the idea came from (no code, art, names or numbers): the genre idea only.

## Decided by James (2 Nov 2026)
- **10 levels**, each with a time limit and a gem target. Passed levels stay passed.
- **At most one new level a day** (New Zealand date). Tries at today's level are unlimited until it's passed. After that, pupils can replay levels already passed for coins, stars and Gem Book entries.
- **Hold on!:** the clock pauses during the question. A wrong answer makes the gem fall back into the rock, lower down, where it can be caught again. There are at most 6 questions a level (8 on level 10). The Heart Diamond always slips twice.
- **Boost shop:** boosts last for the next level only, with at most one of each.
- **Claw Workshop:** about 40 cosmetic upgrades in 6 slots (claw head, rope, trail, catch effect, winch, Nugget's hat).
  - They are looks only: never part of the replay.
  - A few are earned, not bought.
  - They are kept through New Season.
  - There's a special of the week, chosen from the week number.
- **New Season** sends everyone back to level 1: levels, coins, stars and the Gem Book are cleared. Achievements, Workshop upgrades and the Hall are kept.
- **High-quality painted art** from James's gaming PC comes in Stage 2 and later, not this stage.

## What to build (all pure functions, seeded, every number in `shared/diamond/config.ts`)
1. **`config.ts`:**
   - The 10 levels: place, new gem, time and target.
   - The gems: value, weight and slip chance.
   - Rocks, mystery sacks and cave crabs.
   - Swing speed and range, and reel speeds by weight.
   - The tick rate (30 a second).
   - Boost prices and effects, and question caps.
   - The Workshop list: id, name, slot, rarity, price, and the achievement that earns it, if any.
   - Start from the plan's guesses.
2. **The field from a seed:** gem, rock, sack and crab positions for a level, with rarer gems fewer, smaller and deeper. Every level must be passable, so check this on many seeds.
3. **The level engine:**
   - It steps tick by tick from `(level, seed, drops, boosts, marks)` to the result: gems banked, coins, passed or not, stars, Hold on! slot used for each slip, and where a dropped gem lands.
   - Use only + − × ÷ and square root while playing, with a fixed angle table.
   - Slips come only from the seed and the catch number; the outcome comes from the server's marks for each question slot.
   - When the questions run out, nothing more slips.
   - Return what the screen will need to animate: the claw's path and each catch.
4. **Progress rules:**
   - Which levels a pupil may start today, given their deepest level and the New Zealand date of their last new level passed. Test across New Zealand midnight.
   - Stars, coins and the Gem Book, added up after a level.
   - What New Season clears and what it keeps.
5. **The Workshop rules:**
   - Can this pupil buy this upgrade (price, coins, not earned-only, not already owned)?
   - Wearing one upgrade per slot.
   - `weeklySpecial(weekNumber)`.
6. **`starterLevel`:** the guided first go on level 1 (a slow swing, a big quartz straight below). The first drop can't miss.
7. **`nextStep(player)`:** one short sentence with real names and numbers, plus which button it means. Examples: "Pass level 4: bank 80 gems in 70 seconds", "Level 5 opens tomorrow. Replay level 3 to find the Amethyst you're missing", "You have 420 coins: the Robot Hand is on special this week". Write it in words a 9-year-old reads easily.
8. **`scripts/diamond-sim.mjs`** (and a `diamond:sim` script added at the **end** of `package.json`'s `scripts`):
   - Plays pupils of different skill and maths accuracy over a 35-day season at 2, 3 to 4, and 5 days a week, with the one-new-level-a-day rule.
   - Tune until:
     - 3-to-4-days-a-week players reach the diamond in about 4 to 5 weeks.
     - Most levels pass in 1 to 3 tries.
     - A pupil weaker at maths can still reach the diamond.
     - A regular player affords 6 to 10 Workshop upgrades a season, and a Legendary is a season-long goal.
     - Coins don't pile up unused.
   - Write the final numbers back into `config.ts`.
9. **`docs/DIAMOND-RULES.md`:** a short rule sheet with the pace tables from the simulator.

## Tests (at most 8 for the whole game; this stage uses 3)
- **Rule test 1:** the same seed, drops, boosts and marks always give the same level result, so the server and the browser agree.
- **Rule test 2:** slips come only from the seed and the marks. A wrong mark drops the gem, nothing slips after the question cap, and `starterLevel` can't miss on 1,000 seeds.
- **Rule test 3:** passing, stars and the one-new-level-a-day rule across New Zealand midnight (pin the clock).
Run them with `npx vitest run shared/diamond`. No tests of wording or tuning numbers.

## When done
- Run the type check and your tests.
- In `docs/DIAMOND-PLAN.md`, write a "Stage 1 results" section: what you built, decisions you made, the simulator's pace, what is untested, and any questions for James.
- Commit, then `git push origin claw`. Update the memory note `diamond-drop.md`.
- Tell James in a few plain sentences how long the climb to the diamond takes now and anything he should decide (on cards). Then stop: Stage 2 (screens, drawn art, the phone preview and the art plan for painting) is a separate session.

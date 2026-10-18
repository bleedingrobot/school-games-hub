Game rules code that runs in both the website and the server, so the server can check every move.

- `botGame.ts`: things every bot game shares (bot levels, how a game can end, which games earn points).
- `chess/rules.ts`: chess rules (from chess.js), replaying a game, and how a game ended.
- `chess/botGame.ts`: deciding the result of a chess game against a bot.
- `checkers/rules.ts`: English checkers rules, written by us (no well-tested library exists), with
  thorough tests in `checkers/rules.test.ts`.
- `checkers/botGame.ts`: deciding the result of a checkers game against a bot.
- `space/`: Wormholes & Black Holes (Stage 9). `engine.ts` is the rules, as a pure function:
  the dice come in from outside, so the same dice always give the same game. `boards.ts` has
  the four designed boards, `galaxy.ts` makes Random Galaxies, `bot.ts` has the bots, and
  `replay.ts` replays a bot game from its seed. `sim.ts` plays thousands of games
  (`npm run space:sim`). See `docs/SPACE-GAME-PLAN.md`.

The `save-bot-game` server function runs exactly this code before saving a result.
- `card101/`: 101, James's family card game (Stage 10). `score.ts` scores a hand with its
  working, `engine.ts` is the rules as a pure function (shuffles come in from outside), and
  `view.ts` makes what each player is allowed to see: the only way card information ever
  leaves the server (`view.test.ts` checks every view in thousands of games for leaks).
  `bot.ts` has the bots (they get only their own view), `solo.ts` replays a bot game from
  its seed, and `sim.ts` plays thousands of games (`npm run 101:sim`). See `docs/101-PLAN.md`
  and `docs/101-RULES.md`.
- `clans/`: Clan Quest (stage C.1). `gamedata.ts` has the races, classes, items and monsters
  (The Clans' numbers, our names), `spells.ts` the spells, `config.ts` every tuning number.
  `character.ts` rolls members and handles levels, training, the Church and the shop.
  `fight.ts` is a mine fight as a pure state machine (`newFight` from a seed, `playRound`
  with one order per member; plain JSON, so it can be saved and replayed). `bot.ts` plays a
  sensible clan, and `sim.ts` plays whole months (`npm run clans:sim`). Stage C.2 adds
  `battleCry.ts` (the question for each round comes from the fight's seed; marks the answer,
  plays the round, replays a whole recorded fight), `moments.ts` (the shop, Training Hall,
  Church, land and barracks questions, made from the real numbers). Stage C.4 adds `empire.ts`
  (land, buildings and worker energy, troops, the draft, six computer kingdoms, one-shot
  battles from two armies, a plan and a seed, Friendly War, and the rule for classmate raids)
  and `empireBot.ts` (a sensible empire builder for the simulator: `npm run clans:sim -- --empire 1`). See `docs/CLANS-PLAN.md`
  and `docs/CLANS-RULES.md`. The screens for all of it (Empire, Land, Barracks and troops, Raid and Friendly War)
  are in `src/games/clans/` and only call these functions through `places.ts`. Stage C.4 part C adds `quests.ts` (ten short stories with choices, the charisma rule, one a day, and puzzles made and marked by code: patterns, order, number riddles, temperatures below zero).
  Stage C.5 part A adds the server side: `play.ts` (shop, Training Hall, Church, troop and raid actions on a clan, used by both the screens and the server), `create.ts` and `words.ts` (the creator's rules and name lists; the server rebuilds a clan from the choices alone), `clock.ts` (New Zealand day numbers) and `actions.ts` (`parseAction` reads an action sent by a browser, `applyAction` does it on a copy and says yes or no, `catchUp` gives a clan its night's rest). The `clans` server function in `supabase/functions/clans/` is only the plumbing around `applyAction`.
  Stage C.5 part B adds mine fights to `actions.ts` (`fightStart` picks the monsters from the clan's seed and `fightSeed`; one `fightRound` per round played; the server rebuilds the whole fight with `replayFight`, marks the Battle Cry answer by rebuilding the question, and `payFight` pays once; while a fight is open nothing else about the clan can change, and the night's rest waits). `play.ts` now also holds `fightSeed`, `payFight` and `FightSummary`. The midnight database job (`clan_nightly`, in the `20261018001900` migration) does the same rest as `catchUp` for clans nobody opened; a test keeps the two in step.
  Stage C.6 part A adds `village.ts`: the class village (the chest, the three buildings and their costs, the weekly vote and what closing a week does, the class goal and its maths question) and raids on classmates (`raidTargetList` says who a clan may raid and why not; `raidClassmateNz` does a raid using New Zealand day numbers). The server actions are `chestGive`, `vote`, `raidTargets` and `raidClass` in `actions.ts`; a raid also hands back the raided clan's new empire, saved with the raiders' clan in one transaction (`save_raid`, in the `20261018002000` migration). The Church level now gives one more free wake-up a day (`freeWakes` in `character.ts`).
  Stage C.6 part B adds `rewards.ts`: what a request earns (`Earned`, counts only: mine wins, bosses, Friendly War wins, raids won, right Battle Cry answers), the fame and points for them (`fameFor`, `pointsFor`, numbers in `CONFIG.rewards`), and the eight achievements with the lifetime counts they are measured by. The rules put `earned` inside the result they save; a trigger in the `20261018002100` migration turns it into fame, points and achievements in the same transaction, so a request earns once. `actions.ts` also hands back the maths answers a request produced (`effects.answers`, kinds and year bands only) for the teacher's private records, and takes the teacher's mine fights a day (`ctx.fightsPerDay`).
- `maths/practical.ts`: the question kinds Clan Quest needs (percent of, price with tax,
  change, area and perimeter, remainders, rounding up, troop costs, budgets, ratios, negative
  numbers, better buys). Made and marked by code; each is rebuilt from its kind and numbers
  (`buildQuestion`), with Year 4/5/6 bands and the teacher's topic switches
  (`PracticalSettings`).

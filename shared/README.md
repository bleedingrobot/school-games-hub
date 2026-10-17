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
  and `docs/CLANS-RULES.md`.
- `maths/practical.ts`: the question kinds Clan Quest needs (percent of, price with tax,
  change, area and perimeter, remainders, rounding up, troop costs, budgets, ratios, negative
  numbers, better buys). Made and marked by code; each is rebuilt from its kind and numbers
  (`buildQuestion`), with Year 4/5/6 bands and the teacher's topic switches
  (`PracticalSettings`).

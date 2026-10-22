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
  Stage C.7 adds no rules. It adds the How to play screen (`src/games/clans/HowToPlay.tsx`, whose numbers are read from `CONFIG` and `CONFIG.rewards`, so changing a tuning number changes the page), an accessibility pass (44px targets, contrast, focus moved to each new screen's heading, named fight panels) and tests that keep it so (`Accessibility.test.tsx` reads the CSS and checks the contrast ratios, the target sizes and the reduced-motion rules). Going live: `docs/prompts/clans-golive.md`.
- `marble/`: Marble Rush. `engine.ts` is the physics as a pure step function (fixed steps, no
  randomness, so a run replays the same everywhere), `inputs.ts` the recorded inputs (including
  `HOLD`, `REFUND` and `BONUS`), `course.ts`, `courses.ts` and `nzCourses.ts` the courses,
  `config.ts` every tuning number, `maths.ts` which tunnel and gem is right from the seed and the
  question list, `questions.ts` the run's questions, `save.ts` the server's replay check, `bot.ts`
  the bot for medal times and `determinism.ts` the cross-browser check. See `docs/MARBLE-PLAN.md`.
- `maths/practical.ts`: the question kinds Clan Quest needs (percent of, price with tax,
  change, area and perimeter, remainders, rounding up, troop costs, budgets, ratios, negative
  numbers, better buys). Made and marked by code; each is rebuilt from its kind and numbers
  (`buildQuestion`), with Year 4/5/6 bands and the teacher's topic switches
  (`PracticalSettings`).
- `mine/`: Mine Runner (stages 1 to 4). `engine.ts` is the rules as a pure function (30 steps a second; the same
  recorded inputs always give the same run, so the server replays a run to check its time), `level.ts` makes the six
  mines from a recipe and seed (plus hard mode), `inputs.ts` stores a run as "same input for N steps" text, `bot.ts`
  is a pretend pilot that finishes every mine, `medals.ts` has the medal times, `maths.ts` says which question belongs
  to which door or pad, and `save.ts` is the server's replay and check (`judgeRun`). `determinism.ts` pins the rules'
  fingerprint (`npm run mine:determinism` also checks Chromium and WebKit). See `docs/MINE-PLAN.md`.
- `archery/`: Archery Challenge (stages 1 to 7). `fight.ts` is a fight as pure functions (`playFight(seed, setup,
  shots)`, or `startFight` and `takeShot` one shot at a time; only + − × ÷ and square root, aim directions from the
  table in `aim.ts`), with `land.ts` (a grid of cells, the four worlds' twists), `shot.ts`, `damage.ts`, `effects.ts`
  (every arrow) and `gear.ts` (shields, helpers, bows). `bot.ts` is the three bots, `judge.ts` the server's replay of a
  bot fight (checking every bot shot), `duel.ts` a classmate fight (one round, turn by turn), `shop.ts` the Armory's
  prices and levels, `speed.ts` the speed round (questions from the maths focus, the shrinking timer), `points.ts`
  and `stats.ts` the hub points and achievement counts. Every number is in `config.ts`. `determinism.ts` pins the
  rules' fingerprint (`npm run archery:determinism` also checks Chromium and WebKit). See `docs/ARCHERY-PLAN.md`.

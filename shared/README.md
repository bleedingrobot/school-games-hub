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

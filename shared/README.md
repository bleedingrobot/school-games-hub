Game rules code that runs in both the website and the server, so the server can check every move.

- `botGame.ts`: things every bot game shares (bot levels, how a game can end, which games earn points).
- `chess/rules.ts`: chess rules (from chess.js), replaying a game, and how a game ended.
- `chess/botGame.ts`: deciding the result of a chess game against a bot.
- `checkers/rules.ts`: English checkers rules, written by us (no well-tested library exists), with
  thorough tests in `checkers/rules.test.ts`.
- `checkers/botGame.ts`: deciding the result of a checkers game against a bot.

The `save-bot-game` server function runs exactly this code before saving a result.

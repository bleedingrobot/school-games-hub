Game rules code that runs in both the website and the server, so the server can check every move.

- `chess/rules.ts`: chess rules (from chess.js), replaying a game, and how a game ended.
- `chess/botGame.ts`: deciding the result of a game against a bot. The `save-bot-game` server
  function runs exactly this code before saving a result.

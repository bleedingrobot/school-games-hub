// The slow files: they play many whole games (bots against bots, or the space game's screen played to the end) and take
// 20 to 60 seconds each. `npm test` skips them; `npm run test:all` and `npm run check` (and the publish) run everything.
// Run the whole lot before merging, or after changing a bot, a game's rules or its screen.
export const SLOW_TESTS = [
  'src/games/space/SpaceSolo.test.tsx',
  'src/games/checkers/bot.test.ts',
  'shared/card101/bot.test.ts',
];

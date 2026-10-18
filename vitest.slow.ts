// The slow test files: they play whole games (bots against bots, or a screen played to the end)
// and take 10 to 70 seconds each. `npm test` skips them; `npm run test:all` runs everything.
// Run the whole lot before merging, or after changing a bot, a game's rules or its screen.
export const SLOW_TESTS = [
  'src/games/space/SpaceSolo.test.tsx',
  'src/games/checkers/bot.test.ts',
  'shared/card101/bot.test.ts',
  'shared/card101/view.test.ts',
  'src/games/card101/Card101Solo.test.tsx',
  'src/games/gem-keep/GemKeepCampaign.test.tsx',
  'shared/gem-keep/levels.test.ts',
];

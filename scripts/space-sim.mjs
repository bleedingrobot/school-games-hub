// Plays thousands of Wormholes & Black Holes bot games on every board and prints what happened.
// Run from the project folder with: npm run space:sim  [-- --games 20000] [-- --board nebula] [-- --json]
//   [-- --maths]              Mission Control maths on (bots answer at their usual rates)
//   [-- --student 0.9]        with --maths: the first rocket answers right this often (how much it helps)
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const GAMES = Number(option('games', 5000));
const ONLY = option('board', null);
const JSON_OUT = args.includes('--json');
const MATHS = args.includes('--maths');
const STUDENT = option('student', null);

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const entry = `
export { simulate } from './shared/space/sim.ts';
export { DESIGNED_BOARDS, DESIGNED_BOARD_IDS } from './shared/space/boards.ts';
export { galaxyBoard, galaxyCodeAt } from './shared/space/galaxy.ts';
export { DEFAULT_SETTINGS } from './shared/space/engine.ts';
`;
const dir = mkdtempSync(join(tmpdir(), 'space-sim-'));
const entryFile = join(process.cwd(), `.space-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, entry);
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}
const { simulate, DESIGNED_BOARDS, DESIGNED_BOARD_IDS, galaxyBoard, galaxyCodeAt, DEFAULT_SETTINGS } = mod;

const boards = DESIGNED_BOARD_IDS.filter((id) => !ONLY || id === ONLY).map((id) => DESIGNED_BOARDS[id]);
if (!ONLY || ONLY === 'galaxy') {
  // A few Random Galaxies of each size, to see the generator's range.
  for (const i of [0, 7777, 41234]) boards.push(galaxyBoard(galaxyCodeAt(i), 100));
  for (const i of [0, 7777]) boards.push(galaxyBoard(galaxyCodeAt(i), 50));
}

const fmt = (n, digits = 1) => n.toFixed(digits);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const results = [];

for (const board of boards) {
  for (const mode of ['cosmic', 'classic']) {
    for (const players of [2, 3, 4]) {
      const settings = { ...DEFAULT_SETTINGS, mode, cosmicEvents: board.cosmicEvents, maths: MATHS };
      const report = simulate({
        board, settings, levels: Array(players).fill('easy'), games: GAMES, seed: `${board.id}:${mode}:${players}`,
        ...(MATHS && STUDENT !== null ? { mathsRight: [Number(STUDENT)] } : {}),
      });
      results.push({ board: board.name, mode, players, report });
      if (!JSON_OUT) {
        console.log(
          `${board.name.padEnd(36)} ${mode.padEnd(7)} ${players}p | rounds ${fmt(report.rounds.mean)} (p95 ${report.rounds.p95}, max ${report.rounds.max})` +
            ` | turns ${fmt(report.turns.mean)} | ~${fmt(report.minutes.mean)} min (p95 ${fmt(report.minutes.p95)})` +
            ` | clock ${pct(report.missionClock)} | cap ${pct(report.chainCapGames)}` +
            ` | wins by seat ${report.winsBySeat.map(pct).join(' ')} | comeback ${pct(report.comeback)}`,
        );
      }
    }
  }
}

// Bot levels against each other (4 players, Nebula, Cosmic).
const levelBoard = DESIGNED_BOARDS[ONLY && ONLY !== 'galaxy' ? ONLY : 'nebula'];
const mixes = [['medium', 'easy', 'very-easy', 'easy'], ['easy', 'medium', 'easy', 'very-easy']];
const levelResults = mixes.map((levels) => ({
  levels,
  report: simulate({ board: levelBoard, settings: { ...DEFAULT_SETTINGS, cosmicEvents: levelBoard.cosmicEvents }, levels, games: GAMES, seed: `levels:${levels.join()}` }),
}));

if (JSON_OUT) {
  console.log(JSON.stringify({ games: GAMES, results, levelResults }, null, 1));
} else {
  console.log(`\nBot levels on ${levelBoard.name} (Cosmic, 4 players):`);
  for (const { levels, report } of levelResults) {
    console.log(`  ${levels.join(', ').padEnd(36)} wins ${report.winsBySeat.map(pct).join(' ')}`);
  }
  console.log(`\nHow often things happen per game (${levelBoard.name}, Cosmic, mixed bots):`);
  for (const [key, value] of Object.entries(levelResults[0].report.perGame)) console.log(`  ${key.padEnd(28)} ${fmt(value, 2)}`);
}

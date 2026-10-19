// Plays the bots against each other using Stockfish (the same files the website ships),
// and checks every move they make is legal, including in tricky positions.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BOT_LEVEL_IDS } from '../../../shared/chess/botGame';
import { boardResult, Chess, legalUciMoves, playUci } from '../../../shared/chess/rules';
import { chooseBotMove, randomishMove } from './bot';
import { UciEngine, type UciChannel } from './stockfish';

const require = createRequire(resolve('package.json'));

describe('the Stockfish files on the website', () => {
  it('are exactly the ones from the stockfish package that these tests use', () => {
    for (const file of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
      const shipped = readFileSync(resolve('public/stockfish', file));
      const tested = readFileSync(require.resolve(`stockfish/bin/${file}`));
      expect(shipped.equals(tested), `${file} differs: copy it again from node_modules/stockfish/bin`).toBe(true);
    }
  });
});

function nodeStockfish(): UciEngine {
  const channel: UciChannel = { send: () => {}, onLine: null, close: () => {} };
  const sf = require('stockfish')('lite-single', (line: string) => channel.onLine?.(line));
  channel.send = (command) => sf.processCommand(command);
  channel.close = () => sf.terminate();
  return new UciEngine(channel);
}

const engine = nodeStockfish();
afterAll(() => engine.close());

/** A repeatable "random" number generator, so a failing test fails the same way every time. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const SPECIAL_POSITIONS: Record<string, string> = {
  'promotion': '8/1P6/8/8/8/8/6k1/K7 w - - 0 1',
  'promotion with a capture choice': '1r5k/P7/8/8/8/8/8/K7 w - - 0 1',
  'black promotes': '8/8/8/8/8/k7/6p1/4K3 b - - 0 1',
  'en passant available': 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
  'castling both ways': 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 8',
  'black castles': 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R b KQkq - 0 8',
  'in check': '4k3/8/8/8/1b6/8/3P4/R3K2R w KQ - 0 1',
  'king nearly trapped': '7k/8/8/8/8/8/5r2/6K1 w - - 0 1',
  'mate in one': '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
};

describe('every bot plays only legal moves', () => {
  for (const level of BOT_LEVEL_IDS) {
    describe(level, () => {
      for (const [name, fen] of Object.entries(SPECIAL_POSITIONS)) {
        it(`in this position: ${name}`, async () => {
          const chess = new Chess(fen);
          const legal = legalUciMoves(chess);
          for (let i = 0; i < 4; i++) {
            const move = await chooseBotMove(chess, level, engine, seeded(i + 1));
            expect(legal).toContain(move);
          }
        });
      }

      it('through a whole game against another bot', async () => {
        const chess = new Chess();
        const random = seeded(BOT_LEVEL_IDS.indexOf(level) + 7);
        for (let ply = 0; ply < 160 && !boardResult(chess); ply++) {
          const mover = ply % 2 === 0 ? level : 'very-easy';
          const move = await chooseBotMove(chess, mover, engine, random);
          expect(legalUciMoves(chess)).toContain(move);
          expect(playUci(chess, move)).not.toBeNull();
        }
      }, 60_000);
    });
  }
});

describe('the bots get harder', () => {
  it('Medium finds a mate in one', async () => {
    const chess = new Chess(SPECIAL_POSITIONS['mate in one']);
    expect(await chooseBotMove(chess, 'medium', engine)).toBe('a1a8');
  });
});

describe('Very Easy', () => {
  it('likes captures but still plays other moves', () => {
    const chess = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const picks = Array.from({ length: 400 }, (_, i) => randomishMove(chess, seeded(i + 1)));
    const captures = picks.filter((m) => m === 'e4d5').length;
    expect(captures).toBeGreaterThan(400 / legalUciMoves(chess).length);
    expect(captures).toBeLessThan(400);
  });

  it('falls back to a legal move when the engine suggests nonsense', async () => {
    const liar = { bestMove: async () => 'e2e5', newGame: () => {} };
    const chess = new Chess();
    expect(legalUciMoves(chess)).toContain(await chooseBotMove(chess, 'medium', liar));
  });

  it('reports a broken engine instead of freezing', async () => {
    const broken = { bestMove: async () => Promise.reject(new Error('boom')), newGame: () => {} };
    await expect(chooseBotMove(new Chess(), 'medium', broken)).rejects.toThrow('engine failed');
  });
});

describe('each level beats the one below it', () => {
  // Below full strength Stockfish picks among its moves with its own clock-seeded randomness, so these games can never be
  // exactly repeatable. One game could end in a draw by chance, so each pairing plays three, swapping colours, and the
  // stronger bot must win at least two and lose none. (Over 30 such games the stronger bot won every one.)
  for (const [strong, weak, seed] of [['easy', 'very-easy', 11], ['medium', 'easy', 12]] as const) {
    it(`${strong} beats ${weak}`, async () => {
      let wins = 0;
      let losses = 0;
      for (let game = 0; game < 3; game++) {
        engine.newGame();
        const chess = new Chess();
        const random = seeded(seed + game);
        const strongIsWhite = game % 2 === 0;
        for (let ply = 0; ply < 400 && !boardResult(chess); ply++) {
          const whiteToMove = ply % 2 === 0;
          playUci(chess, await chooseBotMove(chess, whiteToMove === strongIsWhite ? strong : weak, engine, random));
        }
        const winner = boardResult(chess)?.winner;
        if (winner === (strongIsWhite ? 'white' : 'black')) wins++;
        else if (winner) losses++;
      }
      expect(wins).toBeGreaterThanOrEqual(2);
      expect(losses).toBe(0);
    }, 120_000);
  }
});

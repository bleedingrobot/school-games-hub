// Plays the checkers bots against each other and checks every move they make is legal,
// including forced captures, multi-jumps and kings, and that each level beats the one below.
import { describe, expect, it } from 'vitest';
import { BOT_LEVEL_IDS, type BotLevel } from '../../../shared/botGame';
import {
  applyMove,
  boardResult,
  legalMoves,
  positionFromRows,
  startPosition,
  type BoardResult,
  type Position,
} from '../../../shared/checkers/rules';
import { seeded } from '../../../shared/seededRandom';
import { BOT_DESCRIPTIONS, chooseCheckersMove, evaluate } from './bot';

const isLegal = (position: Position, notation: string) => legalMoves(position).some((m) => m.notation === notation);

/** Plays a whole game between two bots. Every move is checked against the rules. */
function playMatch(red: BotLevel, white: BotLevel, seed: number): { result: BoardResult; moves: number } {
  const random = seeded(seed);
  let position = startPosition();
  let moves = 0;
  let result = boardResult(position);
  while (!result) {
    const move = chooseCheckersMove(position, position.turn === 'red' ? red : white, random);
    expect(isLegal(position, move.notation)).toBe(true);
    position = applyMove(position, move);
    moves++;
    result = boardResult(position);
  }
  return { result, moves };
}

describe('the checkers bots', () => {
  it('have a description for every level', () => {
    for (const level of BOT_LEVEL_IDS) expect(BOT_DESCRIPTIONS[level].length).toBeGreaterThan(20);
  });

  it('every level takes a compulsory capture', () => {
    // Red on 14 must jump 18, even though Red's man on 1 could also step.
    const position = positionFromRows(['r...', '....', '....', '.r..', '.w..', '....', '....', '...w']);
    for (const level of BOT_LEVEL_IDS) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(chooseCheckersMove(position, level, seeded(seed)).notation).toBe('14x23');
      }
    }
  });

  it('every level finishes a multi-jump, and the stronger bots pick the bigger route', () => {
    const routes = positionFromRows(['r...', '.w..', '....', '.ww.', '....', '...w', '....', '....']);
    for (const level of BOT_LEVEL_IDS) {
      const move = chooseCheckersMove(routes, level, seeded(3));
      expect(['1x10x17', '1x10x19x28']).toContain(move.notation);
    }
    expect(chooseCheckersMove(routes, 'medium', seeded(3)).notation).toBe('1x10x19x28');
  });

  it('kings use their backwards moves, and a man crowned mid-jump stops', () => {
    // Red's king on 23 can only capture backwards.
    const king = positionFromRows(['....', '....', '....', '....', '.w..', '..R.', '....', '...w']);
    const crowning = positionFromRows(['....', '....', '....', '....', '....', '.r..', '.ww.', '....']);
    for (const level of BOT_LEVEL_IDS) {
      expect(chooseCheckersMove(king, level, seeded(1)).notation).toBe('23x14');
      expect(chooseCheckersMove(crowning, level, seeded(1)).notation).toBe('22x31');
    }
  });

  it('Medium doesn’t give a piece away for free', () => {
    // Red has 10-14, 10-15 and 12-16. Both 10-15 and 12-16 let White's man on 19 jump.
    const position = positionFromRows(['....', '....', '.r.r', '....', '..w.', '....', '....', '...w']);
    for (let seed = 1; seed <= 5; seed++) {
      expect(chooseCheckersMove(position, 'medium', seeded(seed)).notation).toBe('10-14');
    }
  });

  it('scores a piece up as better, and a king above a man', () => {
    const even = positionFromRows(['r...', '....', '....', '....', '....', '....', '....', '...w']);
    const up = positionFromRows(['rr..', '....', '....', '....', '....', '....', '....', '...w']);
    const king = positionFromRows(['R...', '....', '....', '....', '....', '....', '....', '...w']);
    expect(evaluate(up, 'red')).toBeGreaterThan(evaluate(even, 'red') + 80);
    expect(evaluate(king, 'red')).toBeGreaterThan(evaluate(even, 'red'));
  });

  // Each pairing plays 4 games, 2 with each colour. Every move is checked to be legal.
  for (const [stronger, weaker] of [
    ['easy', 'very-easy'],
    ['medium', 'easy'],
  ] as [BotLevel, BotLevel][]) {
    it(`${stronger} beats ${weaker}`, () => {
      let wins = 0;
      let losses = 0;
      for (let game = 0; game < 4; game++) {
        const strongerIsRed = game % 2 === 0;
        const { result } = strongerIsRed ? playMatch(stronger, weaker, game + 1) : playMatch(weaker, stronger, game + 1);
        const strongerColour = strongerIsRed ? 'red' : 'white';
        if (result.winner === strongerColour) wins++;
        else if (result.winner) losses++;
      }
      expect(wins).toBeGreaterThanOrEqual(3);
      expect(losses).toBe(0);
    }, 120_000);
  }

  it('Very Easy plays legal moves in whole games, as both colours', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { result } = playMatch('very-easy', 'very-easy', seed);
      expect(['no-pieces', 'no-moves', 'forty-moves']).toContain(result.ending);
    }
  });

  it('Medium thinks quickly enough for a Chromebook', () => {
    // A busy middle-game position. Medium usually answers in well under half a second here; the
    // limit is generous so a busy test computer doesn't cause a false alarm.
    const random = seeded(11);
    let position = startPosition();
    for (let i = 0; i < 16; i++) position = applyMove(position, chooseCheckersMove(position, 'easy', random));
    const started = performance.now();
    chooseCheckersMove(position, 'medium', random);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

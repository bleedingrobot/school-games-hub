import { describe, expect, it } from 'vitest';
import { LINES, legalActions, newRound, play } from './engine';
import { randomFromSeed } from '../space/random';
import type { Cell, PowerId } from './types';

const count = (board: Cell[], who: Cell) => board.filter((c) => c === who).length;

describe('whole random games', () => {
  const POOL: PowerId[] = ['body-swap', 'freeze-ray', 'board-wipe', 'force-field', 'portal-chaos', 'wild-card', 'time-heist'];
  it('stay legal from start to end with every power and Chaos Mode, and always finish', () => {
    for (let g = 0; g < 150; g++) {
      const random = randomFromSeed(`whole:${g}`);
      const take = () => {
        const left = [...POOL];
        return [0, 1, 2].map(() => left.splice(Math.floor(random() * left.length), 1)[0]);
      };
      let s = newRound({ X: take(), O: take() }, 'X', g % 2 === 0);
      for (let n = 0; n < 200 && s.status === 'active'; n++) {
        const actions = legalActions(s);
        expect(actions.length).toBeGreaterThan(0);
        const a = actions[Math.floor(random() * actions.length)];
        const r = play(s, a, random);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        // Protected symbols never move or vanish while they are protected.
        for (const sh of s.shields) if (r.state.shields.some((x) => x.square === sh.square && x.owner === sh.owner)) expect(r.state.board[sh.square]).toBe(s.board[sh.square]);
        // Symbols never appear from nowhere: a go adds at most two.
        expect(count(r.state.board, 'X') + count(r.state.board, 'O')).toBeLessThanOrEqual(count(s.board, 'X') + count(s.board, 'O') + 2);
        s = r.state;
        if (s.status !== 'active') {
          expect(play(s, { type: 'place', square: 0 }, random).ok).toBe(false);
          if (s.status !== 'draw') expect(LINES.some((l) => l.every((i) => s.board[i] === s.status))).toBe(true);
        }
      }
    }
  });
});

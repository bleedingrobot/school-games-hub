import { describe, expect, it } from 'vitest';
import {
  LINES, newRound, play,
} from './engine';
import { newMatch, nextRound, scoreRound } from './match';
import type { Action, Cell, PowerClashState, PowerId } from './types';

const ALL: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const ALL2: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const fresh = () => newRound({ X: ALL, O: ALL2 }, 'X');

/** Make a state from a picture like "XO. .X. ..O". */
function from(picture: string, active: 'X' | 'O' = 'X'): PowerClashState {
  const board = picture.replace(/\s/g, '').split('').map((c): Cell => (c === '.' ? null : (c as Cell)));
  return { ...fresh(), board, active };
}
function ok(state: PowerClashState, action: Action) {
  const r = play(state, action);
  if (!r.ok) throw new Error(r.reason);
  return r;
}
const place = (s: PowerClashState, square: number) => ok(s, { type: 'place', square }).state;

describe('winning and drawing', () => {
  it('detects every winning line and a draw on a full board, and scores a match to three wins', () => {
    for (const [a, b, c] of LINES) {
      const board = Array(9).fill(null) as Cell[];
      const s = { ...fresh(), board: board.map((_, i) => (i === a || i === b ? 'X' : null)) };
      const r = ok(s, { type: 'place', square: c });
      expect(r.state.status).toBe('X');
      expect(r.state.line).toEqual([a, b, c]);
    }
    expect(place(from('XOX XOO OX.', 'X'), 8).status).toBe('draw');
    let m = newMatch({ X: ALL, O: ALL2 });
    for (let i = 0; i < 3; i++) {
      m = { ...m, state: place(from('XX. OO. ...', 'X'), 2) };
      m = scoreRound(m);
      m = scoreRound(m); // twice is harmless
      if (!m.winner) m = nextRound(m);
    }
    expect(m.score.X + m.score.O).toBe(3);
    expect(m.round).toBe(3);
  });
});

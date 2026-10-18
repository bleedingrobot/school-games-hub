import { describe, expect, it } from 'vitest';
import {
  LINES, newRound, play, powerBlockedReason, validLoadout,
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
  it.each(LINES)('detects the line %i,%i,%i', (a, b, c) => {
    const board = Array(9).fill(null) as Cell[];
    const s = { ...fresh(), board: board.map((_, i) => (i === a || i === b ? 'X' : null)) };
    const r = ok(s, { type: 'place', square: c });
    expect(r.state.status).toBe('X');
    expect(r.state.line).toEqual([a, b, c]);
  });
  it('is a draw on a full board with no line', () => {
    const s = from('XOX XOO OX.', 'X');
    expect(place(s, 8).status).toBe('draw');
  });
  it('allows no moves once the round is over', () => {
    const s = from('XX. OO. ...');
    const won = place(s, 2);
    expect(play(won, { type: 'place', square: 8 }).ok).toBe(false);
    expect(play(won, { type: 'skip' }).ok).toBe(false);
  });
  it('alternates turns and rejects occupied squares', () => {
    const s = place(fresh(), 4);
    expect(s.active).toBe('O');
    expect(play(s, { type: 'place', square: 4 }).ok).toBe(false);
  });
});

describe('charges', () => {
  it('rejects a power not in the loadout or already used', () => {
    expect(play(fresh(), { type: 'use-power', power: 'board-wipe', targets: [0] }).ok).toBe(false);
    let s = ok(fresh(), { type: 'use-power', power: 'freeze-ray', targets: [8] }).state;
    s = place(place(s, 0), 3); // X then O
    expect(powerBlockedReason(s, 'freeze-ray')).toBe('You have already used this power');
  });
  it('requires three different powers', () => {
    expect(validLoadout(['body-swap', 'body-swap', 'freeze-ray'])).toBe(false);
    expect(() => newRound({ X: ['body-swap'], O: ALL }, 'X')).toThrow();
  });
  it('does not change the old state', () => {
    const s = fresh();
    ok(s, { type: 'place', square: 0 });
    expect(s.board.every((c) => c === null)).toBe(true);
  });
});

describe('match', () => {
  it('scores rounds, alternates the starter, and ends at three wins', () => {
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
  it('refreshes powers and swaps who starts', () => {
    const m = nextRound(newMatch({ X: ALL, O: ALL2 }));
    expect(m.starter).toBe('O');
    expect(m.state.active).toBe('O');
    expect(m.state.used.X).toEqual([]);
  });
});

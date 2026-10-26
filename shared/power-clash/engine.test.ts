import { expect, it } from 'vitest';
import { LINES, newRound, play } from './engine';
import type { Cell, PowerId } from './types';

const ALL: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const fresh = () => newRound({ X: ALL, O: ALL }, 'X');

it('wins on every line, draws on a full board, takes turns, and allows no move on a taken square or after the end', () => {
  for (const [a, b, c] of LINES) {
    const s = { ...fresh(), board: Array.from({ length: 9 }, (_, i): Cell => (i === a || i === b ? 'X' : null)) };
    const r = play(s, { type: 'place', square: c });
    expect(r.ok && r.state.status).toBe('X');
    if (r.ok) expect(play(r.state, { type: 'place', square: r.state.board.indexOf(null) }).ok).toBe(false);
  }
  const full = { ...fresh(), board: 'XOXXOOOX.'.split('').map((ch): Cell => (ch === '.' ? null : (ch as Cell))) };
  const drawn = play(full, { type: 'place', square: 8 });
  expect(drawn.ok && drawn.state.status).toBe('draw');
  const moved = play(fresh(), { type: 'place', square: 4 });
  expect(moved.ok && moved.state.active).toBe('O');
  if (moved.ok) expect(play(moved.state, { type: 'place', square: 4 }).ok).toBe(false);
});

import { describe, expect, it } from 'vitest';
import {
  LINES, newRound, placeableSquares, play, powerBlockedReason, targetChoices, validLoadout,
} from './engine';
import { newMatch, nextRound, scoreRound } from './match';
import type { Action, Cell, PowerClashState, PowerId } from './types';

const ALL: PowerId[] = ['double-trouble', 'body-swap', 'freeze-ray'];
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

describe('Double Trouble', () => {
  const dt = (s: PowerClashState) => ok(s, { type: 'use-power', power: 'double-trouble', targets: [] }).state;
  it('gives two placements in one turn', () => {
    let s = dt(fresh());
    s = place(s, 0);
    expect(s.active).toBe('X');
    s = place(s, 1);
    expect(s.active).toBe('O');
  });
  it('stops after the first symbol if it wins', () => {
    const s = place(dt(from('XX. OO. ...')), 2);
    expect(s.status).toBe('X');
  });
  it('can win with the bonus symbol', () => {
    let s = dt(from('X.. O.. ...'));
    s = place(s, 1);
    expect(s.status).toBe('active');
    expect(place(s, 2).status).toBe('X');
  });
  it('needs two squares to place on', () => {
    expect(powerBlockedReason(from('XOX OXO OX.'), 'double-trouble')).toBeTruthy();
  });
  it('uses up the charge and allows only one power a turn', () => {
    const s = dt(fresh());
    expect(s.used.X).toEqual(['double-trouble']);
    expect(powerBlockedReason(s, 'freeze-ray')).toBe('One power per turn');
  });
  it('can use both symbols to fill the board', () => {
    const s = place(dt(from('XOX OXO ..O'.replace('XOX OXO ..O', 'OXO XOX ..X'))), 6);
    expect(s.status).toBe('active');
    expect(s.active).toBe('X');
    expect(place(s, 7).status).toBe('X'); // 6,7,8
  });
});

describe('Body Swap', () => {
  const swap = (s: PowerClashState, a: number, b: number) =>
    ok(s, { type: 'use-power', power: 'body-swap', targets: [a, b] });
  it('swaps one of mine with one of theirs', () => {
    const r = swap(from('X.. .O. ...'), 0, 4);
    expect(r.state.board[0]).toBe('O');
    expect(r.state.board[4]).toBe('X');
    expect(r.state.active).toBe('X');
  });
  it('can win before placing', () => {
    const r = swap(from('X.X .O. ..X'), 2, 4); // X moves from 2 to 4: 0,4,8
    expect(r.state.status).toBe('X');
  });
  it('mover wins when both players end up with a line', () => {
    // X: 0,1,3 ; O: 2,4,5. Swap 3(X)<->... craft: after swap X has 0,1,2 and O has 3,4,5.
    const both = from('XXO XOO ...', 'X');
    const r2 = swap(both, 3, 2); // X@3<->O@2 => X: 0,1,2  O: 3,4,5
    expect(r2.state.status).toBe('X');
    const both2 = from('XXO XOO ...', 'O');
    const r3 = swap({ ...both2, active: 'O' }, 2, 3);
    expect(r3.state.status).toBe('O');
  });
  it('rejects illegal targets and keeps the charge', () => {
    const s = from('X.. .O. ...');
    expect(play(s, { type: 'use-power', power: 'body-swap', targets: [4, 0] }).ok).toBe(false);
    expect(play(s, { type: 'use-power', power: 'body-swap', targets: [0, 1] }).ok).toBe(false);
    expect(play(s, { type: 'use-power', power: 'body-swap', targets: [0] }).ok).toBe(false);
    expect(s.used.X).toEqual([]);
  });
  it('cannot be chosen without one of each symbol', () => {
    expect(powerBlockedReason(fresh(), 'body-swap')).toBeTruthy();
    expect(powerBlockedReason(from('X.. ... ...'), 'body-swap')).toBeTruthy();
  });
});

describe('Freeze Ray', () => {
  const freeze = (s: PowerClashState, sq: number) =>
    ok(s, { type: 'use-power', power: 'freeze-ray', targets: [sq] }).state;
  it('blocks the opponent for one turn, then thaws', () => {
    let s = freeze(fresh(), 4);
    s = place(s, 0); // X places, turn passes
    expect(s.active).toBe('O');
    expect(placeableSquares(s)).not.toContain(4);
    expect(play(s, { type: 'place', square: 4 }).ok).toBe(false);
    s = place(s, 1);
    expect(s.frozen).toEqual([]);
    expect(placeableSquares(s)).toContain(4);
  });
  it('does not block the player who froze it', () => {
    const s = freeze(fresh(), 4);
    expect(placeableSquares(s)).toContain(4);
  });
  it('only targets empty squares', () => {
    expect(targetChoices(from('X.. ... ...'), 'freeze-ray', [])).not.toContain(0);
    expect(play(from('X.. ... ...'), { type: 'use-power', power: 'freeze-ray', targets: [0] }).ok).toBe(false);
  });
  it('lets a stuck player skip, and the freeze thaws', () => {
    let s = from('XOX OXO O..', 'X');
    s = freeze(s, 8);
    s = place(s, 7);
    expect(s.active).toBe('O');
    // O's only empty square (8) is frozen
    expect(placeableSquares(s)).toEqual([]);
    expect(play(s, { type: 'place', square: 8 }).ok).toBe(false);
    s = ok(s, { type: 'skip' }).state;
    expect(s.active).toBe('X');
    expect(s.frozen).toEqual([]);
  });
  it('rejects skip when a placement exists', () => {
    expect(play(fresh(), { type: 'skip' }).ok).toBe(false);
  });
});

describe('Board Wipe', () => {
  const wipe = (s: PowerClashState, sq: number) =>
    ok(s, { type: 'use-power', power: 'board-wipe', targets: [sq] });
  it('removes any symbol, mine or theirs', () => {
    const s = { ...from('X.. .O. ...', 'O') };
    expect(wipe(s, 4).state.board[4]).toBeNull();
    expect(wipe(s, 0).state.board[0]).toBeNull();
  });
  it('needs a symbol on the board', () => {
    const s = { ...fresh(), loadout: { X: ALL2, O: ALL2 } };
    expect(powerBlockedReason(s, 'board-wipe')).toBeTruthy();
  });
  it('rejects an empty square', () => {
    const s = { ...from('X.. ... ...'), loadout: { X: ALL2, O: ALL2 } };
    expect(play(s, { type: 'use-power', power: 'board-wipe', targets: [5] }).ok).toBe(false);
  });
  it('lets the player still place afterwards', () => {
    const s = { ...from('X.. .O. ...', 'O'), loadout: { X: ALL2, O: ALL2 } };
    const r = wipe(s, 0);
    expect(r.state.active).toBe('O');
    expect(place(r.state, 0).board[0]).toBe('O');
  });
});

describe('charges', () => {
  it('rejects a power not in the loadout or already used', () => {
    expect(play(fresh(), { type: 'use-power', power: 'board-wipe', targets: [0] }).ok).toBe(false);
    let s = ok(fresh(), { type: 'use-power', power: 'double-trouble', targets: [] }).state;
    s = place(place(s, 0), 1);
    s = place(place(s, 3), 4); // O then X
    expect(powerBlockedReason(s, 'double-trouble')).toBe('You have already used this power');
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

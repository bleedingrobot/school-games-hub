import { describe, expect, it } from 'vitest';
import {
  CHAOS_EVERY, FIXED_RANDOM, LINES, legalActions, newRound, placeableSquares, play, powerBlockedReason, targetChoices, timeoutTurn, winningLine,
} from './engine';
import { randomFromSeed } from '../space/random';
import type { Action, Cell, GameEvent, Player, PowerClashState, PowerId, Random } from './types';

const NEW4: PowerId[] = ['force-field', 'portal-chaos', 'wild-card'];
const HEIST: PowerId[] = ['time-heist', 'double-trouble', 'freeze-ray'];

/** A round with a board drawn as a picture like "XO. .X. ..O". */
function rig(picture: string, active: Player = 'X', loadout: Partial<Record<Player, PowerId[]>> = {}, chaos = false): PowerClashState {
  const board = picture.replace(/\s/g, '').split('').map((c): Cell => (c === '.' ? null : (c as Cell)));
  const base = newRound({ X: loadout.X ?? NEW4, O: loadout.O ?? NEW4 }, 'X', chaos);
  return { ...base, board, active };
}
const ok = (state: PowerClashState, action: Action, random: Random = FIXED_RANDOM) => {
  const r = play(state, action, random);
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const power = (p: PowerId, ...targets: number[]): Action => ({ type: 'use-power', power: p, targets });
const place = (s: PowerClashState, square: number, random: Random = FIXED_RANDOM) => ok(s, { type: 'place', square }, random).state;
const count = (board: Cell[], who: Cell) => board.filter((c) => c === who).length;
const kinds = (events: GameEvent[]) => events.map((e) => e.kind);
/** Dice that give back these numbers one after another. */
const dice = (...values: number[]): Random => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('Force Field', () => {
  it('can only be put on one of your own symbols', () => {
    const s = rig('XO. ... ...');
    expect(targetChoices(s, 'force-field', [])).toEqual([0]);
    expect(play(s, power('force-field', 1)).ok).toBe(false);
    expect(play(s, power('force-field', 5)).ok).toBe(false);
  });
  it('has no target, and keeps its charge, when you have no symbol', () => {
    const s = rig('.O. ... ...');
    expect(powerBlockedReason(s, 'force-field')).toMatch(/your symbols/);
    expect(play(s, power('force-field')).ok).toBe(false);
    expect(s.used.X).toEqual([]);
  });
  it('uses the charge and protects the symbol', () => {
    const r = ok(rig('XO. ... ...'), power('force-field', 0));
    expect(r.state.used.X).toEqual(['force-field']);
    expect(r.state.shields).toEqual([{ square: 0, owner: 'X' }]);
    expect(kinds(r.events)).toEqual(['force-field']);
  });
  it('stops Body Swap, Board Wipe, Portal Chaos and Wild Card from touching the symbol', () => {
    const s = place(ok(rig('XO. ... ...', 'X', { X: NEW4, O: ['body-swap', 'board-wipe', 'portal-chaos'] }), power('force-field', 0)).state, 8);
    expect(s.active).toBe('O');
    expect(targetChoices(s, 'body-swap', [])).toEqual([1]);
    expect(targetChoices(s, 'board-wipe', [])).toEqual([1, 8]);
    expect(targetChoices(s, 'portal-chaos', [])).toEqual([1, 8]);
    expect(play(s, power('body-swap', 1, 0)).ok).toBe(false);
    expect(play(s, power('board-wipe', 0)).ok).toBe(false);
    expect(play(s, power('portal-chaos', 0, 1)).ok).toBe(false);
  });
  it('wears off when the other player finishes their turn, and says so', () => {
    let s = place(ok(rig('XO. ... ...'), power('force-field', 0)).state, 8);
    expect(s.shields).toHaveLength(1);
    const r = ok(s, { type: 'place', square: 4 });
    s = r.state;
    expect(s.shields).toEqual([]);
    expect(kinds(r.events)).toContain('shield-off');
  });
  it('still works if the other player misses their go on the clock', () => {
    const s = place(ok(rig('XO. ... ...'), power('force-field', 0)).state, 8);
    const r = timeoutTurn(s);
    expect(r.ok && r.state.shields).toEqual([]);
  });
});

describe('Portal Chaos', () => {
  const portal = (s: PowerClashState, a: number, b: number, random: Random = FIXED_RANDOM) => ok(s, power('portal-chaos', a, b), random);
  it('needs two different symbols that are not protected', () => {
    expect(powerBlockedReason(rig('X.. ... ...'), 'portal-chaos')).toMatch(/two symbols/);
    expect(play(rig('XO. ... ...'), power('portal-chaos', 0, 0)).ok).toBe(false);
    expect(play(rig('XO. ... ...'), power('portal-chaos', 0, 2)).ok).toBe(false);
  });
  it('always changes the board and keeps every symbol', () => {
    for (let n = 0; n < 200; n++) {
      const random = randomFromSeed(`portal:${n}`);
      const s = rig('XOX .O. X..');
      const r = portal(s, 0, 1, random);
      expect(r.state.board).not.toEqual(s.board);
      expect(count(r.state.board, 'X')).toBe(3);
      expect(count(r.state.board, 'O')).toBe(2);
    }
  });
  it('throws the two symbols only to their own squares or to empty squares', () => {
    for (let n = 0; n < 100; n++) {
      const s = rig('XOX OXO ...');
      const r = portal(s, 0, 1, randomFromSeed(`p2:${n}`));
      const e = r.events[0];
      if (e.kind !== 'portal-chaos') throw new Error('wrong event');
      for (const d of e.to) expect([0, 1, 6, 7, 8]).toContain(d);
      expect(e.to[0]).not.toBe(e.to[1]);
      // The symbols on the squares that were not picked or empty stay where they were.
      for (const i of [2, 3, 4, 5]) expect(r.state.board[i]).toBe(s.board[i]);
    }
  });
  it('never lands on a frozen square', () => {
    for (let n = 0; n < 100; n++) {
      const s = { ...rig('XO. ... ...'), frozen: [{ square: 2, blockedFor: 'O' as Player }, { square: 3, blockedFor: 'O' as Player }] };
      const r = portal(s, 0, 1, randomFromSeed(`p3:${n}`));
      expect(r.state.board[2]).toBeNull();
      expect(r.state.board[3]).toBeNull();
    }
  });
  it('is a certain swap when the board is full and the two symbols differ', () => {
    const s = rig('XOX OXO OXO');
    expect(powerBlockedReason(s, 'portal-chaos')).toBeNull();
    const r = portal(s, 0, 1);
    expect(r.state.board.slice(0, 2)).toEqual(['O', 'X']);
  });
  it('can not be used on two equal symbols when nothing could change', () => {
    const s = rig('XOX OXO OXO');
    const picks = targetChoices(s, 'portal-chaos', [0]);
    expect(picks).toContain(1);
    // The equal symbols on a full board have nowhere to go, so they are not offered.
    for (const same of [2, 4, 7]) expect(picks).not.toContain(same);
    const full = rig('XOX XOO OXX');
    expect(targetChoices(full, 'portal-chaos', [0])).not.toContain(2);
  });
  it('gives the same result for the same dice and a different one for different dice', () => {
    const s = rig('XO. ... ...');
    const a = portal(s, 0, 1, dice(0, 0)).state.board;
    const b = portal(s, 0, 1, dice(0, 0)).state.board;
    const c = portal(s, 0, 1, dice(0.99, 0.99)).state.board;
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });
  it('never hands the other player a line', () => {
    // O O . / X . . / X . . : any throw that leaves OO_ completed for O alone is not allowed when X moves.
    for (let n = 0; n < 300; n++) {
      const s = rig('OO. XX. ...', 'X');
      if (powerBlockedReason(s, 'portal-chaos')) continue;
      const first = targetChoices(s, 'portal-chaos', [])[0];
      const second = targetChoices(s, 'portal-chaos', [first])[0];
      const r = portal(s, first, second, randomFromSeed(`p4:${n}`));
      const x = winningLine(r.state.board, 'X');
      const o = winningLine(r.state.board, 'O');
      expect(o && !x).toBeFalsy();
    }
  });
  it('lets the player who threw the symbols win if both get a line', () => {
    let found = false;
    for (let n = 0; n < 400 && !found; n++) {
      const s = rig('XX. OO. ..X', 'X');
      const r = portal(s, 8, 4, randomFromSeed(`p5:${n}`));
      if (r.state.status !== 'active') {
        expect(r.state.status).toBe('X');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it('ends the round at once if it makes a line for the mover, with no placement after', () => {
    const s = rig('X.X O.O ...');
    // Put 0 at... find dice that move the symbol on 3 to 1? Search for any outcome that wins.
    let won: PowerClashState | null = null;
    for (let n = 0; n < 200 && !won; n++) {
      const r = portal(s, 0, 3, randomFromSeed(`p6:${n}`));
      if (r.state.status === 'X') won = r.state;
    }
    if (won) {
      expect(play(won, { type: 'place', square: 8 }).ok).toBe(false);
      expect(won.line).not.toBeNull();
    }
  });
});

describe('Wild Card', () => {
  const wild = (s: PowerClashState, random: Random = FIXED_RANDOM) => ok(s, power('wild-card'), random);
  it('only does things that have a target (empty board: a bonus place or a freeze)', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) {
      const r = wild(rig('... ... ...'), randomFromSeed(`w1:${n}`));
      const e = r.events[0];
      if (e.kind === 'wild-card') seen.add(e.effect);
    }
    expect([...seen].sort()).toEqual(['bonus', 'freeze']);
  });
  it('can do all four things when it can', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 400; n++) {
      const r = wild(rig('XO. ... ...'), randomFromSeed(`w2:${n}`));
      const e = r.events[0];
      if (e.kind === 'wild-card') seen.add(e.effect);
    }
    expect([...seen].sort()).toEqual(['bonus', 'freeze', 'remove', 'swap']);
  });
  it('shows what it did as ordinary events after the wheel', () => {
    for (let n = 0; n < 200; n++) {
      const r = wild(rig('XO. ... ...'), randomFromSeed(`w3:${n}`));
      const [first, second] = r.events;
      expect(first.kind).toBe('wild-card');
      const effect = first.kind === 'wild-card' ? first.effect : 'bonus';
      expect(second.kind).toBe({ bonus: 'double-trouble', freeze: 'freeze', swap: 'body-swap', remove: 'wipe' }[effect]);
    }
  });
  it('never touches a protected symbol', () => {
    for (let n = 0; n < 300; n++) {
      const s = { ...rig('XOO ... ...'), shields: [{ square: 1, owner: 'O' as Player }, { square: 0, owner: 'X' as Player }] };
      const r = wild(s, randomFromSeed(`w4:${n}`));
      expect(r.state.board[0]).toBe('X');
      expect(r.state.board[1]).toBe('O');
    }
  });
  it('is greyed out when nothing can happen', () => {
    // Full board of protected symbols? One empty square frozen already, symbols all protected.
    const s = {
      ...rig('XOX OXO OX.'),
      shields: [0, 1, 2, 3, 4, 5, 6, 7].map((square) => ({ square, owner: (square % 2 === 0 ? 'X' : 'O') as Player })),
      frozen: [{ square: 8, blockedFor: 'O' as Player }],
    };
    expect(powerBlockedReason(s, 'wild-card')).toMatch(/Nothing wild/);
    expect(s.used.X).toEqual([]);
  });
  it('never gives the other player a win, and keeps its charge used only on success', () => {
    for (let n = 0; n < 400; n++) {
      const s = rig('OO. X.X .X.', 'X');
      const r = wild(s, randomFromSeed(`w5:${n}`));
      expect(r.state.used.X).toEqual(['wild-card']);
      const x = winningLine(r.state.board, 'X');
      const o = winningLine(r.state.board, 'O');
      expect(o && !x).toBeFalsy();
    }
  });
  it('gives the same result for the same dice', () => {
    const s = rig('XO. ... ...');
    expect(wild(s, dice(0.3, 0.6)).events).toEqual(wild(s, dice(0.3, 0.6)).events);
  });
  it('a bonus placement lets you place twice, and a win on the first stops the second', () => {
    const s = rig('XX. OO. ...');
    let bonus: PowerClashState | null = null;
    for (let n = 0; n < 100 && !bonus; n++) {
      const r = wild(s, randomFromSeed(`w6:${n}`));
      if (r.events[0].kind === 'wild-card' && r.events[0].effect === 'bonus') bonus = r.state;
    }
    expect(bonus?.placesLeft).toBe(2);
    const won = place(bonus!, 2);
    expect(won.status).toBe('X');
  });
});

describe('Time Heist', () => {
  const heistLoad = { X: HEIST, O: HEIST };
  const start = () => rig('... ... ...', 'X', heistLoad);
  it('can not be used before anyone has finished a turn', () => {
    expect(powerBlockedReason(start(), 'time-heist')).toMatch(/finished a go/);
    expect(play(start(), power('time-heist')).ok).toBe(false);
  });
  it('can be used once the other player has finished one', () => {
    const s = place(start(), 4);
    expect(powerBlockedReason(s, 'time-heist')).toBeNull();
  });
  it('wipes out the other player\'s last go: board, powers, frozen squares, protection', () => {
    let s = place(start(), 4);
    // O freezes square 0 for X and places on 8.
    s = ok(s, power('freeze-ray', 0)).state;
    s = place(s, 8);
    expect(s.frozen).toEqual([{ square: 0, blockedFor: 'X' }]);
    expect(s.used.O).toEqual(['freeze-ray']);
    const r = ok(s, power('time-heist'));
    expect(r.state.board).toEqual([null, null, null, null, 'X', null, null, null, null]);
    expect(r.state.frozen).toEqual([]);
    expect(r.state.used.O).toEqual([]);
    expect(r.state.used.X).toEqual(['time-heist']);
    expect(r.state.active).toBe('X');
    expect(r.state.status).toBe('active');
    expect(kinds(r.events)).toEqual(['time-heist']);
  });
  it('brings back a Force Field that went up in their last go (and what had worn off)', () => {
    let s = rig('XO. ... ...', 'X', { X: NEW4, O: HEIST });
    s = ok(s, power('force-field', 0)).state;
    s = place(s, 8); // X's turn done: shield stays for O's turn.
    s = ok(s, power('time-heist')).state; // O undoes X's go
    expect(s.shields).toEqual([]);
    expect(s.board[8]).toBeNull();
  });
  it('lets you go on with your own turn and place a symbol', () => {
    let s = place(start(), 4);
    s = ok(s, power('time-heist')).state;
    expect(s.placesLeft).toBe(1);
    expect(s.powerThisTurn).toBe('time-heist');
    s = place(s, 0);
    expect(s.board[0]).toBe('O');
    expect(s.board[4]).toBeNull();
    expect(s.active).toBe('X');
  });
  it('is one power a turn', () => {
    const s = ok(place(start(), 4), power('time-heist')).state;
    expect(powerBlockedReason(s, 'double-trouble')).toBe('One power per turn');
  });
  it('can not be used again (once per match) and can not be undone (no loops)', () => {
    let s = ok(place(start(), 4), power('time-heist')).state;
    s = place(s, 0); // O finishes, having used a Time Heist
    expect(powerBlockedReason(s, 'time-heist')).toBe('A Time Heist can’t be undone');
    // The same player can not use it twice either.
    s = place(s, 5);
    s = place(s, 6);
    s = place(s, 7);
    expect(s.active).toBe('O');
    expect(powerBlockedReason(s, 'time-heist')).toBe('You have already used this power');
  });
  it('has nothing to undo if their last go changed nothing', () => {
    let s = rig('... ... ...', 'X', heistLoad);
    s = { ...s, frozen: [] };
    const skipped = timeoutTurn(s);
    if (!skipped.ok) throw new Error('timeout failed');
    expect(powerBlockedReason(skipped.state, 'time-heist')).toBe('Their last go changed nothing');
  });
  it('only works while the round is active', () => {
    let s = rig('XX. OO. ...', 'X', heistLoad);
    s = place(s, 2);
    expect(s.status).toBe('X');
    expect(powerBlockedReason(s, 'time-heist')).toBe('The round is over');
  });
  it('starts again each round', () => {
    const s = newRound({ X: HEIST, O: HEIST }, 'O');
    expect(s.rewind).toBeNull();
  });
  it('only needs a small snapshot (the saved game stays small)', () => {
    let s = start();
    const random = randomFromSeed('size');
    for (let n = 0; n < 6; n++) {
      const actions = legalActions(s);
      s = ok(s, actions.find((a) => a.type === 'place') ?? actions[0], random).state;
    }
    expect(JSON.stringify(s).length).toBeLessThan(2500);
  });
});

describe('Chaos Mode', () => {
  const chaosLoad = { X: HEIST, O: HEIST };
  /** Plays three quiet goes so a surprise comes after the third. */
  function threeGoes(random: Random, picture = '... ... ...') {
    let s = rig(picture, 'X', chaosLoad, true);
    const squares = placeableSquares(s);
    let events: GameEvent[] = [];
    for (let n = 0; n < CHAOS_EVERY; n++) {
      const r = ok(s, { type: 'place', square: placeableSquares(s)[n % 2 === 0 ? 0 : 1] }, random);
      s = r.state;
      events = r.events;
    }
    expect(squares.length).toBeGreaterThan(0);
    return { s, events };
  }
  it('never happens in a normal round', () => {
    let s = rig('... ... ...', 'X', chaosLoad);
    for (let n = 0; n < 6; n++) {
      const r = ok(s, { type: 'place', square: placeableSquares(s)[0] }, randomFromSeed(`n:${n}`));
      expect(kinds(r.events)).not.toContain('chaos');
      s = r.state;
    }
  });
  it('happens after every third go in Chaos Mode, and says what it was', () => {
    let hits = 0;
    for (let n = 0; n < 40; n++) {
      const { events } = threeGoes(randomFromSeed(`c1:${n}`));
      const chaos = events.find((e) => e.kind === 'chaos');
      if (chaos) hits++;
    }
    expect(hits).toBe(40);
  });
  it('does not happen after goes 1, 2, 4 or 5', () => {
    for (let g = 0; g < 30; g++) {
      let s = rig('... ... ...', 'X', chaosLoad, true);
      const seen: boolean[] = [];
      for (let n = 0; n < 6 && s.status === 'active'; n++) {
        const r = ok(s, { type: 'place', square: placeableSquares(s)[0] }, randomFromSeed(`c2:${g}:${n}`));
        seen.push(kinds(r.events).includes('chaos'));
        s = r.state;
      }
      expect(seen.slice(0, 5)).toEqual([false, false, true, false, false].slice(0, seen.length));
    }
  });
  it('can bring every kind of surprise', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 600; n++) {
      // Set up a position where all five can happen after the third go.
      let s = rig('XO. ... ...', 'X', chaosLoad, true);
      s = { ...s, used: { X: ['freeze-ray'], O: ['freeze-ray'] }, turns: CHAOS_EVERY - 1 };
      const r = ok(s, { type: 'place', square: 8 }, randomFromSeed(`c3:${n}`));
      for (const e of r.events) if (e.kind === 'chaos') seen.add(e.event);
    }
    expect([...seen].sort()).toEqual(['earthquake', 'frost-wave', 'lucky-star', 'meteor', 'recharge']);
  });
  it('never makes a line, never touches a protected symbol, and every effect really happens', () => {
    const seenKinds = new Set<string>();
    for (let n = 0; n < 500; n++) {
      let s = rig('XO. ..X O..', 'X', chaosLoad, true);
      s = { ...s, turns: CHAOS_EVERY - 1, shields: [{ square: 0, owner: 'X' }], used: { X: [], O: ['time-heist'] } };
      const before = s;
      const r = ok(s, { type: 'place', square: 4 }, randomFromSeed(`c4:${n}`));
      const hit = r.events.find((e) => e.kind === 'chaos');
      if (hit?.kind === 'chaos') seenKinds.add(hit.event);
      const chaos = r.events.find((e) => e.kind === 'chaos');
      if (!chaos || chaos.kind !== 'chaos') continue;
      expect(r.state.status).toBe('active');
      expect(r.state.board[0]).toBe('X');
      expect(winningLine(r.state.board, 'X')).toBeNull();
      expect(winningLine(r.state.board, 'O')).toBeNull();
      if (chaos.event === 'meteor') expect(count(r.state.board, 'X') + count(r.state.board, 'O')).toBe(count(before.board, 'X') + count(before.board, 'O'));
      if (chaos.event === 'lucky-star') expect(r.state.placesLeft).toBe(2);
      if (chaos.event === 'recharge') expect(r.state.used.O).toEqual([]);
      if (chaos.event === 'frost-wave') expect(r.state.frozen.some((f) => f.blockedFor === 'O' && f.square === chaos.squares[0])).toBe(true);
      expect(chaos.affects).toBe('O');
    }
    expect(seenKinds.size).toBeGreaterThanOrEqual(4);
  });
  it('is the same for the same dice', () => {
    expect(threeGoes(randomFromSeed('same')).s).toEqual(threeGoes(randomFromSeed('same')).s);
  });
  it('also happens when a turn is missed on the clock', () => {
    let s = rig('XO. ... ...', 'X', chaosLoad, true);
    s = { ...s, turns: CHAOS_EVERY - 1 };
    const r = timeoutTurn(s, randomFromSeed('t'));
    expect(r.ok && r.events.some((e) => e.kind === 'chaos')).toBe(true);
  });
  it('is undone with the go it followed, if that go is undone by a Time Heist', () => {
    let s = rig('... ... ...', 'X', chaosLoad, true);
    const random = randomFromSeed('heist');
    s = place(s, 0, random);
    s = place(s, 1, random);
    const r3 = ok(s, { type: 'place', square: 2 }, random);
    expect(r3.events.some((e) => e.kind === 'chaos')).toBe(true);
    const back = ok(r3.state, power('time-heist'), random);
    expect(back.state.board).toEqual(s.board);
    expect(back.state.turns).toBe(2);
  });
});

describe('whole random games', () => {
  const POOL: PowerId[] = ['double-trouble', 'body-swap', 'freeze-ray', 'board-wipe', 'force-field', 'portal-chaos', 'wild-card', 'time-heist'];
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
        expect(count(r.state.board, 'X') + count(r.state.board, 'O')).toBeLessThanOrEqual(count(s.board, 'X') + count(s.board, 'O') + 2 + (a.type === 'use-power' && a.power === 'time-heist' ? 0 : 0));
        s = r.state;
        if (s.status !== 'active') {
          expect(play(s, { type: 'place', square: 0 }, random).ok).toBe(false);
          if (s.status !== 'draw') expect(LINES.some((l) => l.every((i) => s.board[i] === s.status))).toBe(true);
        }
      }
    }
  });
});

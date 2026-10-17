import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import { randomFromSeed } from '../space/random';
import { chooseAction, chooseLoadout, MEDIUM_POWERS } from './bot';
import { legalActions, newRound, play, validLoadout } from './engine';
import { simulate } from './sim';
import type { Action, Cell, PowerClashState, PowerId } from './types';

const A: PowerId[] = ['double-trouble', 'body-swap', 'freeze-ray'];
const B: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const LEVELS = ['very-easy', 'easy', 'medium'] as const;

function from(picture: string, active: 'X' | 'O' = 'X', loadout = { X: A, O: B }): PowerClashState {
  const board = picture.replace(/\s/g, '').split('').map((c): Cell => (c === '.' ? null : (c as Cell)));
  return { ...newRound(loadout, active), board };
}

/** The bot plays on until the turn passes (a power, then a square, is two actions). */
function wholeTurn(state: PowerClashState, level: (typeof LEVELS)[number], random: () => number) {
  const me = state.active;
  let s = state;
  for (let i = 0; i < 4 && s.status === 'active' && s.active === me; i++) {
    const r = play(s, chooseAction(s, level, random));
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
}

describe('the bots always play legally', () => {
  it.each(LEVELS)('%s only ever picks an action the engine lists', (level) => {
    const games = level === 'medium' ? 3 : 25;
    for (let g = 0; g < games; g++) {
      const random = randomFromSeed(`legal:${level}:${g}`);
      let s = newRound({ X: chooseLoadout(level, random), O: chooseLoadout('very-easy', random) }, g % 2 ? 'O' : 'X');
      for (let i = 0; i < 60 && s.status === 'active'; i++) {
        const legal = legalActions(s);
        const action = chooseAction(s, s.active === 'X' ? level : 'very-easy', random);
        expect(legal).toContainEqual(action);
        const r = play(s, action);
        expect(r.ok).toBe(true);
        if (r.ok) s = r.state;
      }
    }
  });

  it('handles a turn where every empty square is frozen', () => {
    const s = { ...from('XO. OX. ...', 'O'), frozen: [2, 5, 6, 7, 8].map((square) => ({ square, blockedFor: 'O' as const })) };
    for (const level of LEVELS) {
      const action = chooseAction({ ...s, loadout: { X: A, O: A }, used: { X: [], O: A } }, level, seeded(1) as () => number);
      expect(action).toEqual({ type: 'skip' });
    }
  });

  it('picks three different powers, and Medium always the same three', () => {
    for (let i = 0; i < 30; i++) for (const level of ['very-easy', 'easy'] as const) expect(validLoadout(chooseLoadout(level, randomFromSeed(`p${i}`)))).toBe(true);
    expect(chooseLoadout('medium', randomFromSeed('a'))).toEqual(MEDIUM_POWERS);
    expect(chooseLoadout('medium', randomFromSeed('b'))).toEqual(MEDIUM_POWERS);
    expect(validLoadout(MEDIUM_POWERS)).toBe(true);
  });
});

describe('Easy and Medium take a win they can see', () => {
  // X has two in the top row and the third square is free.
  const winnable = () => from('XX. OO. ...', 'X');
  it('Medium always wins when it can', () => {
    for (let i = 0; i < 20; i++) {
      const s = wholeTurn(winnable(), 'medium', randomFromSeed(`win${i}`));
      expect(s.status).toBe('X');
    }
  });
  it('Easy nearly always does', () => {
    let wins = 0;
    for (let i = 0; i < 40; i++) if (wholeTurn(winnable(), 'easy', randomFromSeed(`win${i}`)).status === 'X') wins++;
    expect(wins).toBeGreaterThanOrEqual(34);
  });
  it('sees a win made by a power (Body Swap completes a line)', () => {
    // X: top-left, top-middle; O sits on the top-right; X has another symbol at the bottom. Swapping X(8) with O(2) wins.
    const s = from('XXO O.. ..X', 'X', { X: A, O: B });
    expect(wholeTurn(s, 'medium', randomFromSeed('swap')).status).toBe('X');
  });
});

describe('Easy and Medium block a win they can see', () => {
  // O (the bot) must stop X finishing the top row. O has no win of its own.
  const threatened = () => from('XX. .O. ...', 'O', { X: A, O: A });
  const xCanWin = (s: PowerClashState) => s.active === 'X' && legalActions(s).some((a) => {
    const r = play(s, a);
    return r.ok && r.state.status === 'X';
  });
  it('Medium stops it nearly every time', () => {
    let stopped = 0;
    for (let i = 0; i < 40; i++) if (!xCanWin(wholeTurn(threatened(), 'medium', randomFromSeed(`block${i}`)))) stopped++;
    expect(stopped).toBeGreaterThanOrEqual(34);
  });
  it('Easy stops it most of the time, but not always', () => {
    let stopped = 0;
    for (let i = 0; i < 60; i++) if (!xCanWin(wholeTurn(threatened(), 'easy', randomFromSeed(`block${i}`)))) stopped++;
    expect(stopped).toBeGreaterThanOrEqual(30);
    expect(stopped).toBeLessThan(60);
  });
});

describe('the bots are repeatable', () => {
  it.each(LEVELS)('%s makes the same choice from the same seed', (level) => {
    const s = from('X.. .O. ..X', 'X', { X: A, O: B });
    const a: Action = chooseAction(s, level, randomFromSeed('same'));
    const b: Action = chooseAction(s, level, randomFromSeed('same'));
    expect(a).toEqual(b);
  });
  it('whole simulated matches are identical for a seed', () => {
    const a = simulate({ a: 'easy', b: 'very-easy', matches: 5, seed: 'r' });
    const b = simulate({ a: 'easy', b: 'very-easy', matches: 5, seed: 'r' });
    expect({ ...a, slowestMs: 0, meanMs: 0 }).toEqual({ ...b, slowestMs: 0, meanMs: 0 });
  });
});

describe('Medium is quick', () => {
  it('thinks for well under half a second, even with every power left and a busy board', () => {
    const s = from('X.O .X. O..', 'X', { X: MEDIUM_POWERS, O: [...MEDIUM_POWERS] });
    const t = performance.now();
    chooseAction(s, 'medium', randomFromSeed('slow'));
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe('the levels are clearly different', () => {
  it('Easy beats Very Easy and Medium beats Easy, by a wide margin', () => {
    const easy = simulate({ a: 'easy', b: 'very-easy', matches: 30, seed: 'strength' });
    expect(easy.aRoundShare).toBeGreaterThan(0.7);
    const medium = simulate({ a: 'medium', b: 'easy', matches: 8, seed: 'strength' });
    expect(medium.aRoundShare).toBeGreaterThan(0.7);
  }, 60000);
});

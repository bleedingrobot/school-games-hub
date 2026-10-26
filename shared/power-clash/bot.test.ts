import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { chooseAction, chooseLoadout } from './bot';
import { legalActions, newRound, play } from './engine';

const LEVELS = ['very-easy', 'easy', 'medium'] as const;

describe('the bots always play legally', () => {
  it('only ever pick an action the engine lists, at every level', () => {
    for (const level of LEVELS) {
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
    }
  });
});

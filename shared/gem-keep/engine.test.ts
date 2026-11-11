import { describe, expect, it } from 'vitest';
import { MATHS } from './config';
import { act, newGame } from './engine';
import { type LevelData } from './level';

/** A straight path along row 5, left to right, with the Keep at the end. */
const STRAIGHT: LevelData = {
  id: 'test',
  name: 'Test',
  map: Array(10).fill('................'),
  paths: [[[-1, 5], [15, 5]]],
  startMana: 1000,
  waves: [{ groups: [{ kind: 'walker', count: 1, gap: 0 }] }, { groups: [{ kind: 'walker', count: 1, gap: 0 }] }],
};

describe('maths rewards', () => {
  it('the Mana Well pays for right answers, adds a streak bonus, and never takes mana for wrong ones', () => {
    const state = newGame(STRAIGHT);
    const start = state.mana;
    act(state, { type: 'well-answer', correct: true });
    act(state, { type: 'well-answer', correct: true });
    expect(state.mana).toBe(start + 2 * MATHS.well.mana);
    act(state, { type: 'well-answer', correct: true }); // third in a row: bonus
    expect(state.mana).toBe(start + 3 * MATHS.well.mana + MATHS.well.streakBonus);
    const before = state.mana;
    act(state, { type: 'well-answer', correct: false });
    expect(state.mana).toBe(before);
    expect(state.wellStreak).toBe(0);
    expect(state.stats).toMatchObject({ wellAsked: 4, wellRight: 3 });
  });
});

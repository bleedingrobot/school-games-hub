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
    // Three right is worth what ten right in a row was before the well was cut to three questions.
    expect(state.mana - start).toBe(190);
    expect(state.wellLeft).toBe(0);
    expect(state.stats).toMatchObject({ wellAsked: 3, wellRight: 3 });
  });

  it('a wrong answer at the Mana Well takes nothing and ends the streak', () => {
    const state = newGame(STRAIGHT);
    act(state, { type: 'well-answer', correct: true });
    const before = state.mana;
    act(state, { type: 'well-answer', correct: false });
    expect(state.mana).toBe(before);
    expect(state.wellStreak).toBe(0);
    expect(state.stats).toMatchObject({ wellAsked: 2, wellRight: 1 });
  });
});

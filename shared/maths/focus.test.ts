import { solveClaim } from './claim';
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import {
  makeFocusPack,
  solveParts,
  type MathsFocus,
} from './focus';
import { focusPools, LADDER, } from './ladder';

const focus = (skills: string[], extra: Partial<MathsFocus> = {}): MathsFocus => ({
  source: 'teacher-class',
  skills,
  onlyThese: false,
  endsAt: null,
  canChoose: true,
  own: null,
  ...extra,
});

describe('the keys a focus draws from', () => {
  it('uses the chosen skills as focus and the earlier ones as review', () => {
    const pools = focusPools({ skills: ['tables-6-9'], onlyThese: false });
    expect(pools.focus).toContain('mul:6x7');
    expect(pools.focus).toContain('div:54/6');
    expect(pools.review).toContain('mul:2x5');
    expect(pools.review).toContain('bond10:3+7');
    expect(pools.focus.some((k) => pools.review.includes(k))).toBe(false);
    expect(pools.stretch).toEqual([]);
  });
});

describe('marking a question from the screen', () => {
  it('agrees with every question the focus pack can make', () => {
    // Every built skill, many seeds, every shape, with and without multiple choice and division.
    for (const skill of LADDER.filter((s) => s.built)) {
      const pack = makeFocusPack([], focus([skill.id], { onlyThese: true }), { division: true }, randomFromSeed(`solve-${skill.id}`));
      for (let i = 0; i < 25; i++) {
        const q = pack.nextQuestion({ division: true, missingFactor: true })!;
        // A browser sends the record and the numbers with the answer; the server makes the question again from them.
        const solved = solveClaim({ parts: q.parts, key: q.factKey, params: q.params });
        expect(solved, `${skill.id}: ${q.parts.join(' ')}`).not.toBeNull();
        expect(solved!.answer, `${skill.id}: ${q.parts.join(' ')}`).toBe(q.answer);
        expect(solved!.keys, `${skill.id}: ${q.parts.join(' ')} should count towards ${q.factKey}`).toContain(q.factKey);
        pack.recordAnswer(q, q.answer, 3000);
      }
    }
  });

  it('turns down shapes no skill asks, and impossible numbers', () => {
    expect(solveParts(null)).toBeNull();
    expect(solveParts('7 + 3 = ?')).toBeNull();
    expect(solveParts(['7', '+', '?', '=', '?'])).toBeNull();
    expect(solveParts(['7', '+', '3', '=', '10'])).toBeNull();
    expect(solveParts(['? ', '−', '3', '=', '4'])).toBeNull();
    expect(solveParts(['3', '−', '7', '=', '?'])).toBeNull(); // negative
    expect(solveParts(['7', '÷', '2', '=', '?'])).toBeNull(); // not whole
    expect(solveParts(['7', '÷', '0', '=', '?'])).toBeNull();
    expect(solveParts(['13', '×', '2', '=', '?'])).toBeNull(); // not a times-table fact
    expect(solveParts(['999', '+', '999', '=', '?'])).toBeNull(); // no ladder key
    expect(solveParts(['7', 1 as unknown as string, '3', '=', '?'])).toBeNull();
    expect(solveParts(['Double', '7', '=', '?'])!.answer).toBe(14);
  });
});


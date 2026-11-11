import { describe, expect, it } from 'vitest';
import { STAGES} from './config';
import { progressFrom, type SubAnswer } from './engine';
import { helpedKey, parseKey, plainKey, subKey } from './keys';
import { quickAnswersFrom} from './saved';

describe('keys for answers given with help', () => {
  it('are the same picture, marked helped, and mark the same answer', () => {
    expect(helpedKey('sub:ten-8')).toBe('subh:ten-8');
    expect(helpedKey('gap:five-4')).toBe('gaph:five-4');
    expect(plainKey('subh:ten-8')).toBe('sub:ten-8');
    expect(parseKey('subh:ten-8')).toMatchObject({ helped: true, answer: 8, stage: 5 });
    expect(parseKey('gaph:five-4')).toMatchObject({ helped: true, answer: 1 });
    expect(parseKey('sub:ten-8')?.helped).toBe(false);
  });
});

describe('Quick looks answers inside a student’s saved answers', () => {
  it('give the same stage progress as the full list, and helped ones count for nothing', () => {
    const types = STAGES[0].types;
    const rights = Array.from({ length: 8 }, (_, i): SubAnswer => ({ key: subKey(types[i % 3], 2), correct: i !== 2, at: i }));
    const helped = Array.from({ length: 8 }, (_, i) => ({ key: helpedKey(subKey(types[0], 1)), correct: false, at: 100 + i }));
    const saved = [...rights, ...helped];
    const p = progressFrom(quickAnswersFrom(saved));
    expect(p.stages[0].finished).toBe(true);
    expect(p.stages[0].answers).toHaveLength(8);
  });
});

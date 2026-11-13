import { describe, expect, it } from 'vitest';
import { mistakeWords } from './teacher';

describe('Glyph Gates teacher words', () => {
  it('says every named mistake in the teacher’s own words', () => {
    expect(mistakeWords('add-same')).toBe('adds the same to top and bottom (5/6 → 6/7)');
    for (const kind of ['add-same', 'top-only', 'bottom-only', 'same-bottom', 'same-top', 'near-miss', 'diff-mult', 'missed']) expect(mistakeWords(kind)).not.toBe(kind);
  });
});

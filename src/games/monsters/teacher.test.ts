import { describe, expect, it } from 'vitest';
import { topicsText } from './teacher';

describe('Maths Monsters’ line in the Games table', () => {
  it('says how many topics are on', () => {
    expect(topicsText(4)).toBe('4 of 6 topics');
    expect(topicsText(1)).toBe('1 of 6 topics');
    expect(topicsText(6)).toBe('All 6 topics');
  });
});

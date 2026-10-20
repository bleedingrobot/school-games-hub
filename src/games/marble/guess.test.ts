import { describe, expect, it } from 'vitest';
import { isGoodGuess } from './guess';

describe('guess your time', () => {
  it('gives a star within 10% either way', () => {
    expect(isGoodGuess(30, 30)).toBe(true);
    expect(isGoodGuess(27, 30)).toBe(true);
    expect(isGoodGuess(33, 30)).toBe(true);
    expect(isGoodGuess(26, 30)).toBe(false);
    expect(isGoodGuess(34, 30)).toBe(false);
  });
  it('gives no star for a guess that is not a number', () => {
    expect(isGoodGuess(NaN, 30)).toBe(false);
    expect(isGoodGuess(0, 30)).toBe(false);
    expect(isGoodGuess(-5, 30)).toBe(false);
    expect(isGoodGuess(Infinity, 30)).toBe(false);
  });
});

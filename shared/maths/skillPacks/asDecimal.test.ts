import { describe, expect, it } from 'vitest';
import { decimalsPack } from './decimals';
import { generatedPack, solveByNumbers } from './generated';
import { AS_DECIMAL } from './generatedKit';

/** Typed questions like "6/10 = ?" or "35% = ?" that, on their own, don't say the answer is a decimal. */
const TYPED_TO_DECIMAL: [ReturnType<typeof generatedPack>, string][] = [
  [decimalsPack(), 'dec:from-frac:tenths'],
  [generatedPack(), 'deceq:common'],
  [generatedPack(), 'deceq:hundredths'],
  [generatedPack(), 'pct:to-decimal'],
  [generatedPack(), 'fdp:pct-to-dec'],
];

describe('questions that want a decimal say so', () => {
  it.each(TYPED_TO_DECIMAL.map(([pack, key]) => [key, pack] as const))('%s', (key, pack) => {
    for (let i = 0; i < 20; i++) {
      const q = pack.questionFor(key, 'focus');
      expect(q.prompt).toBe(AS_DECIMAL);
      expect(q.parts.join(' ')).not.toContain('decimal');
      // The instruction is not part of what the server compares, so its checks are unchanged.
      if (pack !== TYPED_TO_DECIMAL[0][0]) expect(solveByNumbers(key, q.params!, q.parts)?.answer).toBe(q.answer);
    }
  });
});

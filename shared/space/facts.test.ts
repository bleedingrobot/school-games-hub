import { describe, expect, it } from 'vitest';
import { STAR_KINDS } from './board';
import { FACTS, FACT_BY_ID } from './facts';

describe('space facts', () => {
  it('has one for every kind of star, and no repeats', () => {
    for (const star of STAR_KINDS) expect(FACT_BY_ID[star]?.star).toBe(true);
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
  });

  it('keeps every fact short enough for Year 4–6 readers', () => {
    for (const f of FACTS) {
      expect(f.fact.length, f.id).toBeLessThanOrEqual(170);
      expect(f.fact.split(/(?<=\.) /).length, f.id).toBeLessThanOrEqual(3);
      // Words a Year 4 reader is likely to stumble on stay out.
      expect(f.fact, f.id).not.toMatch(/\b(approximately|luminosity|magnitude|solar masses?|light-years?)\b/i);
    }
  });
});

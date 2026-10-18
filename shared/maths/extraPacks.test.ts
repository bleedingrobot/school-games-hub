import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, type PackDefinition } from './banded';
import { EXTRA_PACKS, TOPICS, makeExtraPack } from './skillPacks';

describe.each(Object.entries(EXTRA_PACKS))('%s pack', (_id, def: PackDefinition) => {
  const pack = new BandedPack(def);

  it('puts every family in exactly one band', () => {
    const inBands = def.bands.flat();
    expect(new Set(inBands).size).toBe(inBands.length);
    expect(new Set(inBands)).toEqual(new Set(Object.keys(def.families)));
  });

  for (const [name, family] of Object.entries(def.families)) {
    it(`${name}: every roll makes a sound question`, () => {
      const random = randomFromSeed(`extra:${name}`);
      for (let n = 0; n < 400; n++) {
        const key = family.keys[0];
        const params = family.roll(key, random);
        const q = pack.rebuild(key, params, true, random)!;
        const where = `${key} ${JSON.stringify(params)} → ${q?.parts.join(' ')}`;
        expect(q, where).not.toBeNull();
        expect(Number.isInteger(q.answer), where).toBe(true);
        expect(q.answer, where).toBeGreaterThanOrEqual(0);
        expect(q.parts.filter((p) => p === '?').length, `one blank: ${where}`).toBe(1);
        expect(q.parts.every((p) => p.length > 0), where).toBe(true);
        expect(q.choices, where).toHaveLength(q.choiceLabels ? 2 : 4);
        expect(new Set(q.choices).size, where).toBe(q.choices!.length);
        expect(q.choices, where).toContain(q.answer);
        // The worked answer is shown after a wrong answer: it must exist and must contain the answer.
        const fact = pack.factText({ factKey: key, params, parts: q.parts, answer: q.answer });
        if (q.choiceLabels) expect(fact.length, where).toBeGreaterThan(10);
        else expect(fact, where).toContain(String(q.answer));
        // Making it again from its numbers gives the same question.
        expect(pack.rebuild(key, params, false)!.answer, where).toBe(q.answer);
      }
    });
    it(`${name}: refuses numbers it could not have rolled`, () => {
      const key = family.keys[0];
      expect(pack.rebuild(key, [-1, -1, -1, -1, -1])).toBeNull();
      expect(pack.rebuild(key, [999999, 999999, 999999, 999999, 999999])).toBeNull();
    });
  }

  it('asks questions at every band and records answers', () => {
    const p = new BandedPack(def, [], randomFromSeed('extra:session'));
    for (let level = 1; level <= p.bandCount; level++) {
      for (let i = 0; i < 20; i++) {
        const q = p.nextQuestion({ level })!;
        expect(q).not.toBeNull();
        expect(p.recordAnswer(q, q.answer, 2000).correct).toBe(true);
      }
    }
    expect(p.stats().length).toBeGreaterThan(0);
  });
});

describe('the money pack', () => {
  const pack = new BandedPack(EXTRA_PACKS.money);
  const q = (key: string, params: number[]) => pack.rebuild(key, params)!;
  it('works out change, totals, swaps and shortfalls', () => {
    expect(q('money:change', [0, 25, 50]).answer).toBe(25);
    expect(q('money:several', [0, 3, 12]).answer).toBe(36);
    expect(q('money:total', [0, 85, 60]).answer).toBe(145);
    expect(q('money:left', [0, 20, 30, 70]).answer).toBe(20);
    expect(q('money:swap', [1, 2, 3, 4]).answer).toBe(12);
    expect(q('money:short', [0, 40, 75]).answer).toBe(35);
    expect(q('money:change-big', [0, 187, 250]).answer).toBe(63);
  });
  it('picks the cheaper deal (3 for 12 = 4 each, beats 5 for 25 = 5 each)', () => {
    const made = q('money:value', [0, 3, 12, 5, 25]);
    expect(made.answer).toBe(0);
    expect(made.choiceLabels).toHaveLength(2);
    expect(q('money:value', [0, 3, 12, 5, 15]).answer).toBe(1);
  });
  it('refuses deals with equal unit prices or prices that do not divide', () => {
    expect(pack.rebuild('money:value', [0, 3, 12, 4, 16])).toBeNull();
    expect(pack.rebuild('money:value', [0, 3, 13, 5, 25])).toBeNull();
  });
});

describe('the patterns pack', () => {
  const pack = new BandedPack(EXTRA_PACKS.patterns);
  const q = (key: string, params: number[]) => pack.rebuild(key, params)!;
  it('continues patterns correctly', () => {
    expect(q('pat:add', [3, 4]).answer).toBe(19); // 3, 7, 11, 15, 19
    expect(q('pat:down', [5, 50]).answer).toBe(30); // 50, 45, 40, 35, 30
    expect(q('pat:double', [2, 4]).answer).toBe(32); // 2, 4, 8, 16, 32
    expect(q('pat:missing', [5, 4, 2]).answer).toBe(13); // 5, 9, 13, 17, 21
    expect(q('pat:step', [4, 5]).answer).toBe(5);
    expect(q('pat:grow', [1, 1]).answer).toBe(16); // 1, 2, 4, 7, 11, 16
    expect(q('pat:rule', [3, 1, 6]).answer).toBe(19);
  });
  it('shows the pattern the way the old woman said it', () => {
    expect(q('pat:add', [3, 4]).parts).toEqual(['What comes next?', '3, 7, 11, 15,', '?']);
  });
});

describe('the shared topic list', () => {
  it('is unchanged: Maths Monsters does not see the Dragon Maths packs', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals']);
    expect(makeExtraPack('money').id).toBe('money');
  });
});

import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, choicesFor, fillBlank, sameAnswer, show, speak, spokenFraction, type PackDefinition } from './banded';
import { CHOICES } from './config';
import { newStats } from './leitner';
import { BANDED_PACKS, makePack, TOPICS, topicOfKey } from './skillPacks';

const PACKS = Object.values(BANDED_PACKS);

/** Reads a number as shown on screen: "12 500", "$2.40", "−3". */
const num = (text: string) => Number(text.replace(/^\$/, '').replace(/ /g, '').replace('−', '-'));
const fracValue = (text: string) => {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text);
  return m ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : NaN;
};

/**
 * Works a question out from what's on screen alone, for the plain sums ("47 + 36 = ?",
 * "$10.00 − $3.65 = $ ?", "? ÷ 4 = 7"). Undefined for anything else (words, fractions).
 */
function solveFromScreen(parts: string[]): number | undefined {
  const p = parts.filter((x) => x !== '$');
  if (p.length !== 5 || p[3] !== '=' || !['+', '−', '×', '÷'].includes(p[1])) return undefined;
  const [a, op, b, , c] = p;
  if ([a, b, c].some((x) => x !== '?' && Number.isNaN(num(x)))) return undefined;
  const apply = (x: number, y: number) => (op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y);
  const undo = (target: number, known: number, blankFirst: boolean) => {
    if (op === '+') return target - known;
    if (op === '×') return target / known;
    if (op === '−') return blankFirst ? target + known : known - target;
    return blankFirst ? target * known : known / target;
  };
  if (c === '?') return apply(num(a), num(b));
  if (a === '?') return undo(num(c), num(b), true);
  if (b === '?') return undo(num(c), num(a), false);
  return undefined;
}

describe.each(PACKS.map((p) => [p.id, p] as const))('%s pack', (_id, def: PackDefinition) => {
  const pack = new BandedPack(def);

  it('every family is in exactly one band (or ladder-only), and no key is shared', () => {
    const inBands = [...def.bands.flat(), ...(def.ladderOnly ?? [])];
    expect(new Set(inBands).size).toBe(inBands.length);
    expect(new Set(inBands)).toEqual(new Set(Object.keys(def.families)));
    const keys = Object.values(def.families).flatMap((f) => f.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const [name, family] of Object.entries(def.families)) {
    it(`${name}: every roll makes a sound question (${family.label})`, () => {
      const random = randomFromSeed(`pack-test:${name}`);
      // Fact families: every key a few times. Others: lots of rolls of their one key.
      const keys = family.keys.length > 1 ? family.keys.flatMap((k) => [k, k, k, k]) : Array(400).fill(family.keys[0]);
      for (const key of keys) {
        const params = family.roll(key, random);
        const q = pack.rebuild(key, params, true, random)!;
        expect(q, `${key} ${JSON.stringify(params)}`).not.toBeNull();
        const where = `${key} ${JSON.stringify(params)} → ${q.parts.join(' ')}`;

        // The answer is a sensible number, and whole unless the question takes decimals.
        expect(Number.isFinite(q.answer), where).toBe(true);
        expect(q.answer, where).toBeGreaterThanOrEqual(0);
        if (q.input !== 'decimal') expect(Number.isInteger(q.answer), where).toBe(true);
        expect(String(q.answer).length, where).toBeLessThanOrEqual(q.maxLength!);
        expect(q.spoken.length, where).toBeGreaterThan(5);
        expect(q.spoken, where).not.toContain('/');

        if (q.choiceLabels) {
          // Pick questions: two different labels, the answer is one of them, and it really is bigger.
          expect(q.choices).toEqual([0, 1]);
          expect(new Set(q.choiceLabels).size).toBe(2);
          const values = q.choiceLabels.map((l) => (l.includes('/') ? fracValue(l) : num(l)));
          expect(values[q.answer], where).toBeGreaterThan(values[1 - q.answer]);
        } else {
          // Exactly one blank, and the full fact shows the answer.
          expect(q.parts.filter((p) => p.includes('?')), where).toHaveLength(1);
          const fact = pack.factText({ ...q });
          expect(fact, where).not.toContain('?');
          // Multiple choice: four different choices, one of them right.
          expect(q.choices, where).toHaveLength(CHOICES);
          expect(new Set(q.choices).size, where).toBe(CHOICES);
          expect(q.choices!.filter((c) => sameAnswer(c, q.answer)), where).toHaveLength(1);
          for (const c of q.choices!) {
            expect(c, where).toBeGreaterThanOrEqual(0);
            if (q.input !== 'decimal') expect(Number.isInteger(c), where).toBe(true);
          }
        }

        // Plain sums are checked against an answer worked out from the screen alone.
        const solved = solveFromScreen(q.parts);
        if (solved !== undefined) expect(sameAnswer(solved, q.answer), where).toBe(true);

        // Making it again from the same numbers gives the same question (what the server does).
        const again = pack.rebuild(key, params)!;
        expect(again.parts).toEqual(q.parts);
        expect(again.answer).toBe(q.answer);
      }
    });

    it(`${name}: numbers it could never roll are refused`, () => {
      const key = family.keys[0];
      for (const params of [[], [-1, -1, -1, -1], [1.5, 2.5, 0.5, 0.5], [1e6, 1e6, 1e6, 1e6], [NaN, NaN, NaN, NaN]]) {
        expect(pack.rebuild(key, params), `${key} ${JSON.stringify(params)}`).toBeNull();
      }
      expect(pack.rebuild('not-a-key', family.roll(key, Math.random))).toBeNull();
    });
  }

  it('each band has focus, review and stretch keys in the right places', () => {
    const last = def.bands.length;
    expect(pack.poolsFor(1).review).toEqual([]);
    expect(pack.poolsFor(1).stretch).toEqual(pack.keysInBand(2));
    expect(pack.poolsFor(last).stretch).toEqual([]);
    expect(pack.poolsFor(last).review).toHaveLength(Array.from({ length: last - 1 }, (_, i) => pack.keysInBand(i + 1).length).reduce((a, b) => a + b, 0));
    // Out-of-range levels are clamped.
    expect(pack.poolsFor(0)).toEqual(pack.poolsFor(1));
    expect(pack.poolsFor(99)).toEqual(pack.poolsFor(last));
  });

  it('nextQuestion asks mostly from the chosen band, and learns from answers', () => {
    for (let band = 1; band <= def.bands.length; band++) {
      const p = new BandedPack(def, [], randomFromSeed(`next:${def.id}:${band}`), () => Date.parse('2026-10-17T00:00:00Z'));
      const heard: string[] = [];
      p.onAnswer((a) => heard.push(a.key));
      let inBand = 0;
      for (let i = 0; i < 300; i++) {
        const q = p.nextQuestion({ level: band })!;
        if (p.bandOf(q.factKey) === band) inBand++;
        expect(Math.abs(p.bandOf(q.factKey)! - band)).toBeLessThanOrEqual(band === 1 ? 1 : band - 1);
        const result = p.recordAnswer(q, i % 3 === 0 ? q.answer + 1 : q.answer, 2000);
        expect(result.correct).toBe(i % 3 !== 0);
        expect(result.fact).not.toContain('?');
      }
      // Band 1 has no review, so focus takes its 30% too.
      expect(inBand / 300).toBeGreaterThan(band === 1 ? 0.8 : 0.5);
      expect(heard).toHaveLength(300);
      expect(p.stats().length).toBeGreaterThan(0);
    }
  });
});

describe('questions on screen', () => {
  it('numbers are written the NZ way', () => {
    expect(show(3406)).toBe('3406');
    expect(show(12500)).toBe('12 500');
    expect(show(100000)).toBe('100 000');
    expect(show(0.1 + 0.2)).toBe('0.3');
    expect(show(4.1)).toBe('4.1');
  });

  it('fractions are read out in words', () => {
    expect(spokenFraction('3/4')).toBe('3 quarters');
    expect(spokenFraction('1/2')).toBe('1 half');
    expect(spokenFraction('?/8')).toBe('what eighths');
    expect(spokenFraction('2 1/3')).toBe('2 and 1 third');
    expect(spokenFraction('? 1/3')).toBe('what and 1 third');
    expect(spokenFraction('6/?')).toBe('6 over what');
    expect(speak(['1/2', '=', '?/8'])).toBe('1 half equals what eighths?');
    expect(speak(['23', '÷', '4', '=', '5', 'r', '?'])).toBe('23 divided by 4 equals 5 remainder what?');
  });

  it('the filled-in fact keeps money tidy', () => {
    expect(fillBlank(['1/2', '=', '?/8'], 4)).toBe('1/2 = 4/8');
    expect(fillBlank(['$2.40', '+', '$1.75', '=', '$', '?'], 4.15)).toBe('$2.40 + $1.75 = $4.15');
  });

  it('multiple choice pads with near misses when the slips run out', () => {
    const random = randomFromSeed('choices');
    const c = choicesFor(1, [], false, random);
    expect(c).toHaveLength(CHOICES);
    expect(c).toContain(1);
    expect(c.every((n) => n >= 0)).toBe(true);
    const d = choicesFor(0.8, [0.08, 8], true, random);
    expect(d).toEqual(expect.arrayContaining([0.8, 0.08, 8]));
  });

  it('decimal answers are marked right however the float lands', () => {
    const pack = makePack('decimals', [], randomFromSeed('float'));
    const q = pack.nextQuestion({ level: 1 })!;
    expect(pack.recordAnswer(q, q.answer + 1e-12, 1000).correct).toBe(true);
  });
});

describe('topics', () => {
  it('there are six, and every key knows its topic', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals']);
    expect(topicOfKey('mul:7x8')).toBe('times-tables');
    expect(topicOfKey('add:7+8')).toBe('add-sub');
    expect(topicOfKey('div:56/8')).toBe('division');
    expect(topicOfKey('frac:equiv')).toBe('fractions');
    expect(topicOfKey('money:add')).toBe('decimals');
    expect(topicOfKey('pv:round10')).toBe('place-value');
    expect(topicOfKey('nope')).toBeUndefined();
  });

  it('every topic makes questions', () => {
    for (const { id } of TOPICS) expect(makePack(id, [], randomFromSeed(id)).nextQuestion({ level: 1 })).not.toBeNull();
  });

  it('banded packs ignore saved records from other topics', () => {
    for (const id of Object.keys(BANDED_PACKS) as (keyof typeof BANDED_PACKS)[]) {
      const pack = makePack(id, [newStats('mul:7x8'), newStats('add:7+8')], randomFromSeed(id));
      const own = pack.stats().map((s) => s.key);
      expect(own.length).toBeLessThanOrEqual(1);
      for (const key of own) expect(topicOfKey(key)).toBe(id);
    }
  });
});

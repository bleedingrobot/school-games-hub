import { describe, expect, it } from 'vitest';
import { ladderKeyPacks, LADDER, packIdOfKey } from './ladder';
import { groupByPack, solveParts } from './focus';
import { earlyFactsPack } from './skillPacks/earlyFacts';
import { ALL_KEYS } from './skillPacks/equalsKeys';
import { KEYS } from '../parrot/round';

// The database's key check (supabase/migrations/20261107000600_parrot_keys.sql).
const DB_KEY = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/=?-]{1,40}$/;

describe('the equals keys, for Parrot\'s See-saw', () => {
  it('are early facts beside the ladder, all different, and the game and the pack agree on them', () => {
    const skills = ['balance-10', 'balance-20', 'true-false'].map((id) => LADDER.find((s) => s.id === id)!);
    for (const skill of skills) expect(skill, skill.id).toMatchObject({ inAuto: false, inWarmUp: false, built: true });
    const all = skills.flatMap((s) => s.keys);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...ALL_KEYS].sort());
    expect(KEYS.miss.length + KEYS.swap.length + KEYS.both.length + KEYS.sub.length + KEYS.tf.length).toBe(all.length);
    for (const key of all) {
      expect(packIdOfKey(key), key).toBe('early-facts');
      expect(ladderKeyPacks().get(key), key).toBe('early-facts');
      expect(DB_KEY.test(key), key).toBe(true);
    }
  });

  it('are asked right by the pack, and answers sort into the early-facts records', () => {
    const pack = earlyFactsPack();
    for (const key of ALL_KEYS) {
      const q = pack.questionFor(key, 'focus', { multipleChoice: true });
      expect(q.factKey).toBe(key);
      if (key.startsWith('eqtf:')) {
        const [a, b, c, d] = key.match(/\d+/g)!.map(Number);
        expect(q.answer, key).toBe(a + b === c + d ? 0 : 1);
      } else {
        // The missing number really keeps the see-saw level.
        const [a, b, c] = key.match(/\d+/g)!.map(Number);
        const level = key.startsWith('eqmiss') ? a === b + q.answer : key.startsWith('eqswap') ? a + b === b + q.answer : key.startsWith('eqboth') ? a + b === c + q.answer : key.includes('-?') ? a === b - q.answer : a - b === c + q.answer;
        expect(level, key).toBe(true);
        expect(q.answer, key).toBeGreaterThan(0);
      }
      // Never read as some other fact when typed.
      expect(solveParts(q.parts)?.keys.some((k) => k !== key) ?? false, key).toBe(false);
    }
    const answers = ALL_KEYS.slice(0, 3).map((key) => ({ key, correct: true, ms: 1000, at: 0 }));
    expect([...groupByPack(answers).keys()]).toEqual(['early-facts']);
  });

  it('fit the database check, which the old one refused', () => {
    const OLD = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$/;
    expect(ALL_KEYS.every((k) => DB_KEY.test(k))).toBe(true);
    expect(ALL_KEYS.some((k) => OLD.test(k))).toBe(true); // eqswap has no '=' and passed already
    expect(ALL_KEYS.filter((k) => !OLD.test(k)).length).toBeGreaterThan(50);
    for (const ok of ['bond10:3+7', 'mul:7x8', 'round:100:3digit', 'skip5:next:25']) expect(DB_KEY.test(ok), ok).toBe(true);
    expect(DB_KEY.test('eqmiss:8 = 5')).toBe(false);
  });
});

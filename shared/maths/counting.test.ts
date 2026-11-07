import { describe, expect, it } from 'vitest';
import { ladderKeyPacks, LADDER, packIdOfKey } from './ladder';
import { groupByPack, solveParts } from './focus';
import { earlyFactsPack } from './skillPacks/earlyFacts';
import { ALL_COUNT_KEYS, countNumbers } from './skillPacks/countingKeys';

// The database's key check (supabase/migrations/20261107000800_parrot_keys.sql).
const DB_KEY = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/=?-]{1,40}$/;

describe('the counting keys, for Robin\'s Berry Basket', () => {
  it('are early facts beside the ladder, all different, and fit the database check', () => {
    const skills = ['count-out-10', 'count-out-20', 'count-on'].map((id) => LADDER.find((s) => s.id === id)!);
    for (const skill of skills) expect(skill, skill.id).toMatchObject({ inAuto: false, inWarmUp: false, built: true });
    const all = skills.flatMap((s) => s.keys);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...ALL_COUNT_KEYS].sort());
    for (const key of all) {
      expect(packIdOfKey(key), key).toBe('early-facts');
      expect(ladderKeyPacks().get(key), key).toBe('early-facts');
      expect(DB_KEY.test(key), key).toBe(true);
    }
  });

  it('are asked right by the pack, read back when typed, and sort into the early-facts records', () => {
    const pack = earlyFactsPack();
    for (const key of ALL_COUNT_KEYS) {
      const q = pack.questionFor(key, 'focus', { multipleChoice: true });
      expect(q.factKey).toBe(key);
      const n = countNumbers(key);
      expect(q.answer, key).toBe(key.startsWith('counton:') ? n[0] + 1 : n[0]);
      expect(solveParts(q.parts), key).toEqual({ answer: q.answer, keys: [key] });
    }
    expect([...groupByPack(ALL_COUNT_KEYS.slice(0, 3).map((key) => ({ key, correct: true, ms: 1000, at: 0 }))).keys()]).toEqual(['early-facts']);
  });
});

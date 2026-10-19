import { describe, expect, it } from 'vitest';
import { QUICK_MS, QUICK_MS_BY_PACK } from './config';
import { focusResultAnswers, skillsOfKey } from './focusResults';
import { LADDER } from './ladder';

const answer = (key: string, correct: boolean, ms: number, at = 1_000) => ({ key, correct, ms, at });

describe('which skill owns a key', () => {
  it('finds the skill for a times-table fact, a division fact, an early fact and a generated type', () => {
    expect(skillsOfKey('mul:6x7').length).toBeGreaterThan(0);
    const div = LADDER.flatMap((s) => s.keys).find((k) => k.startsWith('div:'))!;
    expect(skillsOfKey(div).length).toBeGreaterThan(0);
    const early = LADDER.flatMap((s) => s.keys).find((k) => k.startsWith('bond10:'))!;
    expect(skillsOfKey(early).length).toBeGreaterThan(0);
    const generated = LADDER.find((s) => s.stage === 'rounding')!.keys[0];
    expect(skillsOfKey(generated).length).toBeGreaterThan(0);
  });

  it('agrees with the ladder for every key of every skill, and names real skills only', () => {
    const ids = new Set(LADDER.map((s) => s.id));
    for (const skill of LADDER) {
      for (const key of skill.keys) {
        expect(skillsOfKey(key)).toContain(skill.id);
        for (const id of skillsOfKey(key)) expect(ids.has(id)).toBe(true);
      }
    }
  });

  it('gives nothing for a key that is not on the ladder', () => {
    expect(skillsOfKey('mul:99x99')).toEqual([]);
    expect(skillsOfKey('nonsense')).toEqual([]);
  });
});

describe('the answers sent to the database', () => {
  it('sends the skills, the time, whether it was right and whether it was quick', () => {
    const [row] = focusResultAnswers([answer('mul:6x7', true, 1500, 42)], 'times-tables');
    expect(row).toEqual({ skills: skillsOfKey('mul:6x7'), at: 42, correct: true, quick: true });
  });

  it('counts quick only for a right answer within the quick time', () => {
    const rows = focusResultAnswers(
      [answer('mul:6x7', true, QUICK_MS), answer('mul:6x7', true, QUICK_MS + 1), answer('mul:6x7', false, 100)],
      'times-tables',
    );
    expect(rows.map((r) => r.quick)).toEqual([true, false, false]);
    expect(rows.map((r) => r.correct)).toEqual([true, true, false]);
  });

  it('uses the pack\'s own quick time (generated questions get longer)', () => {
    const key = LADDER.find((s) => s.stage === 'rounding')!.keys[0];
    const ms = QUICK_MS_BY_PACK.generated - 1;
    expect(ms).toBeGreaterThan(QUICK_MS);
    expect(focusResultAnswers([answer(key, true, ms)], 'generated')[0].quick).toBe(true);
    expect(focusResultAnswers([answer('mul:6x7', true, ms)], 'times-tables')[0].quick).toBe(false);
  });

  it('leaves out answers that are not on the ladder and keeps the order of the rest', () => {
    const rows = focusResultAnswers([answer('mul:2x3', true, 1, 1), answer('nonsense', true, 1, 2), answer('mul:4x5', false, 1, 3)], 'times-tables');
    expect(rows.map((r) => r.at)).toEqual([1, 3]);
  });

  it('sends nothing for no answers', () => {
    expect(focusResultAnswers([], 'times-tables')).toEqual([]);
  });
});

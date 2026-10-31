import { describe, expect, it } from 'vitest';
import type { BattleReport } from '../save/check';
import { BATTLES_PER_DAY, battleDay, countedOn, countsTowardCap, nzDay } from './battleCap';

// 27 Oct 2026, 10am in New Zealand (NZDT, UTC+13) is 26 Oct, 9pm in UTC.
const MORNING = Date.UTC(2026, 9, 26, 21);
const q = (at: number) => ({ topic: 'add-sub', band: 1, key: 'add:2+3', params: [2, 3], given: 5, ms: 3000, at }) as NonNullable<BattleReport['steps'][number]['q']>;
const fight = (at: number) => ({ action: { kind: 'fight', attack: 0, answer: 'right' }, q: q(at), randoms: [] }) as BattleReport['steps'][number];
const run = { action: { kind: 'run' }, randoms: [] } as BattleReport['steps'][number];
const battle = (map: string, steps: BattleReport['steps']) => ({ map, steps });

describe('the daily battle limit', () => {
  it('is 12, the same as monster_battle_rules() in the database', () => {
    expect(BATTLES_PER_DAY).toBe(12);
  });

  it('counts a battle with a maths question, but not running straight off or a Tower battle', () => {
    expect(countsTowardCap(battle('kauri-bush', [fight(MORNING)]))).toBe(true);
    expect(countsTowardCap(battle('kauri-bush', [run]))).toBe(false);
    expect(countsTowardCap(battle('tower-1-top', [fight(MORNING)]))).toBe(false);
  });

  it('uses New Zealand days, like the points cap', () => {
    expect(nzDay(MORNING)).toBe('2026-10-27');
    expect(nzDay(Date.UTC(2026, 9, 27, 10, 59))).toBe('2026-10-27'); // 11:59pm in NZ
    expect(nzDay(Date.UTC(2026, 9, 27, 11, 1))).toBe('2026-10-28'); // just after midnight
    expect(battleDay(battle('kauri-bush', [run, fight(MORNING)]))).toBe('2026-10-27');
    expect(battleDay(battle('kauri-bush', [run]))).toBeNull();
  });

  it('only counts the given day', () => {
    const yesterday = MORNING - 24 * 3600_000;
    const list = [battle('kauri-bush', [fight(MORNING)]), battle('shell-beach', [fight(yesterday)]), battle('kauri-bush', [run]), battle('tower-2-top', [fight(MORNING)])];
    expect(countedOn(list, '2026-10-27')).toBe(1);
    expect(countedOn(list, '2026-10-26')).toBe(1);
  });
});

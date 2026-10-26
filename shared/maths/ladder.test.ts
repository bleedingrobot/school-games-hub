import { describe, expect, it } from 'vitest';
import { LADDER, ladderProgress } from './ladder';
import { newStats, type FactStats } from './leitner';

const rec = (key: string, box: number): FactStats => ({ ...newStats(key), attempts: 3, correct: 3, box });
const secure = (keys: string[]) => keys.map((k) => rec(k, 3));
const built = LADDER.filter((s) => s.built);

describe('ladder progress', () => {
  it('starts on the first skill, moves on at 70% in box 2 or higher, and reaches 100% with every skill secure', () => {
    expect(ladderProgress([]).current?.id).toBe(built[0].id);
    const keys = built[0].keys;
    const need = Math.ceil(keys.length * 0.7);
    expect(ladderProgress(secure(keys.slice(0, need - 1))).current?.id).toBe(built[0].id);
    expect(ladderProgress(secure(keys.slice(0, need))).current?.id).toBe(built[1].id);
    const all = ladderProgress(secure(built.flatMap((s) => s.keys)));
    expect(all.current).toBeNull();
    expect(all.percent).toBe(100);
  });
});

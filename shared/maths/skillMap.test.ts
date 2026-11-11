import { describe, expect, it } from 'vitest';
import { LADDER, } from './ladder';
import { newStats, type FactStats } from './leitner';
import { NO_LADDER, placeProgress, type LadderInfo } from './place';
import { STEP_SECURE_SHARE } from './selector';
import { cellFor, studentMap, } from './skillMap';

// The built skills on the ladder (the part-whole skills sit beside it: see `inAuto`).
const built = LADDER.filter((s) => s.built && s.inAuto !== false);
const allBuilt = LADDER.filter((s) => s.built);
const rec = (key: string, box: number, attempts = 3): FactStats => ({
  ...newStats(key),
  attempts,
  correct: attempts,
  box,
});
const withBox = (keys: string[], box: number) => keys.map((k) => rec(k, box));
const info = (over: Partial<LadderInfo> = {}): LadderInfo => ({
  ...NO_LADDER,
  on: true,
  ...over,
});

describe('the map agrees with ladderProgress', () => {
  const everything = (box: number) =>
    withBox(
      allBuilt.flatMap((s) => s.keys),
      box,
    );

  it('for every skill: secure or fluent exactly when ladderProgress says its share reaches 70%', () => {
    const cases: FactStats[][] = [
      [],
      everything(3),
      everything(4),
      everything(1),
      ...built.map((s) => withBox(s.keys, 3)),
      ...built.map((s) => withBox(s.keys.slice(0, Math.ceil(s.keys.length / 2)), 3)),
    ];
    for (const stats of cases) {
      const progress = placeProgress(stats, info());
      const map = studentMap(stats, info());
      for (const p of progress.skills) {
        const cell = cellFor(map, p.skill.id)!;
        expect(cell.share).toBe(p.share);
        expect(cell.level === 'secure' || cell.level === 'fluent').toBe(p.share >= STEP_SECURE_SHARE);
      }
      expect(map.progress.current?.id).toBe(progress.current?.id);
      expect(map.progress.secureCount).toBe(progress.secureCount);
    }
  });
});


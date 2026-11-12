import { describe, expect, it } from 'vitest';
import { LADDER, } from './ladder';
import { newStats, type FactStats } from './leitner';
import { NO_LADDER, placeProgress, type LadderInfo } from './place';
import { STEP_SECURE_SHARE } from './selector';
import { cellFor, classMiddle, pupilLooks, skillsInUse, studentMap } from './skillMap';

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

describe('the skill map', () => {
  const everything = (box: number) =>
    withBox(
      allBuilt.flatMap((s) => s.keys),
      box,
    );

  it('agrees with ladderProgress on every skill, and shows a class only the skills it is using and who needs a look', () => {
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

    // Skills in use: what anyone has been asked or is on now, plus the next skill after the furthest pupil.
    const [a, b, c] = built;
    const ahead = studentMap([...withBox(a.keys, 3), ...withBox(b.keys.slice(0, 1), 1)], info());
    const fresh = studentMap([], info());
    expect([...skillsInUse([fresh])]).toEqual([a.id, b.id]);
    const used = skillsInUse([ahead, fresh]);
    expect(used.has(a.id) && used.has(b.id) && used.has(c.id)).toBe(true);
    expect(used.size).toBe(3);

    // Who needs a look: nearly (half secure), finding it hard (6+ answers a fact, under 40%), behind (3+ skills back), quiet (7 days).
    const now = Date.UTC(2026, 10, 12);
    const at = (keys: string[], box: number, attempts: number, daysAgo = 1) => keys.map((k) => ({ ...rec(k, box, attempts), lastSeen: now - daysAgo * 86_400_000 }));
    const half = Math.ceil(a.keys.length / 2);
    const nearly = at(a.keys.slice(0, half), 2, 3);
    const hard = at(a.keys, 1, 6);
    const far = at(built.slice(0, 4).flatMap((s) => s.keys), 3, 3, 10);
    const maps = [nearly, hard, far, far, far].map((f) => studentMap(f, info()));
    const middle = classMiddle(maps);
    expect([...pupilLooks(maps[0], nearly, middle, now)]).toEqual(['nearly', 'behind']);
    expect([...pupilLooks(maps[1], hard, middle, now)]).toEqual(['hard', 'behind']);
    expect([...pupilLooks(maps[2], far, middle, now)]).toEqual(['quiet']);
    expect(pupilLooks(maps[1], at(a.keys, 1, 5), middle, now).has('hard')).toBe(false);
  });
});


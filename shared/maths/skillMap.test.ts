import { describe, expect, it } from 'vitest';
import { TABLES, TOP_BOX } from './config';
import { LADDER, ladderProgress } from './ladder';
import { newStats, type FactStats } from './leitner';
import { NO_LADDER, parseLadderInfo, placeProgress, type LadderInfo } from './place';
import { STEP_SECURE_SHARE } from './selector';
import { cellFor, classCounts, LEVELS, STAGES, stageOfSkill, stageSkills, studentMap, type CellLevel } from './skillMap';

const built = LADDER.filter((s) => s.built);
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
const levels = (stats: FactStats[], i: LadderInfo = info(), settings = {}) =>
  Object.fromEntries(
    studentMap(stats, i, settings)
      .stages.flatMap((s) => s.cells)
      .map((c) => [c.skill.id, c.level]),
  );

describe('the stages', () => {
  it('are the six stages of the ladder, in order, with every built skill in exactly one', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'early-facts',
      'times-tables',
      'place-value',
      'rounding',
      'order-of-operations',
      'fractions-decimals-percentages',
    ]);
    const all = STAGES.flatMap((s) => stageSkills(s.id));
    expect(all.map((s) => s.id).sort()).toEqual(built.map((s) => s.id).sort());
    for (const s of built) expect(stageOfSkill(s.id)).toBe(s.stage);
    expect(stageOfSkill('nope')).toBeNull();
  });

  it("keep a skill in the ladder's own order inside its stage", () => {
    for (const stage of STAGES) {
      const ranks = stageSkills(stage.id).map((s) => LADDER.indexOf(s));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('use words a teacher can read, with no year levels', () => {
    for (const stage of STAGES) expect(stage.label).not.toMatch(/year/i);
    for (const level of Object.values(LEVELS)) {
      expect(level.label.length).toBeGreaterThan(0);
      expect(level.about).not.toMatch(/year/i);
    }
  });
});

describe('a student with no records', () => {
  it('has every skill not started, on the first skill, with nothing secure', () => {
    const map = studentMap([], info());
    for (const stage of map.stages) {
      expect(stage.level).toBe('not-started');
      expect(stage.secure).toBe(0);
      expect(stage.counted).toBe(stage.cells.length);
    }
    expect(map.current?.id).toBe(built[0].id);
    expect(map.progress.secureCount).toBe(0);
    expect(map.furthest).toBeNull();
    expect(map.stages.filter((s) => s.hasCurrent).map((s) => s.stage)).toEqual([built[0].stage]);
  });
});

describe("a cell's level", () => {
  const skill = built.find((s) => s.id === 'bedmas')!;
  const n = skill.keys.length;

  it('is not started until something has been asked', () => {
    expect(cellFor(studentMap([], info()), 'bedmas')?.level).toBe('not-started');
    expect(cellFor(studentMap([{ ...newStats(skill.keys[0]), attempts: 0 }], info()), 'bedmas')?.level).toBe('not-started');
  });

  it('is learning when something is asked but fewer than 70% are in box 2', () => {
    const stats = [rec(skill.keys[0], 1), ...withBox(skill.keys.slice(1, 2), 2)];
    expect(cellFor(studentMap(stats, info()), 'bedmas')?.level).toBe('learning');
  });

  it('turns secure at exactly the share auto uses, and fluent at the same share in the top box', () => {
    const need = Math.ceil(STEP_SECURE_SHARE * n);
    const under = withBox(skill.keys.slice(0, need - 1), 3);
    const at = withBox(skill.keys.slice(0, need), 3);
    expect(cellFor(studentMap(under, info()), 'bedmas')?.level).toBe('learning');
    expect(cellFor(studentMap(at, info()), 'bedmas')?.level).toBe('secure');
    const fluent = withBox(skill.keys.slice(0, need), TOP_BOX);
    expect(cellFor(studentMap(fluent, info()), 'bedmas')?.level).toBe('fluent');
    // box 4 on some, box 2 on others: secure, not fluent
    const mixed = [...withBox(skill.keys.slice(0, need - 1), TOP_BOX), ...withBox(skill.keys.slice(need - 1, need), 2)];
    expect(cellFor(studentMap(mixed, info()), 'bedmas')?.level).toBe('secure');
  });

  it('keeps the numbers a teacher sees in the detail honest', () => {
    const stats = [...withBox(skill.keys.slice(0, 2), 3), rec(skill.keys[2], 1)];
    const cell = cellFor(studentMap(stats, info()), 'bedmas')!;
    expect(cell.keys).toBe(n);
    expect(cell.asked).toBe(3);
    expect(cell.share).toBeCloseTo(2 / n);
    expect(cell.fluentShare).toBe(0);
  });
});

describe('the map agrees with ladderProgress', () => {
  const everything = (box: number) =>
    withBox(
      built.flatMap((s) => s.keys),
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

  it('puts "where they are now" on the same skill as ladderProgress', () => {
    for (const s of built) {
      const upToHere = built.slice(0, built.indexOf(s)).flatMap((x) => withBox(x.keys, 3));
      const map = studentMap(upToHere, info());
      expect(map.current?.id).toBe(s.id);
      expect(ladderProgress(upToHere).current?.id).toBe(s.id);
      expect(cellFor(map, s.id)?.status).toBe('current');
    }
  });

  it('with every skill secure has no current skill', () => {
    const map = studentMap(everything(3), info());
    expect(map.current).toBeNull();
    for (const stage of map.stages) expect(stage.secure).toBe(stage.counted);
  });

  it('with tables and division switched off: skipped skills read "switched off" and are not counted', () => {
    const only67 = [6, 7];
    const stats = withBox(
      built.flatMap((s) => s.keys),
      3,
    );
    const map = studentMap(stats, info(), { enabledTables: only67 });
    const progress = ladderProgress(stats, { enabledTables: only67 });
    for (const p of progress.skills) {
      const cell = cellFor(map, p.skill.id)!;
      expect(cell.level === 'off').toBe(p.status === 'upcoming' && p.share === 1);
    }
    const timesStage = map.stages.find((s) => s.stage === 'times-tables')!;
    expect(timesStage.counted).toBeLessThan(timesStage.cells.length);
    expect(map.progress.builtCount).toBe(progress.builtCount);
    expect(map.progress.secureCount).toBe(progress.secureCount);
  });

  it('a stage whose tables are all switched off reads switched off, not not-started', () => {
    const map = studentMap([], info(), { enabledTables: [] });
    expect(map.stages.find((s) => s.stage === 'times-tables')!.level).toBe('off');
    expect(map.stages.find((s) => s.stage === 'early-facts')!.level).toBe('not-started');
  });

  it("with division switched off, division facts are left out of a times-table skill's share", () => {
    const skill = built.find((s) => s.id === 'tables-6-9')!;
    const mul = skill.keys.filter((k) => k.startsWith('mul:'));
    const stats = withBox(mul, 3);
    const withDivision = cellFor(studentMap(stats, info(), { division: true }), skill.id)!;
    const without = cellFor(studentMap(stats, info(), { division: false }), skill.id)!;
    expect(without.share).toBe(ladderProgress(stats, { division: false }).skills.find((p) => p.skill.id === skill.id)!.share);
    expect(withDivision.share).toBeLessThanOrEqual(without.share);
    expect(without.level).toBe('secure');
  });

  it('with a placement or a year level: skills behind the start are marked passed over, and "current" starts there', () => {
    const start = built.find((s) => s.id === 'tables-6-9')!;
    const map = studentMap([], info({ placed: 'done', placement: start.id }));
    expect(map.current?.id).toBe(start.id);
    const before = built.filter((s) => LADDER.indexOf(s) < LADDER.indexOf(start));
    for (const s of before) {
      const cell = cellFor(map, s.id)!;
      expect(cell.passedOver).toBe(true);
      expect(cell.level).toBe('not-started'); // the colour only tells what the records show
    }
    expect(cellFor(map, start.id)?.passedOver).toBe(false);
    // A class year level moves nobody.
    const year = studentMap([], parseLadderInfo({ on: true, yearLevel: 6 }));
    expect(year.current?.id).toBe(built[0].id);
  });

  it('with auto off: no floor, nothing kept, and the furthest place is not shown', () => {
    const map = studentMap([], {
      ...info({
        placed: 'done',
        placement: 'tables-6-9',
        furthest: 'tables-6-9',
      }),
      on: false,
    });
    expect(map.current?.id).toBe(built[0].id);
    expect(map.furthest).toBeNull();
  });

  it('shows the furthest place when auto is on, and never moves current behind it', () => {
    const far = built.find((s) => s.id === 'round-1000')!;
    const map = studentMap(withBox(built[0].keys, 3), info({ furthest: far.id }));
    expect(map.furthest?.id).toBe(far.id);
    expect(map.current).not.toBeNull();
    expect(LADDER.indexOf(map.current!)).toBeGreaterThanOrEqual(LADDER.indexOf(far));
  });
});

describe("a stage's cell", () => {
  it('counts its secure skills and takes its colour from all of them', () => {
    const early = stageSkills('early-facts');
    const [first, ...rest] = early;
    const one = studentMap(withBox(first.keys, 3), info());
    const stage = one.stages.find((s) => s.stage === 'early-facts')!;
    expect(stage.secure).toBe(1);
    expect(stage.counted).toBe(early.length);
    expect(stage.level).toBe('learning'); // some asked, not all secure
    const all = studentMap(
      withBox(
        early.flatMap((s) => s.keys),
        3,
      ),
      info(),
    ).stages.find((s) => s.stage === 'early-facts')!;
    expect(all.level).toBe('secure');
    expect(all.secure).toBe(early.length);
    const fluent = studentMap(
      withBox(
        early.flatMap((s) => s.keys),
        TOP_BOX,
      ),
      info(),
    ).stages.find((s) => s.stage === 'early-facts')!;
    expect(fluent.level).toBe('fluent');
    expect(rest.length).toBeGreaterThan(0);
  });

  it("marks the stage the student's current skill is in, and only that one", () => {
    for (const s of built) {
      const upToHere = built.slice(0, built.indexOf(s)).flatMap((x) => withBox(x.keys, 3));
      const here = studentMap(upToHere, info())
        .stages.filter((st) => st.hasCurrent)
        .map((st) => st.stage);
      expect(here).toEqual([s.stage]);
    }
  });
});

describe('class counts', () => {
  it('count students by level for a skill', () => {
    const skill = built.find((s) => s.id === 'bedmas')!;
    const maps = [
      studentMap([], info()),
      studentMap(withBox(skill.keys, 3), info()),
      studentMap(withBox(skill.keys, TOP_BOX), info()),
      studentMap([rec(skill.keys[0], 1)], info()),
    ];
    expect(classCounts(maps, 'bedmas')).toEqual({
      off: 0,
      'not-started': 1,
      learning: 1,
      secure: 1,
      fluent: 1,
    } satisfies Record<CellLevel, number>);
    expect(classCounts(maps, 'nope')).toEqual({
      off: 0,
      'not-started': 0,
      learning: 0,
      secure: 0,
      fluent: 0,
    });
  });
});

describe('the default tables', () => {
  it('count every table as on when the class has none listed', () => {
    const a = levels(
      withBox(
        built.flatMap((s) => s.keys),
        3,
      ),
    );
    const b = levels(
      withBox(
        built.flatMap((s) => s.keys),
        3,
      ),
      info(),
      { enabledTables: [...TABLES] },
    );
    expect(a).toEqual(b);
  });
});

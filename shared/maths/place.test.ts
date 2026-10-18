import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { QUICK_MS } from './config';
import { AUTO_FOCUS, focusKey, makeFocusPack, parseFocus, solveParts, usesLadder } from './focus';
import { AutoPack, autoPools, LADDER, ladderProgress, packIdOfKey } from './ladder';
import { afterAnswer, newStats, type FactStats } from './leitner';
import {
  floorRank,
  NO_LADDER,
  parseLadderInfo,
  placeProgress,
  placeToStore,
  placementNext,
  placementQuestion,
  placementResult,
  skillYear,
  yearStartRank,
  type LadderInfo,
  type PlacementStep,
} from './place';
import { checkPlacement, parsePlacementAnswers, type PlacementAnswer } from './placementCheck';
import { makePlaceSyncer, savePlacement, type PlacePorts } from './syncPlace';

const built = LADDER.filter((s) => s.built);
const rec = (key: string, box: number): FactStats => ({ ...newStats(key), attempts: 3, correct: 3, box });
const secure = (keys: string[]) => keys.map((k) => rec(k, 3));
const info = (over: Partial<LadderInfo> = {}): LadderInfo => ({ ...NO_LADDER, on: true, ...over });
const rankOf = (id: string) => LADDER.findIndex((s) => s.id === id);

describe('reading what the database says about the ladder', () => {
  it('counts anything odd as auto off', () => {
    for (const odd of [null, undefined, 'x', 5, [], {}]) expect(parseLadderInfo(odd)).toEqual(NO_LADDER);
    expect(parseLadderInfo({ on: 'yes' }).on).toBe(false);
  });

  it('keeps good values and drops unknown or not-yet-built skills and silly years', () => {
    const ok = parseLadderInfo({ on: true, yearLevel: 5, placed: 'done', placement: 'tables-3-4-8', furthest: 'tables-6-9' });
    expect(ok).toEqual({ on: true, yearLevel: 5, placed: 'done', placement: 'tables-3-4-8', furthest: 'tables-6-9' });
    expect(parseLadderInfo({ on: true, placed: 'done', placement: 'percent-of' }).placed).toBeNull(); // a stub
    expect(parseLadderInfo({ on: true, placed: 'done', placement: 'nope' }).placed).toBeNull();
    expect(parseLadderInfo({ on: true, furthest: '../etc' }).furthest).toBeNull();
    expect(parseLadderInfo({ on: true, yearLevel: 99 }).yearLevel).toBeNull();
    expect(parseLadderInfo({ on: true, placed: 'skipped' }).placed).toBe('skipped');
  });

  it('rides along in the focus, whatever the source', () => {
    const raw = { source: 'teacher-class', skills: ['tables-6-9'], onlyThese: false, endsAt: null, canChoose: true, own: null, ladder: { on: true, yearLevel: 4 } };
    expect(parseFocus(raw).ladder?.on).toBe(true);
    expect(parseFocus({ ...raw, ladder: undefined }).ladder).toEqual(NO_LADDER);
    expect(AUTO_FOCUS.ladder?.on).toBe(false);
  });
});

describe('where the year level starts a student', () => {
  it('starts with no year level on the first skill', () => {
    expect(yearStartRank(null)).toBe(LADDER.indexOf(built[0]));
  });

  it('only ever lands on a built skill, and never goes backwards as the year goes up', () => {
    let last = -1;
    for (let year = 0; year <= 13; year++) {
      const rank = yearStartRank(year);
      expect(LADDER[rank].built).toBe(true);
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });

  it('starts a Year 5 student about a year behind their class, a Year 1 student at the start', () => {
    expect(yearStartRank(1)).toBe(LADDER.indexOf(built[0]));
    const y5 = LADDER[yearStartRank(5)];
    expect(skillYear(y5)).toBe(4);
    expect(y5.stage).toBe('times-tables');
  });

  it('reads the teaching year from the curriculum tag', () => {
    expect(skillYear({ ...LADDER[0], curriculumTags: ['MS.Y4.NUM.OP.P2'] })).toBe(4);
    expect(skillYear({ ...LADDER[0], curriculumTags: [] })).toBeNull();
  });
});

describe('the floor under a student', () => {
  it('is the year level until the placement is done', () => {
    expect(floorRank(info({ yearLevel: 5 }))).toBe(yearStartRank(5));
    expect(floorRank(info({ yearLevel: 5, placed: 'skipped' }))).toBe(yearStartRank(5));
    expect(floorRank(info())).toBe(LADDER.indexOf(built[0]));
  });

  it('is the placement once it is done, even if that is lower than the year level', () => {
    expect(floorRank(info({ yearLevel: 6, placed: 'done', placement: 'dbl-half-10' }))).toBe(rankOf('dbl-half-10'));
  });

  it('never drops below the furthest place', () => {
    expect(floorRank(info({ yearLevel: 6, placed: 'done', placement: 'dbl-half-10', furthest: 'tables-7' }))).toBe(rankOf('tables-7'));
    expect(floorRank(info({ furthest: 'tables-2-5-10' }))).toBe(rankOf('tables-2-5-10'));
  });
});

describe('progress with a floor', () => {
  it('puts the student on the floor skill, with the skills before it behind them but not counted as secure', () => {
    const p = ladderProgress([], { floor: rankOf('tables-3-4-8') });
    const before = built.slice(0, built.findIndex((s) => s.id === 'tables-3-4-8'));
    expect(p.current?.id).toBe('tables-3-4-8');
    expect(p.skills.filter((s) => s.passedOver).map((s) => s.skill.id)).toEqual(before.map((s) => s.id));
    expect(p.skills.filter((s) => s.passedOver).every((s) => s.status === 'secure')).toBe(true);
    expect(p.secureCount).toBe(0); // nothing is proven yet
    expect(p.percent).toBe(0);
  });

  it('counts a skill before the floor as secure when the records say so', () => {
    const before = built.slice(0, built.findIndex((s) => s.id === 'tables-3-4-8'));
    const p = ladderProgress(secure(before.slice(0, 2).flatMap((s) => s.keys)), { floor: rankOf('tables-3-4-8') });
    expect(p.secureCount).toBe(2);
    expect(p.skills.filter((s) => s.passedOver).map((s) => s.skill.id)).toEqual(before.slice(2).map((s) => s.id));
    expect(p.percent).toBe(Math.round((100 * 2) / p.builtCount));
  });

  it('is the same as before with no floor', () => {
    expect(ladderProgress([]).current?.id).toBe('facts-10');
    expect(ladderProgress([], { floor: 0 }).secureCount).toBe(0);
  });

  it('still moves on from the floor as records show a skill is secure', () => {
    const at = built.findIndex((s) => s.id === 'tables-3-4-8');
    const p = ladderProgress(secure(built[at].keys), { floor: LADDER.indexOf(built[at]) });
    expect(p.current?.id).toBe(built[at + 1].id);
  });

  it('forgetting a skill gives more review of it but never drops the place', () => {
    // Everything up to the ×7 skill is secure, so they are on the skill after it (the furthest place).
    const upTo = built.findIndex((s) => s.id === 'tables-7');
    const next = built[upTo + 1].id;
    const records = secure(built.slice(0, upTo + 1).flatMap((s) => s.keys));
    expect(placeProgress(records, info({ furthest: 'tables-7' })).current?.id).toBe(next);
    // Then the ×7 facts are forgotten: the records now say that skill is not secure.
    const tables7 = new Set(built[upTo].keys);
    const forgotten = records.map((r) => (tables7.has(r.key) ? { ...r, box: 0 } : r));
    // Without a stored place the student would drop back a skill...
    expect(ladderProgress(forgotten).current?.id).toBe('tables-7');
    // ...with it they stay where they were, and the forgotten facts are review, weak ones likelier.
    const after = placeProgress(forgotten, info({ furthest: next }));
    expect(after.current?.id).toBe(next);
    expect(autoPools(after).review.filter((k) => tables7.has(k)).length).toBe(tables7.size);
  });

  it('the furthest place to store is where they are now, or the last skill when all are secure', () => {
    const none = placeToStore([], info());
    expect(none).toEqual({ skill: 'facts-10', rank: rankOf('facts-10') });
    const all = placeToStore(secure(built.flatMap((s) => s.keys)), info());
    expect(all?.skill).toBe(built.at(-1)!.id);
    expect(placeToStore([], info({ yearLevel: 6 }))?.rank).toBe(yearStartRank(6));
  });

  it('counts division only when it is on: with it off a skill can be secure without them', () => {
    const tables = built.find((s) => s.id === 'tables-2-5-10')!;
    const mulOnly = secure(tables.keys.filter((k) => k.startsWith('mul:')));
    const lastBefore = built.findIndex((s) => s.id === 'tables-2-5-10');
    const before = secure(built.slice(0, lastBefore).flatMap((s) => s.keys));
    expect(ladderProgress([...before, ...mulOnly], { division: false }).current?.id).not.toBe('tables-2-5-10');
    expect(ladderProgress([...before, ...mulOnly]).current?.id).toBe('tables-2-5-10');
    expect(autoPools(ladderProgress([], { division: false }), { division: false }).focus.some((k) => k.startsWith('div:'))).toBe(false);
  });
});

describe('auto over the whole ladder', () => {
  it('gives a pack that follows the ladder only when the class has auto on and there is no focus', () => {
    const on = { ...AUTO_FOCUS, ladder: info() };
    expect(usesLadder(on)).toBe(true);
    expect(usesLadder(AUTO_FOCUS)).toBe(false);
    expect(usesLadder({ ...on, source: 'teacher-class', skills: ['tables-6-9'] })).toBe(false);
    expect(makeFocusPack([], on)).toBeInstanceOf(AutoPack);
    expect(makeFocusPack([], AUTO_FOCUS)).not.toBeInstanceOf(AutoPack);
    expect(focusKey(on)).not.toBe(focusKey(AUTO_FOCUS));
  });

  it('a teacher focus, or one the student picked, still wins', () => {
    const teacher = { ...AUTO_FOCUS, source: 'teacher-class' as const, skills: ['tables-6-9'], ladder: info() };
    const pack = makeFocusPack([], teacher, {}, randomFromSeed('1')) as AutoPack;
    const asked = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const q = pack.nextQuestion({})!;
      if (q.band === 'focus') asked.add(q.factKey);
      pack.recordAnswer(q, q.answer, 9000);
    }
    expect([...asked].every((k) => /^(mul:\d+x\d+|div:\d+\/\d+)$/.test(k))).toBe(true);
    expect(pack.progress().current?.id).toBeDefined();
  });

  it('starts a student at the floor, with earlier skills as review', () => {
    const f = { ...AUTO_FOCUS, ladder: info({ yearLevel: 5 }) };
    const pack = makeFocusPack([], f, {}, randomFromSeed('2')) as AutoPack;
    const start = LADDER[yearStartRank(5)];
    const bands: Record<string, number> = { focus: 0, review: 0, stretch: 0, repeat: 0 };
    for (let i = 0; i < 1500; i++) {
      const q = pack.nextQuestion({})!;
      bands[q.band]++;
      if (q.band === 'focus') expect(start.keys).toContain(q.factKey);
      pack.recordAnswer(q, q.answer, 9000); // slow: stays in its box, so the mix does not drift
    }
    // 60 / 30 / 10, with the planned repeats of wrong answers (none here) left out.
    expect(bands.focus / 1500).toBeGreaterThan(0.55);
    expect(bands.focus / 1500).toBeLessThan(0.65);
    expect(bands.review / 1500).toBeGreaterThan(0.25);
    expect(bands.review / 1500).toBeLessThan(0.35);
    expect(bands.stretch / 1500).toBeGreaterThan(0.06);
    expect(bands.stretch / 1500).toBeLessThan(0.14);
  });

  it('keeps the class settings: a table switched off, and division, still apply', () => {
    const f = { ...AUTO_FOCUS, ladder: info({ furthest: 'tables-6-9' }) };
    const pack = makeFocusPack([], f, { enabledTables: [2, 3, 4, 5, 7, 8, 10, 11, 12], division: false }, randomFromSeed('3')) as AutoPack;
    for (let i = 0; i < 600; i++) {
      const q = pack.nextQuestion({})!;
      expect(q.factKey.startsWith('div:')).toBe(false);
      expect(['mul:6x6', 'mul:6x9', 'mul:9x9']).not.toContain(q.factKey); // both tables are off
      pack.recordAnswer(q, q.answer, 9000);
    }
  });

  it('asks only questions the server can mark, whatever the floor and records (many seeds)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const furthest of [null, 'dbl-half-20', 'tables-3-4-8', 'tables-11-12', 'times-tens', 'round-big', 'squares-cubes', 'bedmas'] as const) {
        const random = randomFromSeed(`auto-${seed}`);
        const f = { ...AUTO_FOCUS, ladder: info({ furthest }) };
        const pack = makeFocusPack([], f, { division: seed % 2 === 0 }, random) as AutoPack;
        for (let i = 0; i < 150; i++) {
          const q = pack.nextQuestion({ multipleChoice: seed % 3 === 0 })!;
          const solved = solveParts(q.parts);
          expect(solved, q.parts.join(' ')).not.toBeNull();
          expect(solved!.answer, q.parts.join(' ')).toBe(q.answer);
          expect(solved!.keys, q.parts.join(' ')).toContain(q.factKey);
          pack.recordAnswer(q, i % 5 === 0 ? q.answer + 1 : q.answer, 1500);
        }
      }
    }
  });
});

describe('the placement check', () => {
  const step = (skill: string, ok: boolean, quick = ok): PlacementStep => ({ skill, correct: ok, quick });
  const run = (year: number | null, answerRight: (skill: string, i: number) => boolean | 'slow') => {
    const steps: PlacementStep[] = [];
    for (let i = 0; i < 20; i++) {
      const skill = placementNext(year, steps);
      if (!skill) break;
      const r = answerRight(skill.id, i);
      steps.push(step(skill.id, r !== false, r === true));
    }
    return steps;
  };

  it('asks 10 questions and then stops', () => {
    expect(run(5, () => true)).toHaveLength(10);
    expect(placementNext(5, run(5, () => true))).toBeNull();
  });

  it('starts at the class’s year start, or the first skill with none', () => {
    expect(placementNext(5, [])?.id).toBe(LADDER[yearStartRank(5)].id);
    expect(placementNext(null, [])?.id).toBe(built[0].id);
  });

  it('jumps up while the answers are right and quick', () => {
    const steps = run(null, () => true);
    const levels = steps.map((s) => built.findIndex((b) => b.id === s.skill));
    expect(levels[1] - levels[0]).toBe(2);
    expect(levels[2]).toBeGreaterThan(levels[1]);
    expect(levels.at(-1)).toBe(built.length - 1);
  });

  it('steps back when an answer is wrong, and also when it is right but slow', () => {
    const start = built.findIndex((b) => b.id === placementNext(5, [])!.id);
    for (const reply of [false, 'slow'] as const) {
      const steps = run(5, (_s, i) => (i === 0 ? reply : true));
      const second = built.findIndex((b) => b.id === steps[1].skill);
      expect(second).toBe(Math.max(0, start - 1));
    }
  });

  it('after a miss it climbs one at a time', () => {
    const steps = run(null, (_s, i) => i !== 2);
    const levels = steps.map((s) => built.findIndex((b) => b.id === s.skill));
    for (let i = 4; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('starts just below where the student got to', () => {
    // Right and quick everywhere up to ×3/×4/×8, wrong above.
    const limit = built.findIndex((b) => b.id === 'tables-3-4-8');
    const steps = run(null, (skill) => built.findIndex((b) => b.id === skill) <= limit);
    const best = Math.max(...steps.filter((s) => s.correct && s.quick).map((s) => built.findIndex((b) => b.id === s.skill)));
    expect(best).toBe(limit);
    expect(placementResult(steps).id).toBe(built[limit - 1].id);
  });

  it('starts at the first skill for a student who gets nothing right, and just below the top for one who gets everything', () => {
    expect(placementResult(run(6, () => false)).id).toBe(built[0].id);
    expect(placementResult(run(6, () => true)).id).toBe(built[built.length - 2].id);
    expect(placementResult([]).id).toBe(built[0].id);
  });

  it('asks real questions about the skill, not repeating the same fact', () => {
    const skill = built.find((b) => b.id === 'tables-6-9')!;
    const random = randomFromSeed('p');
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const q = placementQuestion(skill, i + 1, random, seen)!;
      expect(skill.keys).toContain(q.factKey);
      expect(q.factKey.startsWith('div:')).toBe(false);
      expect(solveParts(q.parts)?.answer).toBe(q.answer);
      seen.push(q.factKey);
    }
    expect(new Set(seen).size).toBe(8);
    for (const b of built) expect(placementQuestion(b, 1, random)).not.toBeNull();
  });
});

describe('checking a placement on the server', () => {
  /** An honest run: the browser walks the same steps and answers with `rightAt(level)`. */
  function honest(year: number | null, ok: (i: number, skill: string) => boolean, ms = 1500): PlacementAnswer[] {
    const random = randomFromSeed('check');
    const steps: PlacementStep[] = [];
    const answers: PlacementAnswer[] = [];
    for (let i = 0; i < 10; i++) {
      const skill = placementNext(year, steps)!;
      const q = placementQuestion(skill, i + 1, random)!;
      const right = ok(i, skill.id);
      answers.push({ skill: skill.id, parts: q.parts, answer: right ? q.answer : q.answer + 1, ms });
      steps.push({ skill: skill.id, correct: right, quick: right && ms <= QUICK_MS });
    }
    return answers;
  }

  it('gives the same start the browser worked out', () => {
    const answers = honest(5, () => true);
    const steps = answers.map((a) => ({ skill: a.skill, correct: true, quick: true }));
    expect(checkPlacement(5, answers)).toBe(placementResult(steps).id);
  });

  it('works out right and wrong itself and does not take the browser’s word', () => {
    const wrong = honest(null, () => false);
    expect(checkPlacement(null, wrong)).toBe(built[0].id);
    // The same answers sent slowly are not quick, so nothing is passed.
    const slow = honest(null, () => true, 20_000);
    expect(checkPlacement(null, slow)).toBe(built[0].id);
  });

  it('refuses a run that is not the walk it should have been', () => {
    const answers = honest(5, () => true);
    expect(checkPlacement(5, answers.slice(0, 9))).toBeNull();
    expect(checkPlacement(5, [...answers, answers[0]])).toBeNull();
    expect(checkPlacement(6, answers)).toBeNull(); // asked for another year's start
    const swapped = [...answers];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(checkPlacement(5, swapped)).toBeNull();
    expect(checkPlacement(5, answers.map((a, i) => (i === 3 ? { ...a, parts: ['9', '+', '9', '=', '?'] } : a)))).toBeNull(); // not a question of that skill
    expect(checkPlacement(5, answers.map((a, i) => (i === 3 ? { ...a, parts: ['nonsense'] } : a)))).toBeNull();
  });

  it('reads answers carefully', () => {
    const answers = honest(null, () => true);
    expect(parsePlacementAnswers(answers)).toHaveLength(10);
    expect(parsePlacementAnswers(null)).toBeNull();
    expect(parsePlacementAnswers(answers.slice(1))).toBeNull();
    expect(parsePlacementAnswers(answers.map((a) => ({ ...a, answer: 'x' })))).toBeNull();
    expect(parsePlacementAnswers(answers.map((a) => ({ ...a, parts: [1, 2] })))).toBeNull();
    expect(parsePlacementAnswers(answers.map((a) => ({ ...a, ms: -50 })))![0].ms).toBe(0);
  });
});

describe('the server keeping the place', () => {
  function ports(over: Partial<{ ladder: unknown; facts: FactStats[] }> = {}) {
    const saved: { skill: string; rank: number }[] = [];
    const placements: { skill: string | null; skipped: boolean }[] = [];
    const calls = { load: 0 };
    const p: PlacePorts = {
      async loadContext() {
        calls.load++;
        return { facts: over.facts ?? [], settings: { enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], division: false }, focus: { source: 'auto', ladder: over.ladder ?? { on: true, yearLevel: 5 } } };
      },
      async savePlace(_p, skill, rank) {
        saved.push({ skill, rank });
      },
      async savePlacementRow(_p, skill, skipped) {
        if (placements.length) return false;
        placements.push({ skill, skipped });
        return true;
      },
    };
    return { p, saved, placements, calls };
  }

  it('saves the place from the records, and only when auto is on', async () => {
    const on = ports();
    await makePlaceSyncer(on.p)('s1');
    expect(on.saved).toEqual([{ skill: LADDER[yearStartRank(5)].id, rank: yearStartRank(5) }]);
    const off = ports({ ladder: { on: false } });
    await makePlaceSyncer(off.p)('s1');
    expect(off.saved).toEqual([]);
  });

  it('looks at a student at most once in a short while, and never throws', async () => {
    let clock = 1000;
    const on = ports();
    const sync = makePlaceSyncer(on.p, () => clock, 30_000);
    await sync('s1');
    await sync('s1');
    clock += 31_000;
    await sync('s1');
    await sync('s2');
    expect(on.calls.load).toBe(3);
    const broken = makePlaceSyncer({ ...on.p, loadContext: async () => Promise.reject(new Error('down')) });
    await expect(broken('s9')).resolves.toBeUndefined();
  });

  it('stores a good placement once, a skip once, and refuses the rest', async () => {
    const good = ports();
    const answers = (() => {
      const random = randomFromSeed('srv');
      const steps: PlacementStep[] = [];
      const out: PlacementAnswer[] = [];
      for (let i = 0; i < 10; i++) {
        const skill = placementNext(5, steps)!;
        const q = placementQuestion(skill, i + 1, random)!;
        out.push({ skill: skill.id, parts: q.parts, answer: q.answer, ms: 1000 });
        steps.push({ skill: skill.id, correct: true, quick: true });
      }
      return out;
    })();
    const saved = await savePlacement(good.p, 's1', { answers });
    expect(saved.outcome).toBe('saved');
    expect(good.placements[0]).toEqual({ skill: saved.start, skipped: false });
    expect((await savePlacement(good.p, 's1', { answers })).outcome).toBe('already'); // the database refuses a second one
    expect(good.placements).toHaveLength(1);

    const done = ports({ ladder: { on: true, yearLevel: 5, placed: 'done', placement: 'tables-3-4-8' } });
    expect((await savePlacement(done.p, 's1', { answers })).outcome).toBe('already');
    expect(done.placements).toHaveLength(0);

    const off = ports({ ladder: { on: false } });
    expect((await savePlacement(off.p, 's1', { skip: true })).outcome).toBe('refused');

    const skip = ports();
    expect((await savePlacement(skip.p, 's1', { skip: true })).outcome).toBe('saved');
    expect(skip.placements[0]).toEqual({ skill: null, skipped: true });

    const bad = ports();
    expect((await savePlacement(bad.p, 's1', { answers: answers.slice(2) })).outcome).toBe('refused');
    expect((await savePlacement(bad.p, 's1', 'nonsense')).outcome).toBe('refused');
    expect((await savePlacement(bad.p, 's1', null)).outcome).toBe('refused');
    expect(bad.placements).toHaveLength(0);
  });
});

describe('the longer ladder', () => {
  const generated = built.filter((s) => s.keys.length && s.keys.every((k) => packIdOfKey(k) === 'generated'));

  it('has 19 built skills, ten of them generated, and every one has at least four question types', () => {
    expect(built).toHaveLength(19);
    expect(generated).toHaveLength(10);
    for (const skill of generated) expect(skill.keys.length, skill.id).toBeGreaterThanOrEqual(4);
  });

  it('a student who answers every warm-up question right and quickly starts at the top, from any year', () => {
    for (const year of [null, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const steps: PlacementStep[] = [];
      for (;;) {
        const skill = placementNext(year, steps);
        if (!skill) break;
        steps.push({ skill: skill.id, correct: true, quick: true });
      }
      expect(steps, `year ${year}`).toHaveLength(10);
      expect(placementResult(steps).id, `year ${year}`).toBe(built[built.length - 2].id);
    }
  });

  it('a generated skill is secure when 70% of its question types are in box 2 or higher', () => {
    const skill = built.find((s) => s.id === 'round-10-100')!;
    const need = Math.ceil(skill.keys.length * 0.7);
    const some = (n: number) => skill.keys.map((k, i) => rec(k, i < n ? 2 : 0));
    expect(ladderProgress(secure(built.slice(0, built.indexOf(skill)).flatMap((s) => s.keys)).concat(some(need - 1))).current?.id).toBe('round-10-100');
    expect(ladderProgress(secure(built.slice(0, built.indexOf(skill)).flatMap((s) => s.keys)).concat(some(need))).current?.id).not.toBe('round-10-100');
    // Eight types need six in box 2: twelve quick right answers, two in each type, so one lucky type is not enough.
    expect(skill.keys).toHaveLength(8);
    expect(need).toBe(6);
  });

  it('auto from the start of a generated skill asks that skill most (the 60% focus) with the others as review', () => {
    const skill = built.find((s) => s.id === 'bonds-100')!;
    const floor = LADDER.indexOf(skill);
    const pack = new AutoPack([], randomFromSeed('mix'), Date.now, { floor });
    let mine = 0;
    for (let i = 0; i < 300; i++) {
      const q = pack.nextQuestion({})!;
      if (skill.keys.includes(q.factKey)) mine++;
      pack.recordAnswer(q, q.answer + 1, 1500); // always wrong, so the student stays on the skill
    }
    expect(mine / 300).toBeGreaterThan(0.45);
    expect(mine / 300).toBeLessThan(0.85);
  });

  it('the server accepts a warm-up where the student takes up to 8 seconds on a generated question, but not on a fact', () => {
    const random = randomFromSeed('slow');
    const skill = built.find((s) => s.id === 'bedmas')!;
    const q = placementQuestion(skill, 1, random)!;
    const steps: PlacementStep[] = [];
    // Ten answers to the same last skill (what the walk asks after the climb), each 7 seconds.
    const answers: PlacementAnswer[] = [];
    for (let i = 0; i < 10; i++) {
      const next = placementNext(8, steps)!;
      const qq = placementQuestion(next, i + 1, random)!;
      const ms = 7000;
      answers.push({ skill: next.id, parts: qq.parts, answer: qq.answer, ms });
      steps.push({ skill: next.id, correct: true, quick: ms <= (next.keys[0] && packIdOfKey(next.keys[0]) === 'generated' ? 8000 : QUICK_MS) });
    }
    expect(q.factKey.startsWith('bedmas:')).toBe(true);
    expect(checkPlacement(8, answers)).toBe(placementResult(steps).id);
  });
});

describe('progress by records for the path', () => {
  it('matches what auto uses, so every screen agrees', () => {
    const records = secure(built.slice(0, 3).flatMap((s) => s.keys)).concat([afterAnswer(newStats('mul:6x7'), true, 1000, 0)]);
    const f = info({ furthest: 'dbl-half-20' });
    const path = placeProgress(records, f);
    const pack = new AutoPack(records, randomFromSeed('z'), Date.now, { floor: floorRank(f) });
    expect(pack.progress().current?.id).toBe(path.current?.id);
    expect(pack.progress().secureCount).toBe(path.secureCount);
  });
});

describe('question numbers', () => {
  it('are different for every question, across the packs the ladder draws from', () => {
    const pack = new AutoPack([], randomFromSeed('ids'), Date.now, { floor: rankOf('tables-2-5-10') });
    const ids: number[] = [];
    for (let i = 0; i < 200; i++) {
      const q = pack.nextQuestion({})!;
      ids.push(q.id);
      pack.recordAnswer(q, q.answer, 9000);
    }
    expect(new Set(ids).size).toBe(200);
  });
});

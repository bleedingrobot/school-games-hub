import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { solveClaim } from './claim';
import { QUICK_MS } from './config';
import { AUTO_FOCUS, makeFocusPack, } from './focus';
import { AutoPack, LADDER, } from './ladder';
import { type FactStats } from './leitner';
import {
  floorRank,
  NO_LADDER,
  placementNext,
  placementQuestion,
  type LadderInfo,
  type PlacementStep,
} from './place';
import { checkPlacement, type PlacementAnswer } from './placementCheck';
import { savePlacement, type PlacePorts } from './syncPlace';

// The built skills on the ladder (the part-whole skills sit beside it: see `inAuto`).
const built = LADDER.filter((s) => s.built && s.inAuto !== false);
/** The skills the placement warm-up walks over (skip counting is left out). */
const warmUp = built.filter((s) => s.inWarmUp !== false);
const info = (over: Partial<LadderInfo> = {}): LadderInfo => ({ ...NO_LADDER, on: true, ...over });
const rankOf = (id: string) => LADDER.findIndex((s) => s.id === id);

describe('the floor under a student', () => {

  it('is the placement once it is done', () => {
    expect(floorRank(info({ placed: 'done', placement: 'dbl-half-10' }))).toBe(rankOf('dbl-half-10'));
  });
});

describe('auto over the whole ladder', () => {

  it('asks only questions the server can mark, whatever the floor and records (many seeds)', () => {
    for (let seed = 1; seed <= 2; seed++) {
      for (const furthest of [null, 'dbl-half-20', 'tables-3-4-8', 'tables-11-12', 'times-tens', 'round-big', 'squares-cubes', 'percent-of', 'bedmas'] as const) {
        const random = randomFromSeed(`auto-${seed}`);
        const f = { ...AUTO_FOCUS, ladder: info({ furthest }) };
        const pack = makeFocusPack([], f, { division: seed % 2 === 0 }, random) as AutoPack;
        for (let i = 0; i < 40; i++) {
          const q = pack.nextQuestion({ multipleChoice: seed % 3 === 0 })!;
          const solved = solveClaim({ parts: q.parts, key: q.factKey, params: q.params });
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
  const run = (answerRight: (skill: string, i: number) => boolean | 'slow') => {
    const steps: PlacementStep[] = [];
    for (let i = 0; i < 20; i++) {
      const skill = placementNext(steps);
      if (!skill) break;
      const r = answerRight(skill.id, i);
      steps.push(step(skill.id, r !== false, r === true));
    }
    return steps;
  };

  it('steps back when an answer is wrong, and also when it is right but slow', () => {
    for (const reply of [false, 'slow'] as const) {
      // Climb once, then miss: the third question is one skill below the second.
      const steps = run((_s, i) => (i === 1 ? reply : true));
      const second = warmUp.findIndex((b) => b.id === steps[1].skill);
      const third = warmUp.findIndex((b) => b.id === steps[2].skill);
      expect(third).toBe(second - 1);
    }
  });
});

describe('checking a placement on the server', () => {
  /** An honest run: the browser walks the same steps and answers with `rightAt(level)`. */
  function honest(ok: (i: number, skill: string) => boolean, ms = 1500): PlacementAnswer[] {
    const random = randomFromSeed('check');
    const steps: PlacementStep[] = [];
    const answers: PlacementAnswer[] = [];
    for (let i = 0; i < 10; i++) {
      const skill = placementNext(steps)!;
      const q = placementQuestion(skill, i + 1, random)!;
      const right = ok(i, skill.id);
      answers.push({ skill: skill.id, parts: q.parts, key: q.factKey, params: q.params, answer: right ? q.answer : q.answer + 1, ms });
      steps.push({ skill: skill.id, correct: right, quick: right && ms <= QUICK_MS });
    }
    return answers;
  }

  it('refuses a run that is not the walk it should have been', () => {
    const answers = honest(() => true);
    expect(checkPlacement(answers.slice(0, 9))).toBeNull();
    expect(checkPlacement([...answers, answers[0]])).toBeNull();
    const swapped = [...answers];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(checkPlacement(swapped)).toBeNull();
    expect(checkPlacement(answers.map((a, i) => (i === 3 ? { ...a, parts: ['9', '+', '9', '=', '?'] } : a)))).toBeNull(); // not a question of that skill
    expect(checkPlacement(answers.map((a, i) => (i === 3 ? { ...a, parts: ['nonsense'] } : a)))).toBeNull();
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

  it('stores a good placement once, a skip once, and refuses the rest', async () => {
    const good = ports();
    const answers = (() => {
      const random = randomFromSeed('srv');
      const steps: PlacementStep[] = [];
      const out: PlacementAnswer[] = [];
      for (let i = 0; i < 10; i++) {
        const skill = placementNext(steps)!;
        const q = placementQuestion(skill, i + 1, random)!;
        out.push({ skill: skill.id, parts: q.parts, key: q.factKey, params: q.params, answer: q.answer, ms: 1000 });
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


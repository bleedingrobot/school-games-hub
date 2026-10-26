import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { QUICK_MS } from './config';
import { LADDER } from './ladder';
import { placementNext, placementQuestion, type PlacementStep } from './place';
import { checkPlacement, type PlacementAnswer } from './placementCheck';
import { savePlacement, type PlacePorts } from './syncPlace';

const built = LADDER.filter((s) => s.built);

describe('the placement check on the server', () => {
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

  it('works out right and wrong itself, does not take the browser’s word, and refuses a run that is not the walk', () => {
    const wrong = honest(() => false);
    expect(checkPlacement(wrong)).toBe(built[0].id);
    // The same answers sent slowly are not quick, so nothing is passed.
    const slow = honest(() => true, 20_000);
    expect(checkPlacement(slow)).toBe(built[0].id);
    // A run that is not the walk it should have been is refused.
    const answers = honest(() => true);
    expect(checkPlacement(answers.slice(0, 9))).toBeNull();
    expect(checkPlacement([...answers, answers[0]])).toBeNull();
    const swapped = [...answers];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(checkPlacement(swapped)).toBeNull();
    expect(checkPlacement(answers.map((a, i) => (i === 3 ? { ...a, parts: ['9', '+', '9', '=', '?'] } : a)))).toBeNull(); // not a question of that skill
    expect(checkPlacement(answers.map((a, i) => (i === 3 ? { ...a, parts: ['nonsense'] } : a)))).toBeNull();
  });

  function ports(ladder: unknown = { on: true, yearLevel: 5 }) {
    const placements: { skill: string | null; skipped: boolean }[] = [];
    const p: PlacePorts = {
      async loadContext() {
        return { facts: [], settings: { enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], division: false }, focus: { source: 'auto', ladder } };
      },
      async savePlace() {},
      async savePlacementRow(_p, skill, skipped) {
        if (placements.length) return false;
        placements.push({ skill, skipped });
        return true;
      },
    };
    return { p, placements };
  }

  it('stores a good placement once, a skip once, and refuses the rest', async () => {
    const good = ports();
    const answers = honest(() => true);
    const saved = await savePlacement(good.p, 's1', { answers });
    expect(saved.outcome).toBe('saved');
    expect(good.placements[0]).toEqual({ skill: saved.start, skipped: false });
    expect((await savePlacement(good.p, 's1', { answers })).outcome).toBe('already'); // the database refuses a second one
    expect(good.placements).toHaveLength(1);

    const done = ports({ on: true, yearLevel: 5, placed: 'done', placement: 'tables-3-4-8' });
    expect((await savePlacement(done.p, 's1', { answers })).outcome).toBe('already');
    expect(done.placements).toHaveLength(0);

    const off = ports({ on: false });
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

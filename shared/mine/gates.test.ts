import { describe, expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { seededRandom } from '../maths/serverQuestions';
import { makeLevel, RECIPES } from './level';
import { addGateChoices, gateChoices, makeRunQuestions, questionPlan } from './maths';

const sum = (answer: number, over: Partial<Question> = {}): Question => ({
  id: 0, factKey: 'mul:7x8', kind: 'mul', parts: ['7', '×', '8', '=', '?'], spoken: '7 times 8', answer, band: 1, ...over,
}) as Question;

describe('number gates', () => {
  it('marks the doors the recipes call gates, and only question doors', () => {
    for (const r of RECIPES) {
      const level = makeLevel(r);
      level.doors.forEach((d) => expect(d.gate).toBe(d.kind === 'question' && (r.gates ?? []).includes(d.id)));
      for (const g of r.gates ?? []) expect(r.doors[g]).toBe('question');
    }
    expect(RECIPES.some((r) => (r.gates ?? []).length > 0)).toBe(true);
  });

  it('flags the gates in the question plan', () => {
    const level = makeLevel(RECIPES[1]);
    const plan = questionPlan(level);
    const gates = plan.targets.filter((t) => t.gate);
    expect(gates.map((t) => t.id)).toEqual(level.doors.filter((d) => d.gate).map((d) => d.id));
    expect(plan.targets.filter((t) => t.kind !== 'door').every((t) => !t.gate)).toBe(true);
  });

  it('gives a whole-number answer four whole-number choices that include it, the same each time', () => {
    const a = gateChoices(sum(56), seededRandom('x'));
    expect(a).toHaveLength(4);
    expect(a).toContain(56);
    expect(new Set(a).size).toBe(4);
    expect(a!.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    expect(gateChoices(sum(56), seededRandom('x'))).toEqual(a);
  });

  it('keeps choices a question already has, and gives a decimal answer decimal choices', () => {
    expect(gateChoices(sum(9, { choices: [9, 8, 7, 6] }), seededRandom('x'))).toEqual([9, 8, 7, 6]);
    const d = gateChoices(sum(0.8, { input: 'decimal', parts: ['0.5', '+', '0.3', '=', '?'] }), seededRandom('x'))!;
    expect(d).toContain(0.8);
    expect(new Set(d).size).toBe(4);
  });

  it('turns down questions that cannot be shown as plain numbers', () => {
    expect(gateChoices(sum(1, { choices: [0, 1, 2, 3], choiceLabels: ['1/2', '2/3', '3/4', '4/5'] }), seededRandom('x'))).toBeNull();
    expect(gateChoices(sum(4.1, { input: 'decimal', parts: ['$', '2.00', '+', '2.10', '=', '?'] }), seededRandom('x'))).toBeNull();
    expect(gateChoices(sum(-3), seededRandom('x'))).toBeNull();
    expect(gateChoices(sum(2.5), seededRandom('x'))).toBeNull(); // a decimal answer to a whole-number question
  });

  it('adds choices only to the slots of gate doors', () => {
    const level = makeLevel(RECIPES[1]);
    const plan = questionPlan(level);
    const list = Array.from({ length: plan.total }, (_, i) => sum(10 + i, { id: i }));
    const out = addGateChoices(list, plan, seededRandom('g'));
    out.forEach((q, slot) => {
      const t = plan.targets.find((x) => slot >= x.first && slot < x.first + x.count)!;
      if (t.gate) {
        expect(q.choices, `slot ${slot}`).toHaveLength(4);
        expect(q.choices).toContain(q.answer);
      } else expect(q.choices).toBeUndefined();
    });
  });

  it('works on the questions the focus system really makes', () => {
    const level = makeLevel(RECIPES[5]);
    const plan = questionPlan(level);
    const made = makeRunQuestions({ facts: [], settings: {} }, plan.total, seededRandom('seed'));
    const out = addGateChoices(made, plan, seededRandom('seed:gates'));
    expect(out).toHaveLength(plan.total);
    for (const t of plan.targets.filter((x) => x.gate)) {
      for (let i = t.first; i < t.first + t.count; i++) if (out[i].choices && !out[i].choiceLabels) expect(out[i].choices).toContain(out[i].answer);
    }
  });
});

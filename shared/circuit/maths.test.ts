/** Circuit Racer's maths signs: test 6 of the game's 8 (docs/game-guide/4-maths.md rule 4; copies shared/archery/server.test.ts). */
import { expect, it } from 'vitest';
import { parseFocus } from '../maths/focus';
import { LADDER } from '../maths/ladder';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom } from '../maths/serverQuestions';
import { gateLayout, gateValue, slotPlan, signText } from './maths';
import { parseRoad } from './road';
import { TEST_ROAD } from './roads/test';

it('every skill on the maths ladder makes port questions and gate signs the server can mark (typed and multiple choice)', () => {
  const road = parseRoad(TEST_ROAD);
  const plan = slotPlan(road);
  expect([plan.ports, plan.gates]).toEqual([1, 2]);
  for (const skill of LADDER) {
    for (const multipleChoice of [false, true]) {
      const focus = parseFocus({ source: 'teacher-class', skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null });
      const questions = makeRunQuestions({ facts: [], settings: { multipleChoice }, focus }, plan.total, seededRandom(`q-${skill.id}`));
      const name = `${skill.id}${multipleChoice ? ' (choices)' : ''}`;
      expect(questions, name).toHaveLength(plan.total);
      for (const q of questions) {
        expect(markQuestion(q), name).not.toBeNull();
        expect(publicQuestion(q, 0).parts.length, name).toBeGreaterThan(0);
      }
      for (const gate of gateLayout(road, `seed-${skill.id}`, questions)) {
        const right = markQuestion(questions[gate.slot])!.answer;
        const signed = gate.labels.filter((l): l is string => l !== null);
        // At least two signs, all different, each one something to draw; only the right lane's sign is the answer.
        expect(signed.length, name).toBeGreaterThanOrEqual(2);
        expect(new Set(signed).size, name).toBe(signed.length);
        for (const label of signed) {
          const t = signText(label);
          expect(t.kind === 'text' ? t.text : t.top + t.bottom, name).not.toBe('');
        }
        for (const lane of road.gates[gate.gate].lanes) {
          const value = gateValue(road, gate, lane);
          if (lane === gate.rightLane) expect(value !== null && sameAnswer(value, right), name).toBe(true);
          else if (value !== null) expect(sameAnswer(value, right), name).toBe(false);
        }
        // The same seed and questions always give the same gate (the finish makes it again).
        expect(gateLayout(road, `seed-${skill.id}`, questions)[gate.gate]).toEqual(gate);
      }
    }
  }
});

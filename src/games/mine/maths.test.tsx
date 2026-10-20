/**
 * Every kind of question the maths ladder can make has to show in Mine Runner’s question box and be answerable
 * (typed, picked, decimal key, fractions): the server makes the question, the browser only gets `publicQuestion`, and
 * `QuestionModal` draws it (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 4). A skill added to the ladder later is
 * covered automatically.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_FOCUS, makeFocusPack, type MathsFocus } from '../../../shared/maths/focus';
import { LADDER } from '../../../shared/maths/ladder';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { makeRunQuestions, markQuestion } from '../../../shared/mine/maths';
import { QuestionModal } from '../../maths/QuestionModal';
import { factText } from './factText';

afterEach(cleanup);

const focusOn = (skill: string): MathsFocus => ({ ...AUTO_FOCUS, source: 'teacher-class', skills: [skill], onlyThese: true });

/** A few questions the server could make for a class focused on one skill. */
function questionsFor(skill: string, multipleChoice: boolean): Question[] {
  const pack = makeFocusPack([], focusOn(skill), {}, seededRandom(`mine-${skill}`));
  const out: Question[] = [];
  for (let i = 0; i < 6; i++) {
    const q = pack.nextQuestion({ multipleChoice });
    if (q) out.push(q);
  }
  return out;
}

describe('every skill on the ladder shows in the question box', () => {
  const built = LADDER.filter((s) => s.built);

  for (const skill of built) {
    for (const multipleChoice of [false, true]) {
      it(`${skill.id} (${multipleChoice ? 'tap an answer' : 'type an answer'}) shows, hides the answer, and takes the right answer`, async () => {
        const questions = questionsFor(skill.id, multipleChoice);
        expect(questions.length).toBeGreaterThan(0);
        for (const [slot, q] of questions.slice(0, 3).entries()) {
          const shown = publicQuestion(q, slot);
          // What the browser is given has no answer, key or numbers behind the question.
          expect(shown).not.toHaveProperty('answer');
          expect(shown).not.toHaveProperty('factKey');
          expect(shown).not.toHaveProperty('params');
          const marked = markQuestion(q)!;
          expect(marked).not.toBeNull();
          const onSubmit = vi.fn(async (value: number) => ({ correct: Math.abs(value - marked.answer) < 1e-9, fact: factText(shown, marked.answer), boxBefore: 0, boxAfter: 0, answer: marked.answer }));
          const onDone = vi.fn();
          const u = userEvent.setup();
          const { unmount } = render(<QuestionModal question={{ ...shown, id: slot }} title="Question door" onSubmit={onSubmit} onDone={onDone} timeScale={0} />);
          const fact = screen.getByLabelText(q.spoken);
          expect(fact).toBeInTheDocument();
          if (shown.choices) {
            // Pick the right choice.
            const buttons = screen.getByRole('group', { name: 'Choose an answer' }).querySelectorAll('button');
            expect(buttons.length).toBeGreaterThanOrEqual(2);
            await u.click(buttons[shown.choices.indexOf(marked.answer)]);
          } else {
            await u.keyboard(`${String(marked.answer)}{Enter}`);
          }
          await waitFor(() => expect(onDone).toHaveBeenCalled());
          expect(onSubmit).toHaveBeenCalledTimes(1);
          expect(onDone.mock.calls[0][0].correct).toBe(true);
          expect(onSubmit.mock.calls[0][0]).toBeCloseTo(marked.answer, 9);
          unmount();
        }
      });
    }
  }

  it('shows the whole fact after a wrong answer, with the right answer in it', async () => {
    const q = questionsFor('facts-10', false)[0];
    const shown = publicQuestion(q, 0);
    const marked = markQuestion(q)!;
    const u = userEvent.setup();
    render(
      <QuestionModal
        question={{ ...shown, id: 0 }}
        title="Question door"
        onSubmit={async () => ({ correct: false, fact: factText(shown, marked.answer), boxBefore: 0, boxAfter: 0, answer: marked.answer })}
        onDone={() => {}}
        timeScale={1000}
      />,
    );
    await u.keyboard(`${marked.answer + 1}{Enter}`);
    expect(await screen.findByText(factText(shown, marked.answer))).toBeInTheDocument();
  });
});

describe('the questions for a run', () => {
  it('can be marked, are different from each other where the focus allows, and are the same again from the same seed', () => {
    const context = { facts: [], settings: {}, focus: focusOn('facts-20') };
    const a = makeRunQuestions(context, 12, seededRandom('seed-a'));
    const b = makeRunQuestions(context, 12, seededRandom('seed-a'));
    expect(a).toHaveLength(12);
    expect(a).toEqual(b);
    for (const q of a) expect(markQuestion(q)).not.toBeNull();
    expect(new Set(a.map((q) => q.factKey)).size).toBeGreaterThan(6);
  });

  it('gives a full list even with the plain times-table step and no records', () => {
    const list = makeRunQuestions({ facts: [], settings: {} }, 33, seededRandom('seed-b'));
    expect(list).toHaveLength(33);
  });

  it('writes the whole fact for typed, picked and money questions', () => {
    expect(factText({ parts: ['7', '×', '8', '=', '?'] }, 56)).toBe('7 × 8 = 56');
    expect(factText({ parts: ['3/4', '=', '?'], choiceLabels: ['0.25', '0.75'] }, 1)).toBe('3/4 = 0.75');
    expect(factText({ parts: ['?/8', '=', '1/2'] }, 4)).toBe('4/8 = 1/2');
    expect(factText({ parts: ['$', '?'] }, 4.1)).toBe('$4.10');
  });
});

/**
 * Every kind of question the maths ladder can make has to show in the speed round's question box and be answerable
 * (typed, picked, decimal key, fractions): the server makes the question, the browser only gets `publicQuestion`, and
 * `QuestionModal` draws it (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 4). A skill added to the ladder later is
 * covered automatically.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import { LADDER } from '../../../shared/maths/ladder';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import { makeRoundQuestions, markQuestion } from '../../../shared/archery/speed';
import { QuestionModal } from '../../maths/QuestionModal';
import { factText } from './factText';

afterEach(cleanup);

const focusOn = (skill: string): MathsFocus => ({ ...AUTO_FOCUS, source: 'teacher-class', skills: [skill], onlyThese: true });

describe('every skill on the ladder shows in the speed round', () => {
  for (const skill of LADDER.filter((s) => s.built)) {
    for (const multipleChoice of [false, true]) {
      it(`${skill.id} (${multipleChoice ? 'tap an answer' : 'type an answer'}) shows, hides the answer, and takes the right answer`, async () => {
        const questions = makeRoundQuestions({ facts: [], settings: { multipleChoice }, focus: focusOn(skill.id) }, seededRandom(`archery-${skill.id}`));
        expect(questions.length).toBeGreaterThan(0);
        for (const [slot, q] of questions.slice(0, 3).entries()) {
          const shown = publicQuestion(q, slot);
          expect(shown).not.toHaveProperty('answer');
          expect(shown).not.toHaveProperty('factKey');
          const marked = markQuestion(q)!;
          const onSubmit = vi.fn(async (value: number) => ({ correct: Math.abs(value - marked.answer) < 1e-9, fact: factText(shown, marked.answer), boxBefore: 0, boxAfter: 0, answer: marked.answer }));
          const onDone = vi.fn();
          const u = userEvent.setup();
          const { unmount } = render(<QuestionModal question={{ ...shown, id: slot }} title="Speed round" secondsLeft={10 - slot} scribble={false} onSubmit={onSubmit} onDone={onDone} timeScale={0} />);
          expect(screen.getByLabelText(q.spoken)).toBeInTheDocument();
          if (shown.choices) {
            const buttons = screen.getByRole('group', { name: 'Choose an answer' }).querySelectorAll('button');
            await u.click(buttons[shown.choices.indexOf(marked.answer)]);
          } else {
            await u.keyboard(`${String(marked.answer)}{Enter}`);
          }
          await waitFor(() => expect(onDone).toHaveBeenCalled());
          expect(onDone.mock.calls[0][0].correct).toBe(true);
          unmount();
        }
      });
    }
  }

  it('writes the whole fact for typed, picked and money questions', () => {
    expect(factText({ parts: ['7', '×', '8', '=', '?'] }, 56)).toBe('7 × 8 = 56');
    expect(factText({ parts: ['3/4', '=', '?'], choiceLabels: ['0.25', '0.75'] }, 1)).toBe('3/4 = 0.75');
  });
});

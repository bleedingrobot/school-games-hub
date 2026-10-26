/**
 * Every kind of question the maths ladder can make has to show in Mine Runner’s question box and be answerable
 * (typed, picked, decimal key, fractions): the server makes the question, the browser only gets `publicQuestion`, and
 * `QuestionModal` draws it (docs/GAME_DEVELOPMENT_GUIDE.md, section 4.1 rule 4). A skill added to the ladder later is
 * covered automatically.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AUTO_FOCUS, makeFocusPack, type MathsFocus } from '../../../shared/maths/focus';
import { LADDER } from '../../../shared/maths/ladder';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { markQuestion } from '../../../shared/mine/maths';
import { QuestionModal } from '../../maths/QuestionModal';
import { factText } from './factText';

afterEach(cleanup);

const focusOn = (skill: string): MathsFocus => ({ ...AUTO_FOCUS, source: 'teacher-class', skills: [skill], onlyThese: true });

/** One question of each kind the server could make for every built skill on the ladder, typed and picked. */
function everyQuestion() {
  const out: { skill: string; q: Question }[] = [];
  for (const skill of LADDER.filter((s) => s.built)) {
    for (const multipleChoice of [false, true]) {
      const q = makeFocusPack([], focusOn(skill.id), {}, seededRandom(`mine-${skill.id}`)).nextQuestion({ multipleChoice });
      expect(q, skill.id).toBeTruthy();
      out.push({ skill: skill.id, q: q! });
    }
  }
  return out;
}

it('every ladder skill comes through without its answer, can be marked, and shows in the question box taking the right answer', async () => {
  const shapes = new Set<string>();
  for (const { skill, q } of everyQuestion()) {
    const shown = publicQuestion(q, 0);
    expect(shown, skill).not.toHaveProperty('answer');
    expect(shown, skill).not.toHaveProperty('factKey');
    const marked = markQuestion(q)!;
    expect(marked, skill).not.toBeNull();
    if (shown.choices) expect(shown.choices, skill).toContain(marked.answer);
    // Draw one of each shape (typed, decimal, picked, labelled choices): drawing all of them is slow.
    const shape = `${shown.input ?? 'typed'}:${shown.choices ? 'choices' : ''}:${shown.choiceLabels ? 'labels' : ''}`;
    if (shapes.has(shape)) continue;
    shapes.add(shape);
    const onSubmit = vi.fn(async (value: number) => ({ correct: Math.abs(value - marked.answer) < 1e-9, fact: factText(shown, marked.answer), boxBefore: 0, boxAfter: 0, answer: marked.answer }));
    const onDone = vi.fn();
    const u = userEvent.setup({ delay: null });
    const { unmount } = render(<QuestionModal question={{ ...shown, id: 0 }} title="Question door" onSubmit={onSubmit} onDone={onDone} timeScale={0} />);
    expect(screen.getByLabelText(q.spoken)).toBeInTheDocument();
    if (shown.choices) {
      const buttons = screen.getByRole('group', { name: 'Choose an answer' }).querySelectorAll('button');
      await u.click(buttons[shown.choices.indexOf(marked.answer)]);
    } else {
      await u.keyboard(`${String(marked.answer)}{Enter}`);
    }
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0].correct, skill).toBe(true);
    unmount();
  }
  expect(shapes.size).toBeGreaterThanOrEqual(2);
});

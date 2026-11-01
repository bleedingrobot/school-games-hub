/**
 * Every kind of question the maths ladder can make has to come through the Sky Isles server and show in the question
 * box (typed, picked, decimal key, fractions), and the right answer has to be marked right: the server makes and keeps
 * the question, the browser only gets `publicQuestion`, and `QuestionModal` draws it (docs/GAME_DEVELOPMENT_GUIDE.md,
 * section 4.1 rule 4). A skill added to the ladder later is covered automatically. (Test 4 of the game's 8.)
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import { LADDER } from '../../../shared/maths/ladder';
import { markQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import { memoryServices } from '../../../shared/isles/memoryServices';
import { handleIsles, type ShownQuestion } from '../../../shared/isles/server';
import { QuestionModal } from '../../maths/QuestionModal';

afterEach(cleanup);

const focusOn = (skill: string): MathsFocus => ({ ...AUTO_FOCUS, source: 'teacher-class', skills: [skill], onlyThese: true });

describe('every skill on the ladder comes through the Sky Isles server and shows', () => {
  for (const skill of LADDER.filter((s) => s.built)) {
    for (const multipleChoice of [false, true]) {
      it(`${skill.id} (${multipleChoice ? 'tap an answer' : 'type an answer'})`, async () => {
        const services = memoryServices({
          maths: () => ({ facts: [], settings: { multipleChoice }, focus: focusOn(skill.id) }),
          random: seededRandom(`isles-${skill.id}`),
          now: () => Date.UTC(2026, 10, 2, 22),
        });
        const ask = (body: Record<string, unknown>) => handleIsles(services, 'pupil-a', body);
        // The turn question, and the questions of a Sky Race.
        const turn = (await ask({ action: 'load' })).body.question as ShownQuestion;
        const race = (await ask({ action: 'raceStart', opponent: 'gull-riders' })).body.race as { id: number; questions: ShownQuestion[] };
        expect(turn, skill.id).toBeTruthy();
        expect(race.questions.length, skill.id).toBe(3);

        for (const [i, shown] of [turn, ...race.questions.slice(0, 2)].entries()) {
          expect(shown).not.toHaveProperty('answer');
          expect(shown).not.toHaveProperty('factKey');
          const stored = services.data.questions.find((q) => q.id === shown.set)!.questions[shown.slot];
          const right = markQuestion(stored)!.answer;
          const onSubmit = vi.fn(async (value: number) => {
            const r = await ask(i === 0 ? { action: 'answer', set: shown.set, slot: shown.slot, value } : { action: 'raceAnswer', race: race.id, slot: shown.slot, value });
            const marked = r.body as { right: boolean; answer: number };
            return { correct: marked.right, fact: shown.spoken, boxBefore: 0, boxAfter: 0, answer: marked.answer };
          });
          const onDone = vi.fn();
          const u = userEvent.setup();
          const { unmount } = render(<QuestionModal question={{ ...shown, id: shown.slot }} title="The sky pilot's question" scribble={false} onSubmit={onSubmit} onDone={onDone} timeScale={0} />);
          expect(screen.getByLabelText(stored.spoken)).toBeInTheDocument();
          if (shown.choices) {
            const buttons = screen.getByRole('group', { name: 'Choose an answer' }).querySelectorAll('button');
            await u.click(buttons[shown.choices.indexOf(right)]);
          } else {
            await u.keyboard(`${String(right)}{Enter}`);
          }
          await waitFor(() => expect(onDone).toHaveBeenCalled());
          expect(onDone.mock.calls[0][0].correct, skill.id).toBe(true);
          unmount();
        }
      });
    }
  }
});

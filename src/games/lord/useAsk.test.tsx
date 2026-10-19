import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FEEDBACK_MS } from '../../maths/QuestionModal';
import { useAsk, type Asked } from './useAsk';

// The answers below are often wrong, and a wrong answer's message stays up for 2 seconds. On a busy computer that left too
// little of the 10 seconds to find the next question. A short pause still shows the mark before the next question comes.
const SHOWN = { ...FEEDBACK_MS };
beforeAll(() => Object.assign(FEEDBACK_MS, { right: 150, wrong: 150 }));
afterAll(() => Object.assign(FEEDBACK_MS, SHOWN));

afterEach(cleanup);

/** Asks one question after another, straight on, as a master's trial does. */
function Trial({ onDone, count = 3, pack }: { onDone: (answers: Asked[]) => void; count?: number; pack?: 'add-sub' }) {
  const { ask, modal } = useAsk(1);
  useEffect(() => {
    void (async () => {
      const answers: Asked[] = [];
      for (let i = 1; i <= count; i++) answers.push(await ask('master-trial', { title: `Question ${i}`, closeLabel: 'Skip this one', pack }));
      onDone(answers);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{modal}</>;
}

describe('useAsk', () => {
  it('starts each question empty when questions follow straight on (questions from two packs can share a number)', async () => {
    let answers: Asked[] | null = null;
    render(<Trial onDone={(a) => (answers = a)} />);
    for (let i = 1; i <= 3; i++) {
      await screen.findByRole('dialog', { name: `Question ${i}` }, { timeout: 10_000 });
      expect(screen.queryByText(/correct|not quite/i)).toBeNull();
      const choices = screen.queryByRole('group', { name: 'Choose an answer' });
      if (choices) {
        act(() => choices.querySelector('button')!.click());
      } else {
        act(() => screen.getByRole('button', { name: /^0$/ }).click());
        act(() => screen.getByRole('button', { name: 'Check my answer' }).click());
      }
    }
    await waitFor(() => expect(answers).toHaveLength(3), { timeout: 10_000 });
  }, 40_000);

  it('keeps an answer given the moment the next box appears', async () => {
    // The box used to clear itself just after it was shown, so a tap in between was wiped and the box sat on "?".
    // This answers question 2 as soon as it is on the page, before anything else can run.
    const answerNow = () => {
      const box = document.querySelector('[role=dialog]')!;
      const press = (name: string) => [...box.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!.click();
      act(() => press('0'));
      act(() => press('Check my answer'));
    };
    let answers: Asked[] | null = null;
    render(<Trial onDone={(a) => (answers = a)} count={2} pack="add-sub" />);
    await screen.findByRole('dialog', { name: 'Question 1' });
    const seen = new MutationObserver(() => {
      if (!document.querySelector('[role=dialog]')?.textContent?.includes('Question 2')) return;
      seen.disconnect();
      answerNow();
    });
    seen.observe(document.body, { childList: true, subtree: true });
    answerNow();
    await waitFor(() => expect(answers).toHaveLength(2), { timeout: 5_000 });
  }, 15_000);
});

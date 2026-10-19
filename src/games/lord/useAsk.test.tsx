import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAsk, type Asked } from './useAsk';

afterEach(cleanup);

/** Asks one question after another, straight on, as a master's trial does. */
function Trial({ onDone }: { onDone: (answers: Asked[]) => void }) {
  const { ask, modal } = useAsk(1);
  useEffect(() => {
    void (async () => {
      const answers: Asked[] = [];
      for (let i = 1; i <= 3; i++) answers.push(await ask('master-trial', { title: `Question ${i}`, closeLabel: 'Skip this one' }));
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
});

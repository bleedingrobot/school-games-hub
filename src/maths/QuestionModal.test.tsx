import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { QuestionModal } from './QuestionModal';
import { setSkipMode } from './questionLog';

const question = (extra: Partial<Question> = {}): Question => ({
  id: 1,
  skill: 'times-tables',
  factKey: 'mul:7x8',
  kind: 'multiply',
  parts: ['7', '×', '8', '=', '?'],
  spoken: '7 times 8 equals what?',
  answer: 56,
  band: 'focus',
  ...extra,
});

function setup(q = question(), timeScale = 0) {
  const onSubmit = vi.fn(
    (answer: number): AnswerResult => ({ correct: answer === q.answer, fact: '7 × 8 = 56', boxBefore: 0, boxAfter: 1 }),
  );
  const onDone = vi.fn();
  render(<QuestionModal question={q} title="Mana Well" onSubmit={onSubmit} onDone={onDone} timeScale={timeScale} />);
  return { onSubmit, onDone };
}

describe('question box', () => {
  it('works by tapping the number pad', async () => {
    const user = userEvent.setup();
    const { onSubmit, onDone } = setup();
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: '9' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: '6' }));
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
    expect(screen.getByRole('status')).toHaveTextContent('Correct!');
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ correct: true })));
  });

  it('multiple choice: tap one of four', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ choices: [54, 56, 63, 48] }));
    expect(screen.queryByRole('group', { name: 'Number pad' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '56' }));
    expect(onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
  });

  it('with the class skip switch off: no skip button, Escape does nothing, and answering still works', async () => {
    setSkipMode('off');
    const onClose = vi.fn();
    render(<QuestionModal question={question()} title="Pit stop" onSubmit={() => ({ correct: true, fact: '7 × 8 = 56', boxBefore: 0, boxAfter: 1 })} onDone={() => {}} onClose={onClose} closeLabel="Skip" timeScale={0} />);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('56{Enter}');
    expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
    setSkipMode('on');
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { } from '../../shared/maths/banded';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { } from '../../shared/space/random';
import { } from '../../shared/maths/skillPacks/generated';
import { QuestionModal } from './QuestionModal';
import { setHelpSink } from './questionLog';

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

  it('works by tapping the number pad or the keyboard', async () => {
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

    // The keyboard works as soon as a box opens, wherever the focus is, and the game behind doesn't hear it; 1 to 4 pick a choice.
    cleanup();
    const game = vi.fn();
    window.addEventListener('keydown', game);
    const typed = setup(question({ id: 3 }));
    expect(screen.getByRole('dialog')).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('56{Enter}');
    expect(typed.onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
    expect(game).not.toHaveBeenCalled();
    window.removeEventListener('keydown', game);
    cleanup();
    const picked = setup(question({ id: 2, choices: [54, 56, 58, 64] }));
    expect(screen.getByRole('button', { name: /56/ })).toHaveAttribute('aria-keyshortcuts', '2');
    await user.keyboard('2');
    expect(picked.onSubmit).toHaveBeenCalledWith(56, expect.any(Number));

    // Help me (H1): opening it tells the database first, and the answer is only sent once it has heard.
    cleanup();
    let heard: () => void = () => {};
    const sink = { opened: vi.fn(() => new Promise<void>((done) => (heard = done))), cancelled: vi.fn() };
    setHelpSink(sink);
    const helpedQ = setup(question({ id: 4, parts: ['9', '÷', '4', '=', '2', 'r', '?'], answer: 1 }));
    await user.click(screen.getByRole('button', { name: 'Help me' }));
    expect(sink.opened).toHaveBeenCalledWith('remainder');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(helpedQ.onSubmit).not.toHaveBeenCalled();
    heard();
    await vi.waitFor(() => expect(helpedQ.onSubmit).toHaveBeenCalledWith(1, expect.any(Number)));
    expect(sink.cancelled).not.toHaveBeenCalled();
    setHelpSink(null);
  });
});

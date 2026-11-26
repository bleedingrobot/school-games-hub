import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { } from '../../shared/maths/banded';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { } from '../../shared/space/random';
import { } from '../../shared/maths/skillPacks/generated';
import { QuestionModal } from './QuestionModal';
import { setHelpSink } from './questionLog';
import { setFeedbackSink } from './questionFeedback';

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

    // H2: every ladder question has a Help me card worked with its own numbers, a fact they know first, and never the answer.
    cleanup();
    setHelpSink({ opened: async () => {}, cancelled: () => {}, known: async () => ['mul:7x7'] });
    setup(question({ id: 5 }));
    await user.click(screen.getByRole('button', { name: 'Help me' }));
    const steps = await screen.findAllByRole('listitem');
    await vi.waitFor(() => expect(screen.getByRole('list').textContent).toContain('7 × 7'));
    expect(steps.at(-1)?.textContent).toContain('?');
    expect(screen.getByRole('dialog').textContent).not.toMatch(/= 56|\b56\b/);
    setHelpSink(null);

    // Feedback on this question (teachers only): pupils get no tab; a teacher's note is saved with what the box showed.
    cleanup();
    setup(question({ id: 6 }));
    expect(screen.queryByRole('button', { name: /Feedback/ })).toBeNull();
    cleanup();
    const send = vi.fn(async () => {});
    setFeedbackSink({ send });
    setup(question({ id: 7, parts: ['23', '×', '4', '=', '?'], factKey: 'mul:23x4', answer: 92 }));
    await user.click(screen.getByRole('button', { name: /Feedback/ }));
    const panel = screen.getByRole('region', { name: 'Feedback on this question' });
    await user.click(screen.getByRole('button', { name: 'The picture' }));
    await user.type(screen.getByRole('textbox', { name: 'Your feedback' }), 'Box should say 20 and 3');
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));
    expect(await screen.findByText('Saved. Thank you!')).toBeTruthy();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      feedback: 'Box should say 20 and 3', tags: ['picture'], key: 'mul:23x4',
      question: expect.objectContaining({ title: 'Mana Well', parts: ['23', '×', '4', '=', '?'], answer: 92 }),
      picture: expect.objectContaining({ kind: 'split-box', tens: 20, ones: 3 }),
      help: expect.objectContaining({ steps: expect.any(Array) }),
    }));
    expect(panel).toBeTruthy();
    // Typing the note never types into the answer.
    expect(screen.getByRole('dialog').querySelector('.question__blank')?.textContent).toBe('?');
    setFeedbackSink(null);
    localStorage.clear();
  });
});

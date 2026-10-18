import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { FEEDBACK_MS, QuestionModal } from './QuestionModal';

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

describe('the countdown', () => {
  const withSeconds = (secondsLeft: number) => {
    const q = question();
    return <QuestionModal question={q} title="Wormhole boost" onSubmit={() => ({ correct: true, fact: '', boxBefore: 0, boxAfter: 1 })} onDone={() => {}} secondsLeft={secondsLeft} />;
  };
  const warning = () => document.querySelector('.sr-only[aria-live="polite"]')!;

  it('has a name and a value for screen readers, and says so at 10 and 5 seconds only', () => {
    const { rerender } = render(withSeconds(20));
    expect(screen.getByRole('timer', { name: '20 seconds left' })).toBeInTheDocument();
    expect(warning()).toHaveTextContent('');
    rerender(withSeconds(10));
    expect(warning()).toHaveTextContent('10 seconds left');
    rerender(withSeconds(9));
    expect(warning()).toHaveTextContent('');
    rerender(withSeconds(5));
    expect(warning()).toHaveTextContent('5 seconds left');
  });
});

describe('question box', () => {
  it('shows the fact big, with a name screen readers can say', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Mana Well' })).toHaveFocus();
    expect(screen.getByLabelText('7 times 8 equals what?')).toHaveTextContent('7×8=?');
  });

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

  it('works with a keyboard: digits, Backspace and Enter', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled(); // nothing typed yet
    await user.keyboard('57{Backspace}6{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
  });

  it('typing still works after tapping the pad', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.keyboard('6{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
  });

  it('takes at most 3 digits, and no leading zeros', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.keyboard('001234{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(123, expect.any(Number));
  });

  it('a wrong answer shows the whole fact for 2 seconds, with no penalty from the box', async () => {
    vi.useFakeTimers();
    const { onDone } = setup(question(), 1);
    act(() => screen.getByRole('button', { name: '5' }).click());
    act(() => screen.getByRole('button', { name: '4' }).click());
    act(() => screen.getByRole('button', { name: 'Check my answer' }).click());
    expect(screen.getByRole('status')).toHaveTextContent('7 × 8 = 56');
    expect(screen.getByLabelText('7 times 8 equals what?')).toHaveTextContent('56'); // the blank shows the right answer
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(FEEDBACK_MS.wrong - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
    vi.useRealTimers();
  });

  it('multiple choice: tap one of four', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ choices: [54, 56, 63, 48] }));
    expect(screen.queryByRole('group', { name: 'Number pad' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '56' }));
    expect(onSubmit).toHaveBeenCalledWith(56, expect.any(Number));
  });

  it('missing-factor questions fill the blank where it is', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ parts: ['?', '×', '8', '=', '56'], spoken: 'what times 8 equals 56?', answer: 7 }));
    await user.keyboard('7');
    expect(screen.getByLabelText('what times 8 equals 56?')).toHaveTextContent('7×8=56');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(7, expect.any(Number));
  });

  it('decimal questions have a point key, and a leading point becomes 0.', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ parts: ['0.3', '+', '0.5', '=', '?'], spoken: '0.3 plus 0.5 equals what?', answer: 0.8, input: 'decimal' }));
    await user.click(screen.getByRole('button', { name: 'Point' }));
    await user.keyboard('.8'); // a second point is ignored
    expect(screen.getByLabelText('0.3 plus 0.5 equals what?')).toHaveTextContent('0.8');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(0.8, expect.any(Number));
  });

  it('whole-number questions ignore the point, and longer answers fit when the question allows', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ parts: ['47', '×', '100', '=', '?'], spoken: '47 times 100 equals what?', answer: 4700, maxLength: 5 }));
    expect(screen.queryByRole('button', { name: 'Point' })).not.toBeInTheDocument();
    await user.keyboard('47.00{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(4700, expect.any(Number));
  });

  it('fractions are drawn top over bottom, with the blank inside', async () => {
    const user = userEvent.setup();
    setup(question({ parts: ['1/2', '=', '?/8'], spoken: '1 half equals what eighths?', answer: 4 }));
    const fact = screen.getByLabelText('1 half equals what eighths?');
    expect(fact.querySelectorAll('.qfrac')).toHaveLength(2);
    await user.keyboard('4');
    expect(fact.querySelectorAll('.qfrac')[1].querySelector('.qfrac__top .question__blank')).toHaveTextContent('4');
  });

  it('pick questions show their labels and answer with the index', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup(question({ parts: ['Which is bigger?'], spoken: 'Which is bigger: 2 thirds or 3 quarters?', answer: 1, choices: [0, 1], choiceLabels: ['2/3', '3/4'] }));
    await user.click(screen.getByRole('button', { name: '3 quarters' }));
    expect(onSubmit).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it('a wrong money answer shows the cents', async () => {
    const user = userEvent.setup();
    setup(question({ parts: ['$2.40', '+', '$1.70', '=', '$', '?'], spoken: '$2.40 plus $1.70 equals $ what?', answer: 4.1, input: 'decimal' }), 1);
    await user.keyboard('5{Enter}');
    expect(screen.getByLabelText('$2.40 plus $1.70 equals $ what?')).toHaveTextContent('4.10');
  });
});

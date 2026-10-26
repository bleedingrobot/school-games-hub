// The class's "Skip button" switch in the question boxes (docs/QUESTION-SKIPS-PLAN.md, stage S.3).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildQuestion } from '../../shared/maths/practical';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { PracticalAsk } from './PracticalAsk';
import { QuestionModal } from './QuestionModal';
import { resetSkips, setSkipMode, skipRule, SKIPS_PER_GAME, spendSkip } from './questionLog';

const question = (id = 1): Question => ({
  id,
  skill: 'times-tables',
  factKey: 'mul:7x8',
  kind: 'multiply',
  parts: ['7', '×', '8', '=', '?'],
  spoken: '7 times 8 equals what?',
  answer: 56,
  band: 'focus',
});
const marked = (answer: number): AnswerResult => ({ correct: answer === 56, fact: '7 × 8 = 56', boxBefore: 0, boxAfter: 1 });

function box(onClose = vi.fn(), extra: { closeIsSkip?: boolean; id?: number } = {}) {
  return (
    <QuestionModal
      question={question(extra.id)}
      title="Pit stop"
      onSubmit={marked}
      onDone={() => {}}
      onClose={onClose}
      closeLabel="Skip"
      closeIsSkip={extra.closeIsSkip}
      timeScale={0}
    />
  );
}

describe('the skip rule', () => {
  it('is on (no limit) until the website sets it', () => {
    expect(skipRule()).toEqual({ canSkip: true, left: null });
    expect(spendSkip()).toBe(true);
    expect(skipRule()).toEqual({ canSkip: true, left: null });
  });

  it('counts down 3 per game, then stops, and starts again on a new page', () => {
    setSkipMode('limited');
    expect(skipRule()).toEqual({ canSkip: true, left: SKIPS_PER_GAME });
    for (let i = 0; i < SKIPS_PER_GAME; i++) expect(spendSkip()).toBe(true);
    expect(skipRule()).toEqual({ canSkip: false, left: 0 });
    expect(spendSkip()).toBe(false);
    resetSkips();
    expect(skipRule()).toEqual({ canSkip: true, left: SKIPS_PER_GAME });
  });

  it('off allows none', () => {
    setSkipMode('off');
    expect(skipRule()).toEqual({ canSkip: false, left: null });
    expect(spendSkip()).toBe(false);
  });
});

describe('QuestionModal and the skip switch', () => {
  it('on: the skip button and Escape work as before, with no count', async () => {
    const onClose = vi.fn();
    render(box(onClose));
    expect(screen.queryByText(/Skips left/)).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('off: no skip button, and Escape does nothing', async () => {
    setSkipMode('off');
    const onClose = vi.fn();
    render(box(onClose));
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    // Answering still works.
    await userEvent.keyboard('56{Enter}');
    expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
  });

  it('3 per game: shows the skips left, counts each skip, and at 0 behaves like off', async () => {
    setSkipMode('limited');
    const onClose = vi.fn();
    const view = render(box(onClose, { id: 1 }));
    expect(screen.getByText(`Skips left: ${SKIPS_PER_GAME}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`Skips left: ${SKIPS_PER_GAME - 1}`)).toBeInTheDocument();
    view.rerender(box(onClose, { id: 2 }));
    await userEvent.keyboard('{Escape}');
    view.rerender(box(onClose, { id: 3 }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.getByText('No skips left in this game')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
    // A new game page: the skips are back.
    act(() => resetSkips());
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('leaves a close button that isn’t a skip alone (Gem Keep’s “Well done”, Monsters’ “Back”)', async () => {
    setSkipMode('off');
    const onClose = vi.fn();
    render(box(onClose, { closeIsSkip: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Skips left/)).not.toBeInTheDocument();
  });

  it('the switch changing while a box is open takes effect straight away', () => {
    render(box());
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    act(() => setSkipMode('off'));
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });
});

describe('PracticalAsk and the skip switch', () => {
  const q = buildQuestion('percent-of', [10, 80]);

  it('off: no “No thanks”', () => {
    setSkipMode('off');
    render(<PracticalAsk question={q} title="Battle Cry!" onSubmit={() => {}} onNoThanks={() => {}} />);
    expect(screen.queryByRole('button', { name: 'No thanks' })).not.toBeInTheDocument();
  });

  it('3 per game: counts “No thanks” as a skip', async () => {
    setSkipMode('limited');
    const onNoThanks = vi.fn();
    render(<PracticalAsk question={q} title="Battle Cry!" onSubmit={() => {}} onNoThanks={onNoThanks} />);
    expect(screen.getByText(`Skips left: ${SKIPS_PER_GAME}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(onNoThanks).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`Skips left: ${SKIPS_PER_GAME - 1}`)).toBeInTheDocument();
  });

  it('keeps Clan Quest’s “Show me how”', async () => {
    setSkipMode('off');
    const onNoThanks = vi.fn();
    render(<PracticalAsk question={q} title="The bill" onSubmit={() => {}} onNoThanks={onNoThanks} noThanksLabel="Show me how" noThanksIsSkip={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show me how' }));
    expect(onNoThanks).toHaveBeenCalledTimes(1);
  });
});

import { spokenLabel } from '../../shared/maths/banded';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ladderData from '../data/ladder';
import { AUTO_FOCUS, type MathsFocus } from '../../shared/maths/focus';
import { PLACEMENT_QUESTIONS } from '../../shared/maths/config';
import { checkPlacement } from '../../shared/maths/placementCheck';
import type { Question } from '../../shared/maths/skillPack';
import Placement from './Placement';

/** Every question the page asked, in order, so the test can answer them. */
const asked: Question[] = [];
vi.mock('../../shared/maths/place', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../shared/maths/place')>();
  return {
    ...real,
    placementQuestion: (...args: Parameters<typeof real.placementQuestion>) => {
      const q = real.placementQuestion(...args);
      if (q) asked.push(q);
      return q;
    },
  };
});
vi.mock('../data/ladder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/ladder')>()),
  fetchMyLadder: vi.fn(),
  sendPlacement: vi.fn(),
}));

const focus = (over: Partial<NonNullable<MathsFocus['ladder']>> = {}): MathsFocus => ({
  ...AUTO_FOCUS,
  ladder: { on: true, yearLevel: 5, placed: null, placement: null, furthest: null, ...over },
});
const show = () =>
  render(
    <MemoryRouter>
      <Placement />
    </MemoryRouter>,
  );

beforeEach(() => {
  asked.length = 0;
  vi.mocked(ladderData.fetchMyLadder).mockReset().mockResolvedValue({ facts: [], settings: {}, focus: focus() });
  vi.mocked(ladderData.sendPlacement).mockReset().mockResolvedValue('saved');
});

/** Answers the question on screen: right, or deliberately wrong. */
async function answer(user: ReturnType<typeof userEvent.setup>, n: number, right: boolean) {
  await screen.findByText(`Question ${n} of ${PLACEMENT_QUESTIONS}`, undefined, { timeout: 4000 });
  const q = asked[n - 1];
  if (q.choices) {
    // Four choices to tap (order of operations): the right one, or a wrong one.
    const target = right ? q.answer : q.choices.find((c) => c !== q.answer)!;
    // A pick-one question names its buttons by the choice (spoken: "3 tenths"), not by its number.
    const name = q.choiceLabels ? spokenLabel(q.choiceLabels[target]) : String(target);
    await user.click(screen.getByRole('button', { name }));
  } else {
    // Typed on the pad; a decimal has a point key.
    const typed = String(right ? q.answer : Number((q.answer + 1).toFixed(3)));
    for (const char of typed) await user.click(screen.getByRole('button', { name: char === '.' ? 'Point' : char }));
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
  }
  // The feedback shows for a moment, then the next question (or the saving) comes up.
  await waitFor(() => expect(document.querySelector('.question[data-result]')).not.toBeNull());
  await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 4000 });
}

describe('the warm-up that finds a starting place', () => {
  it('explains itself kindly, is not called a test, and can be skipped', async () => {
    const user = userEvent.setup();
    show();
    expect(await screen.findByText(/quick questions/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\btest\b/i);
    expect(document.body.textContent).not.toMatch(/Year \d/);
    await user.click(screen.getByRole('button', { name: 'Skip it' }));
    expect(ladderData.sendPlacement).toHaveBeenCalledWith({ skip: true });
    expect(await screen.findByText(/All done/)).toBeInTheDocument();
  });

  it('asks the questions one at a time, then sends them to be checked', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Let’s go' }));
    for (let n = 1; n <= PLACEMENT_QUESTIONS; n++) await answer(user, n, true);
    await screen.findByText(/All done/);
    expect(ladderData.sendPlacement).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(ladderData.sendPlacement).mock.calls[0][0] as { answers: Parameters<typeof checkPlacement>[1] };
    expect(sent.answers).toHaveLength(PLACEMENT_QUESTIONS);
    // What it sends is exactly what the server will accept for this class.
    expect(checkPlacement(5, sent.answers)).not.toBeNull();
    // Shows no score.
    expect(document.body.textContent).not.toMatch(/\d+ (out )?of \d+ (right|correct)/i);
  }, 30_000);

  it('steps back to easier questions after a wrong answer', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Let’s go' }));
    await answer(user, 1, false);
    await answer(user, 2, true);
    const skills = asked.map((q) => q.skill);
    expect(skills.length).toBeGreaterThanOrEqual(2);
    // Question 2 is from a skill no later than question 1's.
    const { LADDER } = await import('../../shared/maths/ladder');
    const at = (key: string) => LADDER.findIndex((s) => s.keys.includes(key));
    expect(at(asked[1].factKey)).toBeLessThanOrEqual(at(asked[0].factKey));
  }, 30_000);

  it('lets them try again when saving fails, without asking the questions again', async () => {
    const user = userEvent.setup();
    vi.mocked(ladderData.sendPlacement).mockRejectedValueOnce(new Error('offline')).mockResolvedValue('saved');
    show();
    await user.click(await screen.findByRole('button', { name: 'Let’s go' }));
    for (let n = 1; n <= PLACEMENT_QUESTIONS; n++) await answer(user, n, true);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/All done/)).toBeInTheDocument();
    expect(ladderData.sendPlacement).toHaveBeenCalledTimes(2);
    expect(vi.mocked(ladderData.sendPlacement).mock.calls[1][0]).toEqual(vi.mocked(ladderData.sendPlacement).mock.calls[0][0]);
  }, 30_000);

  it('says there is nothing to do when auto is off, or it was already done', async () => {
    vi.mocked(ladderData.fetchMyLadder).mockResolvedValue({ facts: [], settings: {}, focus: { ...AUTO_FOCUS } });
    const { unmount } = show();
    expect(await screen.findByText(/nothing to do here/)).toBeInTheDocument();
    unmount();
    vi.mocked(ladderData.fetchMyLadder).mockResolvedValue({ facts: [], settings: {}, focus: focus({ placed: 'done', placement: 'facts-10' }) });
    show();
    expect(await screen.findByText(/nothing to do here/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Let’s go' })).not.toBeInTheDocument();
  });

  it('keeps the skip button on screen with the message if skipping fails', async () => {
    const user = userEvent.setup();
    vi.mocked(ladderData.sendPlacement).mockRejectedValue(new Error('offline'));
    show();
    await user.click(await screen.findByRole('button', { name: 'Skip it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
    expect(screen.getByRole('button', { name: 'Skip it' })).toBeInTheDocument();
  });
});

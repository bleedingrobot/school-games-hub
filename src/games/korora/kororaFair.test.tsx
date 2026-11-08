import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound, type Round } from '../../../shared/korora/round';
import { DEMOS } from './demo';
import { Goes } from './Goes';
import { WORDS } from './words';

describe('Fair or not with a real pile (R9)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** A round of fair goes only, each with the given help. */
  const fairRound = (h: 'full' | 'faint' | 'none'): Round => {
    const base = makeRound(5, [], { gold: true });
    const fair = base.goes.filter((g) => g.key.startsWith('oddeven:')).map((g) => ({ ...g, h }));
    return { ...base, goes: [...fair, ...base.goes.slice(0, 8)] }; // fair goes first, then the other eight
  };
  const bowls = () => [...document.querySelectorAll('.kr-bowl')].map((b) => b.querySelectorAll('.kr-fish').length);
  const choice = (n: number) => screen.getByRole('button', { name: new RegExp(n === 1 ? WORDS.fair : WORDS.tooMany) });

  it('keeps the choices shut until the pile is shared two at a time, then hints after the second wrong choice and counts one bowl', () => {
    const say = vi.fn();
    const full = fairRound('faint');
    const go = showRound(full)[0];
    render(<Goes round={full} help="faint" say={say} scenery="bronze" friend="korora" seen={["half", "near", "fair"]} onSeen={vi.fn()} sound={false} onDone={vi.fn()} />);
    expect(go.kind).toBe('fair');
    expect(choice(go.answer)).toHaveProperty('disabled', true);
    const pairs = Math.floor(go.n / 2);
    for (let i = 0; i < pairs; i++) fireEvent.click(screen.getByRole('button', { name: i < pairs ? WORDS.shareTwo : WORDS.allShared }));
    expect(bowls()).toEqual([pairs, pairs]);
    expect(choice(go.answer)).toHaveProperty('disabled', false);
    // Two wrong choices bring the pairing-off hint; the right one counts one bowl.
    expect(go.choices.slice().sort()).toEqual([0, 1]); // two choices
    const wrong = go.choices.find((c) => c !== go.answer)!;
    fireEvent.click(choice(wrong));
    expect(say).toHaveBeenLastCalledWith(WORDS.countOneBowl);
    // With only two choices the same wrong shell can be tapped again: that is the second wrong choice.
    fireEvent.click(choice(wrong));
    expect(say).toHaveBeenLastCalledWith(WORDS.pairOff);
    fireEvent.click(choice(go.answer));
    const k = pairs;
    expect(say).toHaveBeenLastCalledWith(go.answer === 1 ? WORDS.fairYes(k) : WORDS.oddYes(k));
    act(() => vi.advanceTimersByTime(1000 + k * 450));
    expect(document.querySelectorAll('.kr-fish__count')).toHaveLength(k);
  });

  it('shares the first two pairs itself on a bronze go, and the child shares the rest; the first fair-or-not go is shown first and skipped to the real one', async () => {
    const full = fairRound('full');
    const go = showRound(full)[0];
    render(<Goes round={full} help="full" say={vi.fn()} scenery="bronze" friend="korora" seen={["half", "near", "fair"]} onSeen={vi.fn()} sound={false} onDone={vi.fn()} />);
    expect(bowls()).toEqual([0, 0]);
    act(() => vi.advanceTimersByTime(2000));
    expect(bowls()).toEqual([2, 2]);
    expect((screen.getAllByRole('button').find((b) => b.className.includes('kr-choice')) as HTMLButtonElement).disabled).toBe(true);
    expect(go.n).toBeGreaterThanOrEqual(6);

    // Show me first: a child who has not seen fair or not gets a made-up pile of 5 (never a real one) with nothing to tap.
    cleanup();
    const say = vi.fn();
    const onSeen = vi.fn(() => Promise.resolve());
    render(<Goes round={full} help="full" say={say} scenery="bronze" friend="korora" seen={['half', 'near']} onSeen={onSeen} sound={false} onDone={vi.fn()} />);
    expect(screen.getByRole('heading', { name: WORDS.demoTitle })).toBeTruthy();
    expect(say).toHaveBeenCalledWith(DEMOS.fair.steps[0].line, expect.any(Function));
    expect(say).not.toHaveBeenCalledWith(go.spoken, expect.anything()); // the real question waits
    act(() => vi.advanceTimersByTime(1500));
    expect(document.querySelector('.kr-hand')).toBeNull();
    expect(screen.queryByRole('button', { name: WORDS.skip })).toBeNull(); // not for the first 3 seconds
    act(() => vi.advanceTimersByTime(2000));
    for (const b of screen.getAllByRole('button').filter((b) => b.className.includes('kr-choice'))) expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: WORDS.skip }));
    await act(async () => undefined);
    expect(onSeen).toHaveBeenCalledWith(['fair']);
    expect(screen.queryByRole('heading', { name: WORDS.demoTitle })).toBeNull();
    expect(say).toHaveBeenLastCalledWith(go.spoken, expect.any(Function)); // the child's own go is read now
  });
});

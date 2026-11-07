import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replay } from '../../../shared/hop/play';
import { makeRound, showRound } from '../../../shared/hop/round';
import { Hops } from './Hops';
import { WORDS } from './words';

describe("Hop's mistakes that teach", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const setup = () => {
    const round = makeRound(3, [], { gold: false });
    const hops = showRound(round);
    const say = vi.fn();
    const onDone = vi.fn();
    render(<Hops round={round} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={onDone} />);
    const worms = () => within(screen.getByRole('group', { name: WORDS.pickWorm }));
    const tap = (n: number) => fireEvent.click(worms().getByRole('button', { name: String(n) }));
    return { round, hops, say, onDone, worms, tap };
  };

  it('greys out the first wrong glow-worm, says why, and does not let it be tapped again', () => {
    const { hops, say, worms, tap } = setup();
    const [first] = hops[0].wrongs;
    tap(first.n);
    expect(say).toHaveBeenCalledWith(WORDS.why(first.kind, 10, hops[0].before, hops[0].answer, false));
    expect(screen.getByRole('status').textContent).toContain(WORDS.why(first.kind, 10, hops[0].before, hops[0].answer, false));
    expect(worms().getByRole('button', { name: String(first.n) }).hasAttribute('disabled')).toBe(true);
    expect(worms().getAllByRole('button').filter((b) => !b.hasAttribute('disabled'))).toHaveLength(3);
  });

  it('looks together after the second wrong one, then asks the same hop again, and only the first tap is scored', () => {
    const { round, hops, say, worms, tap, onDone } = setup();
    const [a, b, c] = hops[0].wrongs;
    tap(a.n);
    tap(b.n);
    // Taps are off while Hop counts the row.
    expect(screen.getByText(WORDS.lookTogether)).toBeTruthy();
    expect(worms().getAllByRole('button').every((x) => x.hasAttribute('disabled'))).toBe(true);
    tap(c.n);
    act(() => vi.advanceTimersByTime(13000));
    expect(say).toHaveBeenCalledWith(WORDS.nowTry);
    expect(screen.getByText(WORDS.nowTry)).toBeTruthy();
    // The same hop again, with all four glow-worms back.
    expect(worms().getAllByRole('button').filter((x) => !x.hasAttribute('disabled'))).toHaveLength(4);
    expect(worms().getAllByRole('button').map((x) => Number(x.textContent)).sort()).toEqual([...hops[0].choices].sort());
    tap(hops[0].answer);
    act(() => vi.advanceTimersByTime(2500));
    for (let i = 1; i < hops.length; i++) {
      tap(hops[i].answer);
      act(() => vi.advanceTimersByTime(2500));
    }
    const taps = onDone.mock.calls[0][0];
    expect(taps.slice(0, 3).map((t: { pick: number }) => t.pick)).toEqual([a.n, b.n, hops[0].answer]);
    const end = replay(round, taps);
    expect(end.done).toBe(true);
    expect(end.answers[0]).toMatchObject({ key: hops[0].key, correct: false });
    expect(end.answers.slice(1).every((x) => x.correct)).toBe(true);
  });
});

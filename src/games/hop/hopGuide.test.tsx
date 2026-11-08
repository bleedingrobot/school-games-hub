import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound } from '../../../shared/hop/round';
import { SoundProvider } from '../../sound';
import { trialBackend } from './backend';
import { HopGame } from './HopGame';
import { Hops } from './Hops';
import { WORDS } from './words';

const hand = () => document.querySelector('.hp-hand');

describe("Hop's guided first go", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('points at the right glow-worm on the very first hop only, and not on a later day', async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><HopGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await waitFor(() => expect(hand()).not.toBeNull());
    expect(document.querySelectorAll('.hp-hand')).toHaveLength(1);
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toMatch(/try this one/);
    cleanup();

    // A pupil who has finished a day gets no hand.
    trial.tools.jumpTo(3);
    render(<SoundProvider><HopGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Play/ }));
    await screen.findByRole('group');
    expect(hand()).toBeNull();
  });
});

describe("Hop's hundreds board", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('opens from a button, lights a number when tapped and turns it off again, and closes', async () => {
    const trial = trialBackend({ storageKey: 'board' });
    render(<SoundProvider><HopGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await userEvent.click(await screen.findByRole('button', { name: /100 board/ }));
    const board = screen.getByRole('group', { name: 'Hundreds board' });
    const cells = board.querySelectorAll('.hp-board__cell');
    expect(cells).toHaveLength(100);
    expect(cells[0].textContent).toBe('1');
    expect(cells[99].textContent).toBe('100');
    const thirty = within(board).getByRole('button', { name: '30' });
    await userEvent.click(thirty);
    expect(thirty.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(thirty);
    expect(thirty.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: /Hide board/ }));
    expect(screen.queryByRole('group', { name: 'Hundreds board' })).toBeNull();
  });
});

describe("Hop's answer clock", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('restarts once the question has been read aloud, and an old line ending never moves a newer clock', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(0);
    const round = makeRound(1, [], { gold: false });
    const hops = showRound(round);
    const say = vi.fn();
    const onDone = vi.fn();
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={round} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={onDone} />);
    const heard = () => say.mock.calls.filter(([, onEnd]) => onEnd).map(([, onEnd]) => onEnd as () => void);
    const tap = (n: number) => fireEvent.click(within(screen.getByRole('group', { name: WORDS.pickWorm })).getByRole('button', { name: String(n) }));
    for (let i = 0; i < hops.length; i++) {
      act(() => vi.advanceTimersByTime(5000)); // the question is being read
      if (i === 1) heard()[0](); // the first hop's line ends late: no effect on this one
      else heard()[i]();
      act(() => vi.advanceTimersByTime(3000));
      tap(hops[i].answer);
      heard()[i](); // and a line ending after the tap changes nothing
      act(() => vi.advanceTimersByTime(2500)); // Hop jumps (and, after the last hop, the round ends)
    }
    const ms = onDone.mock.calls[0][0].map((t: { ms: number }) => t.ms);
    expect(ms[0]).toBe(3000);
    expect(ms[1]).toBe(8000);
    // Show me first: a child who has not seen counting back gets a demo (Skip after 3 seconds, no tap added), then the real hop.
    cleanup();
    const markSeen = vi.fn(async () => []);
    const back = { ...round, hops: [{ ...round.hops[0], key: 'skip10:back:40' }, ...round.hops.slice(1)] };
    const demoSay = vi.fn();
    render(<Hops seenKinds={[]} markSeen={markSeen} round={back} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={demoSay} onDone={vi.fn()} />);
    expect(demoSay).toHaveBeenCalledWith(WORDS.demoBack[0], expect.anything());
    expect(document.querySelector('.hp-worms')).toHaveProperty('hidden', true);
    act(() => vi.advanceTimersByTime(3100));
    fireEvent.click(screen.getByRole('button', { name: WORDS.skipDemo }));
    await act(async () => {});
    expect(markSeen).toHaveBeenCalledWith(['back']);
    expect(document.querySelector('.hp-worms')).toHaveProperty('hidden', false);
  });
});

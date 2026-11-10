import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replay } from '../../../shared/hop/play';
import { makeRound, showRound, sisterHop, stepKeys } from '../../../shared/hop/round';
import { newStats } from '../../../shared/maths/leitner';
import { Hops } from './Hops';
import { hopLine } from './voiceLines';
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
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={round} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={onDone} />);
    const worms = () => within(screen.getByRole('group', { name: WORDS.pickWorm }));
    const tap = (n: number) => fireEvent.click(worms().getByRole('button', { name: String(n) }));
    return { round, hops, say, onDone, worms, tap };
  };

  it('shows each hop its own label, falls back to the calendar for a hop saved with no help, and shows none when the teacher turned labels off', () => {
    const round = makeRound(3, [], { gold: false });
    const mixed = { ...round, hops: round.hops.map((h, i) => ({ ...h, h: i === 0 ? ('none' as const) : i === 1 ? undefined : ('full' as const) })) };
    const props = { padMetal: 'green' as const, scenery: 'bronze' as const, friend: 'hop' as const, sound: false, say: vi.fn(), onDone: vi.fn() };
    const arcs = () => document.querySelectorAll('.hp-arc--none, .hp-arc--faint, .hp-arc--full');
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={mixed} help="faint" {...props} />);
    expect(document.querySelectorAll('.hp-arc--none').length).toBe(arcs().length);
    cleanup();
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={{ ...mixed, hops: [mixed.hops[1], ...mixed.hops.slice(1)] }} help="faint" {...props} />);
    expect(document.querySelectorAll('.hp-arc--faint').length).toBe(arcs().length);
    cleanup();
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={{ ...mixed, hops: mixed.hops.map((h) => ({ ...h, h: 'full' as const })) }} help="full" labels={false} {...props} />);
    expect(document.querySelectorAll('.hp-arc--none').length).toBe(arcs().length);
  });

  it('brings the labels back after three hops in a row with a wrong first glow-worm, saying so once, unless the teacher turned them off', () => {
    const round = makeRound(3, [], { gold: false });
    const bare = { ...round, hops: round.hops.map((h) => ({ ...h, h: 'none' as const })) };
    const hops = showRound(bare);
    const run = (labels: boolean) => {
      const say = vi.fn();
      render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={bare} help="none" labels={labels} padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={vi.fn()} />);
      for (let i = 0; i < 3; i++) {
        fireEvent.click(within(screen.getByRole('group', { name: WORDS.pickWorm })).getByRole('button', { name: String(hops[i].wrongs[0].n) }));
        if (i === 0) expect(document.querySelectorAll('.hp-arc--full')).toHaveLength(0);
        if (i < 2) {
          fireEvent.click(within(screen.getByRole('group', { name: WORDS.pickWorm })).getByRole('button', { name: String(hops[i].answer) }));
          act(() => vi.advanceTimersByTime(2500));
        }
      }
      return say;
    };
    const say = run(true);
    expect(document.querySelectorAll('.hp-arc--full').length).toBeGreaterThan(0);
    const whyCalls = say.mock.calls.filter(([t]) => t === WORDS.why(hops[2].wrongs[0].kind, hops[2]));
    expect(whyCalls).toHaveLength(1);
    act(() => whyCalls[0][1]());
    expect(say).toHaveBeenCalledWith(WORDS.labelsBack);
    cleanup();
    run(false);
    expect(document.querySelectorAll('.hp-arc--full')).toHaveLength(0);
  });

  it('greys out the first wrong glow-worm, says why, and does not let it be tapped again', () => {
    const { hops, say, worms, tap } = setup();
    const [first] = hops[0].wrongs;
    tap(first.n);
    expect(say).toHaveBeenCalledWith(WORDS.why(first.kind, hops[0]));
    expect(screen.getByRole('status').textContent).toContain(WORDS.why(first.kind, hops[0]));
    expect(worms().getByRole('button', { name: String(first.n) }).hasAttribute('disabled')).toBe(true);
    expect(worms().getAllByRole('button').filter((b) => !b.hasAttribute('disabled'))).toHaveLength(3);
  });

  it('Hear it again says the question, then the why-line once a wrong glow-worm shows one', () => {
    const { hops, say, tap } = setup();
    say.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Hear it again/ }));
    expect(say).toHaveBeenLastCalledWith(hopLine(hops[0].spoken, false), expect.any(Function));
    const [first] = hops[0].wrongs;
    tap(first.n);
    fireEvent.click(screen.getByRole('button', { name: /Hear it again/ }));
    expect(say).toHaveBeenLastCalledWith(WORDS.why(first.kind, hops[0]), expect.any(Function));
  });

  it('labels and explains threes and tens past 100 with their own hop size and words', () => {
    const passed = (...steps: (10 | 5 | 2 | 3 | 4)[]) => steps.flatMap(stepKeys).map((key) => ({ ...newStats(key), box: 2 }));
    const threes = makeRound(3, passed(10, 5, 2), { gold: false });
    expect(threes.step).toBe(3);
    const [hop] = showRound(threes);
    expect(hop.size).toBe(3);
    expect(WORDS.why('step', hop)).toBe('We are counting in threes. Each hop is 3.');
    expect(WORDS.why('off1', hop)).toBe(`${hop.before}, then 3 more is ${hop.answer}.`);
    expect(WORDS.counting(200)).toBe('Counting in tens past 100');
    const say = vi.fn();
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={{ ...threes, hops: threes.hops.map((h) => ({ ...h, h: 'full' as const })) }} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={vi.fn()} />);
    expect(screen.getAllByText('+3').length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole('group', { name: WORDS.pickWorm })).getByRole('button', { name: String(hop.wrongs[0].n) }));
    expect(screen.getByRole('status').textContent).toContain(WORDS.why(hop.wrongs[0].kind, hop));
  });

  it('looks together after the second wrong one, then asks a sister hop, and only the first tap is scored (a right tap on the sister sends the first hop’s right pick)', () => {
    const { round, hops, say, worms, tap, onDone } = setup();
    const [a, b, c] = hops[0].wrongs;
    tap(a.n);
    tap(b.n);
    // Taps are off while Hop counts the row.
    expect(screen.getByText(WORDS.lookTogether)).toBeTruthy();
    expect(worms().getAllByRole('button').every((x) => x.hasAttribute('disabled'))).toBe(true);
    tap(c.n);
    act(() => vi.advanceTimersByTime(13000));
    expect(say).toHaveBeenCalledWith(WORDS.nowTry, expect.any(Function));
    expect(screen.getByText(WORDS.nowTry)).toBeTruthy();
    // A sister hop (another fact of the same step), with its own four glow-worms and nothing pointed at.
    const sister = sisterHop(round, 0, hops[0])!;
    expect(sister.answer).not.toBe(hops[0].answer);
    expect(worms().getAllByRole('button').filter((x) => !x.hasAttribute('disabled'))).toHaveLength(4);
    expect(worms().getAllByRole('button').map((x) => Number(x.textContent)).sort()).toEqual([...sister.choices].sort());
    expect(document.querySelector('.hp-worm--pointed')).toBeNull();
    tap(sister.answer);
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

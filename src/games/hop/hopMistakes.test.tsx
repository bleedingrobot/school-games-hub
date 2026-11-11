import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound} from '../../../shared/hop/round';
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
    render(<Hops seenKinds={['back', 'offset']} markSeen={async () => []} round={round} help="full" padMetal="green" scenery="bronze" friend="hop" sound={false} say={say} onDone={onDone} />);
    const worms = () => within(screen.getByRole('group', { name: WORDS.pickWorm }));
    const tap = (n: number) => fireEvent.click(worms().getByRole('button', { name: String(n) }));
    return { round, hops, say, onDone, worms, tap };
  };

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

});

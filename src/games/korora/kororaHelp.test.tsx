import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound, type Round } from '../../../shared/korora/round';
import { Goes } from './Goes';
import { whyLine } from './voiceLines';
import { WORDS } from './words';

describe("Penguin Pairs' pictures follow the child (R6)", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /** Level 1 is all doubles, so each go's picture help is its water: clear, faint, or a ripple for none. */
  const round = (h: (i: number) => 'full' | 'faint' | 'none' | undefined): Round => {
    const base = makeRound(3, [], { gold: false });
    return { ...base, goes: base.goes.map((g, i) => ({ ...g, h: h(i) })) };
  };
  const props = { scenery: 'bronze' as const, friend: 'korora' as const, sound: false, onDone: vi.fn() };
  const water = () => document.querySelector('.kr-water')!.className;
  const group = () => within(screen.getByRole('group', { name: WORDS.pickNumber }));
  const tap = (n: number) => fireEvent.click(group().getByRole('button', { name: String(n) }));

  it("shows each go's own picture, falls back to the calendar for a go saved with none, and lets the teacher's setting win", () => {
    const r = round((i) => (i === 0 ? 'none' : i === 1 ? undefined : 'full'));
    const goes = showRound(r);
    const view = (setting?: 'always' | 'off') => render(<Goes round={r} help="faint" setting={setting} say={vi.fn()} {...props} />);
    view();
    expect(document.querySelector('.kr-water__ripple')).not.toBeNull();
    tap(goes[0].answer);
    act(() => vi.advanceTimersByTime(2500));
    expect(water()).toContain('kr-water--faint');
    cleanup();
    view('always');
    expect(water()).toContain('kr-water--full');
    cleanup();
    view('off');
    act(() => {});
    tap(goes[0].answer);
    act(() => vi.advanceTimersByTime(2500));
    tap(goes[1].answer);
    act(() => vi.advanceTimersByTime(2500));
    expect(document.querySelector('.kr-water__ripple')).not.toBeNull();
  });

  it('brings the pictures back after three goes in a row with a wrong first tap, saying so once, unless the teacher turned them off', () => {
    const r = round(() => 'none');
    const goes = showRound(r);
    const run = (setting: 'fade' | 'off') => {
      const say = vi.fn();
      render(<Goes round={r} help="none" setting={setting} say={say} {...props} />);
      for (let i = 0; i < 3; i++) {
        const wrong = goes[i].wrongs[0];
        tap(wrong.n);
        if (i === 0) expect(water()).not.toContain('kr-water--full');
        if (i < 2) {
          tap(goes[i].answer);
          act(() => vi.advanceTimersByTime(2500));
        }
      }
      return { say, why: whyLine(goes[2], goes[2].wrongs[0].kind) };
    };
    const { say, why } = run('fade');
    expect(water()).toContain('kr-water--full');
    const calls = say.mock.calls.filter(([t]) => t === why);
    expect(calls).toHaveLength(1);
    act(() => calls[0][1]());
    expect(say).toHaveBeenCalledWith(WORDS.picturesBack);
    cleanup();
    const off = run('off');
    expect(water()).not.toContain('kr-water--full');
    expect(off.say).not.toHaveBeenCalledWith(WORDS.picturesBack);
  });
});

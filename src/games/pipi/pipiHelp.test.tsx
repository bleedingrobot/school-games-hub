import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound, type Round } from '../../../shared/pipi/round';
import { Goes } from './Goes';
import { whyLine, WORDS } from './words';

describe("Pipi's help in the sand follows the child (R6)", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const round = (h: (i: number) => 'full' | 'faint' | 'none' | undefined): Round => {
    const base = makeRound(21, [], { colour: 'bronze' });
    return { ...base, goes: base.goes.map((g, i) => ({ ...g, h: h(i) })) };
  };
  const frame = () => document.querySelector('.pp-frame')!.className;
  const props = { scenery: 'bronze' as const, friend: 'pipi' as const, sound: false, onDone: vi.fn() };
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const shell = (n: number) => screen.getByRole('button', { name: String(n) });
  const tide = () => act(() => vi.advanceTimersByTimeAsync(1500));

  it('brings the full help back after three goes in a row with a wrong first shell, saying so once, unless the teacher turned the help off', async () => {
    const r = round(() => 'none');
    const goes = showRound(r);
    const run = async (helpOn: boolean) => {
      const say = vi.fn();
      const u = setup();
      const view = render(<Goes seen={['hiding', 'altogether', 'twoTides']} onSeen={vi.fn()} round={r} help="none" helpOn={helpOn} say={say} {...props} />);
      for (let i = 0; i < 3; i++) {
        await tide();
        await u.click(shell(goes[i].wrongs[0].n));
        if (i === 0) expect(frame()).not.toContain('pp-frame--full');
        if (i < 2) {
          await u.click(shell(goes[i].answer));
          await act(() => vi.advanceTimersByTimeAsync(1600));
        }
      }
      return { say, view, go: goes[2] };
    };
    const { say, view, go } = await run(true);
    expect(frame()).toContain('pp-frame--full');
    const why = whyLine(go.wrongs[0].kind, go.kind, go.whole, go.showing, go.hiding);
    const calls = say.mock.calls.filter(([t]) => t === why);
    expect(calls).toHaveLength(1);
    act(() => calls[0][1]());
    expect(say).toHaveBeenCalledWith(WORDS.outlinesBack);
    view.unmount();
    const off = await run(false);
    expect(frame()).toContain('pp-frame--none');
    expect(off.say).not.toHaveBeenCalledWith(WORDS.outlinesBack);
  });
});

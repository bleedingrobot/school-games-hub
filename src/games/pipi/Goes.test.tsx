import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound, sisterGo } from '../../../shared/pipi/round';
import type { Tap } from '../../../shared/pipi/play';
import { Goes } from './Goes';
import { whyLine } from './words';

describe("Pipi's Hidden Shells play screen: mistakes that teach (maths review R5)", () => {
  afterEach(() => vi.useRealTimers());

  it('greys a wrong shell and says why, looks together on the second, then asks a sister go, whose right shell ends the go', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const round = makeRound(21, [], { colour: 'bronze' });
    const go = showRound(round)[0];
    const [w1, w2] = go.choices.filter((c) => c !== go.answer);
    const done: Tap[][] = [];
    render(<Goes seen={['hiding', 'altogether', 'twoTides']} onSeen={vi.fn()} round={round} help="full" scenery="bronze" friend="pipi" sound={false} say={(t: string, cb?: () => void) => { if (cb && t === whyLine(go.wrongs.find((w) => w.n === w1)!.kind, go.kind, go.whole, go.showing, go.hiding)) cb(); }} onDone={(t) => done.push(t)} />);
    const shell = (n: number) => screen.getByRole('button', { name: String(n) });
    await act(() => vi.advanceTimersByTimeAsync(1500)); // the tide washes in

    await u.click(shell(w1));
    expect(screen.getByRole('status')).toHaveTextContent(/\w/);
    expect(shell(w1)).toBeDisabled();
    // Once its why line has been said, the wrong shell leaves the row; the answer never does.
    expect(shell(w1)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.queryByRole('button', { name: String(w1) })).toBeNull();
    expect(shell(go.answer)).toBeEnabled();
    expect(shell(w2)).toBeEnabled();

    await u.click(shell(w2));
    expect(screen.getByRole('status')).toHaveTextContent("Let's look together.");
    expect(screen.getByRole('status')).toHaveTextContent(`${go.whole} is ${go.showing} and ${go.hiding}`);
    await u.click(shell(go.answer)); // no taps while it shows
    expect(screen.getByLabelText('0 of 10')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(12000));
    expect(screen.getByText('Now you try one like it.')).toBeInTheDocument();
    // A sister go: another split, its own four shells, all enabled and nothing pointed at.
    const sister = sisterGo(round, 0, go)!;
    expect(sister.answer).not.toBe(go.answer);
    for (const n of sister.choices) expect(shell(n)).toBeEnabled();
    expect(document.querySelector('.pp-shellbtn--pointed')).toBeNull();
    await u.click(shell(sister.answer));
    await act(() => vi.advanceTimersByTimeAsync(1600));
    expect(screen.getByLabelText('1 of 10')).toBeInTheDocument();
  });
});

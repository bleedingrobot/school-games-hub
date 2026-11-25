import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkyScreen } from './SkyScreen';
import type { StarWebBackend } from './backend';

// ResizeObserver isn't in the test browser; the sky only needs to be told its size once.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const backend: StarWebBackend = {
  load: vi.fn(), open: vi.fn(), guideSeen: vi.fn(),
  save: vi.fn(async () => ({ stars: [] })),
  finish: vi.fn(),
};
const voice = { on: false, setOn: vi.fn(), available: false };

describe('Star Web sky', () => {
  it('guides the first star from the keyboard, says how we know, then helps slowly when stuck (never this sky’s answer)', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<SkyScreen sky={{ seed: 'aaaaaaaaaaaaaaaa', mode: 'map', anchor: { x: 3, y: 4, p: 12 }, stars: [], hints: 0 }} backend={backend} guided onGuideDone={done} onFinished={vi.fn()} onLeave={vi.fn()} say={vi.fn()} voice={voice} />);
    expect(screen.getByText(/Turn it around: type 4 × 3 = 12/)).toBeInTheDocument();
    for (const k of '4x3=12') fireEvent.keyDown(window, { key: k });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText(/New star!/)).toBeInTheDocument();
    expect(screen.getByText(/Turn it around: 4 × 3 is the same as 3 × 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Off you go!' }));
    expect(done).toHaveBeenCalled();

    for (const k of '3x5=16') fireEvent.keyDown(window, { key: k });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('Not quite. Check the answer. 3 × 5 is one more group of 3: 12 + 3.')).toBeInTheDocument();

    // Stuck: a nudge after 20 s, the numbers after 40 s, then Show me on a different fact.
    act(() => { vi.advanceTimersByTime(21_000); });
    expect(screen.getByText(/Try a division fact that undoes it\./)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(21_000); });
    expect(screen.getByText(/Start from 12 and share it into 3 or 4 equal groups/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(21_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByText('We know 2 × 5 = 10.')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

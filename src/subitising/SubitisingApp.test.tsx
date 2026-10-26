import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUBITISING_CONFIG as C } from '../../shared/subitising/config';
import { SubitisingApp } from './SubitisingApp';
import { emptySubState, type SubState } from './store';

function setup(initial: SubState) {
  let state = initial;
  const answered: unknown[] = [];
  const ui = (s: SubState) => <SubitisingApp state={s} onState={(n) => (state = n)} today="2026-10-21" onAnswered={(a) => answered.push(a)} />;
  const view = render(ui(state));
  const sync = () => view.rerender(ui(state));
  return { view, sync, state: () => state, answered };
}

/** The number of counters in the picture on screen (a frame's squares aren't counted). */
const dotsShown = () => document.querySelectorAll('.sb-stage svg circle:not(.sb-ghost)').length;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Quick looks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => window.setTimeout(() => fn(0), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('flashes a picture, hides it, keeps the buttons locked for a second, then takes the answer', () => {
    const t = setup({ ...emptySubState(), placed: true, startStage: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    // Get ready: the picture is not showing yet.
    expect(dotsShown()).toBe(0);
    advance(C.readyMs + 10);
    const n = dotsShown();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(3);
    // Still showing just before the flash ends, gone just after.
    advance(1100);
    expect(dotsShown()).toBe(n);
    advance(150);
    expect(dotsShown()).toBe(0);
    const buttons = screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''));
    expect(buttons.length).toBeGreaterThanOrEqual(C.choiceCount);
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    advance(C.answerLockMs);
    expect(buttons.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);

    fireEvent.click(buttons.find((b) => b.textContent === String(n))!);
    t.sync();
    expect(screen.getAllByText(new RegExp(`Yes! ${n}`)).length).toBeGreaterThan(0);
    expect(dotsShown()).toBe(n); // the picture comes back
    expect(t.state().answers).toHaveLength(1);
    expect(t.state().answers[0].correct).toBe(true);
    expect(t.answered).toHaveLength(1);
  });
});

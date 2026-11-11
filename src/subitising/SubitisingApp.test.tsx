import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUBITISING_CONFIG as C } from '../../shared/subitising/config';
import { SubitisingApp} from './SubitisingApp';
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

  it('shows the picture with help after two wrong answers in a row, and keeps it on screen', () => {
    const t = setup({ ...emptySubState(), placed: true, startStage: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    const answerWrong = () => {
      advance(C.readyMs + 10);
      const n = dotsShown();
      advance(1400);
      advance(C.answerLockMs);
      const wrong = screen.getAllByRole('button').find((b) => /^\d+$/.test(b.textContent ?? '') && b.textContent !== String(n))!;
      fireEvent.click(wrong);
      // The picture comes back once for a second try; a second wrong answer ends the picture.
      advance(C.peekMs + 10);
      const again = screen.getAllByRole('button').find((b) => /^\d+$/.test(b.textContent ?? '') && b.textContent !== String(n) && b !== wrong)!;
      fireEvent.click(again);
      t.sync();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    };
    answerWrong();
    answerWrong();
    // The third picture stays on screen, with its groups outlined, and the buttons need no wait.
    expect(screen.getByRole('heading', { name: /^Take your time\. / })).toBeTruthy();
    expect(dotsShown()).toBeGreaterThan(0);
    expect(screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? '')).every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    advance(5000);
    expect(dotsShown()).toBeGreaterThan(0);
  });

  it('shows how empty squares work the first time a child reaches them, saves nothing for it, and never shows it once a gap picture is saved', () => {
    const t = setup({ ...emptySubState(), placed: true, startStage: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    expect(screen.getByRole('heading', { name: /This is a new kind of picture/ })).toBeTruthy();
    advance(10_000);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === '2')!);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(t.answered).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: /new kind of picture/ })).toBeNull();
    t.view.unmount();
    setup({ ...emptySubState(), placed: true, startStage: 6, answers: [{ key: 'gaph:five-3', correct: true, at: 1, helped: true }] });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    expect(screen.queryByRole('heading', { name: /new kind of picture/ })).toBeNull();
  });

  it('remembers the stage reached once a stage is finished, and says when a session ends', () => {
    const types = ['line', 'clus', 'angl'] as const;
    const answers = Array.from({ length: 7 }, (_, i) => ({ key: `sub:${types[i % 3]}-2`, correct: true, at: i }));
    const ended: number[] = [];
    let state: SubState = { ...emptySubState(), placed: true, answers };
    const ui = (s: SubState) => <SubitisingApp state={s} onState={(n) => (state = n)} today="2026-10-21" onSessionEnd={() => ended.push(1)} />;
    const view = render(ui(state));
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    advance(C.readyMs + 10);
    const n = dotsShown();
    advance(1400);
    advance(C.answerLockMs);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === String(n))!);
    view.rerender(ui(state));
    expect(state.finished).toBe(1);
    // Leaving early still ends the session (so the page saves what was done).
    fireEvent.click(screen.getByRole('button', { name: 'Finish for now' }));
    expect(ended).toHaveLength(1);
  });

  it('gives one second try after a wrong first answer, and saves only the first tap', () => {
    const t = setup({ ...emptySubState(), placed: true, startStage: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    advance(C.readyMs + 10);
    const n = dotsShown();
    advance(1400);
    advance(C.answerLockMs);
    const nums = () => screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''));
    const wrong = nums().find((b) => b.textContent !== String(n))!;
    fireEvent.click(wrong);
    expect(dotsShown()).toBe(n); // the picture comes back
    advance(C.peekMs + 10);
    expect(screen.getByRole('heading', { name: 'Try once more.' })).toBeTruthy();
    expect((wrong as HTMLButtonElement).disabled).toBe(true); // the wrong one is greyed
    fireEvent.click(nums().find((b) => b.textContent === String(n))!);
    t.sync();
    expect(screen.getAllByText(new RegExp(`Yes! ${n}`)).length).toBeGreaterThan(0);
    expect(t.answered).toHaveLength(1);
    expect(t.state().answers).toHaveLength(1);
    expect(t.state().answers[0].correct).toBe(false); // the first tap
  });

});

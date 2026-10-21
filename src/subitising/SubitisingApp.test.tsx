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

  it('asks for the starting check first, and shows four plants', () => {
    setup(emptySubState());
    expect(screen.getByRole('button', { name: 'Start with a quick check' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start looking' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
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
      t.sync();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    };
    answerWrong();
    answerWrong();
    // The third picture stays on screen, with its groups outlined, and the buttons need no wait.
    expect(screen.getByText(/smaller groups/)).toBeTruthy();
    expect(dotsShown()).toBeGreaterThan(0);
    expect(screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? '')).every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    advance(5000);
    expect(dotsShown()).toBeGreaterThan(0);
  });

  it('never flashes when "keep the picture on the screen" is ticked', () => {
    setup({ ...emptySubState(), placed: true, guidedMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
    expect(dotsShown()).toBeGreaterThan(0);
    advance(10_000);
    expect(dotsShown()).toBeGreaterThan(0);
  });

  it('runs the starting check and then says where practice starts', () => {
    const t = setup(emptySubState());
    fireEvent.click(screen.getByRole('button', { name: 'Start with a quick check' }));
    for (let i = 0; i < C.placementTrials; i++) {
      advance(C.readyMs + 10);
      const n = dotsShown();
      const prompt = document.querySelector('.sb-prompt')!.textContent;
      const cells = document.querySelectorAll('.sb-stage svg g[stroke] rect').length;
      const answer = /empty/.test(prompt ?? '') ? cells - n : n;
      advance(1400);
      advance(C.answerLockMs);
      fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === String(answer))!);
      t.sync();
      fireEvent.click(screen.getByRole('button', { name: i === C.placementTrials - 1 ? 'Finish' : 'Next' }));
    }
    t.sync();
    expect(screen.getByText('All done!')).toBeTruthy();
    expect(t.state().placed).toBe(true);
    expect(t.state().startStage).toBe(4); // six right in a row climbs to the top
    expect(t.state().answers).toHaveLength(0); // the check isn't practice
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

  it('shows a way back to Training only when it is inside Training', () => {
    const { view } = setup(emptySubState());
    expect(screen.queryByRole('button', { name: 'Back to Training' })).toBeNull();
    let backed = 0;
    view.rerender(<SubitisingApp state={emptySubState()} onState={() => {}} today="2026-10-21" onBack={() => backed++} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Training' }));
    expect(backed).toBe(1);
  });

  describe('reading out loud', () => {
    const said: string[] = [];
    beforeEach(() => {
      said.length = 0;
      localStorage.clear();
      vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
      vi.stubGlobal('speechSynthesis', { cancel: () => {}, speak: (u: { text: string }) => void said.push(u.text) });
      Object.defineProperty(window, 'speechSynthesis', { value: (globalThis as { speechSynthesis: unknown }).speechSynthesis, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: (globalThis as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance, configurable: true });
    });
    afterEach(() => {
      Reflect.deleteProperty(window, 'speechSynthesis');
      Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
    });

    it('says nothing until it is switched on', () => {
      setup({ ...emptySubState(), placed: true });
      fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
      advance(C.readyMs + 10);
      advance(1400);
      advance(C.answerLockMs);
      expect(said).toEqual([]);
    });

    it('reads the prompts, never the answer before it has been given, and the feedback after', () => {
      const t = setup({ ...emptySubState(), placed: true });
      fireEvent.click(screen.getByLabelText('Read the words out loud to me'));
      fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
      advance(C.readyMs + 10);
      const n = dotsShown();
      advance(1400);
      advance(C.answerLockMs);
      expect(said).toEqual(['Get ready', 'How many did you see?']);
      expect(said.join(' ')).not.toMatch(/\d/);
      fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === String(n))!);
      t.sync();
      expect(said.at(-1)).toMatch(new RegExp(`^Yes! ${n}`));
    });

    it('can be muted from the practice screen, and the choice is remembered on the device', () => {
      setup({ ...emptySubState(), placed: true });
      fireEvent.click(screen.getByLabelText('Read the words out loud to me'));
      fireEvent.click(screen.getByRole('button', { name: 'Start looking' }));
      advance(C.readyMs + 10);
      advance(1400);
      const mute = screen.getByRole('button', { name: /Reading out loud: on/ });
      fireEvent.click(mute);
      expect(screen.getByRole('button', { name: /Reading out loud: off/ })).toBeTruthy();
      expect(localStorage.getItem('sgh-read-aloud')).toBe('false');
    });
  });
});

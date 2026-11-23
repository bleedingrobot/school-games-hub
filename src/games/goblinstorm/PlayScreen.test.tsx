/**
 * A level-up that asks a question shows the question first, then the cards its mark earns: 2 for wrong, 3 for right,
 * 4 for right and quick (docs/GOBLINSTORM-PLAN.md, the question modal), and then a Gold card every time. The server marks the answer; the screen only
 * shows what it was told. The canvas drawing is left out (jsdom has no canvas). (Screen test 1 of the game's 2.)
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHOICES, HEROES, MAPS, questionSlot } from '../../../shared/goblinstorm/config';
import type { RunState } from '../../../shared/goblinstorm/engine';
import { standInBackend, type GoblinStormBackend, type Mark } from './backend';
import { PlayScreen } from './PlayScreen';

vi.mock('./renderer', () => ({
  View: class {
    fx = { low: false, quality: 1 };
    low = false;
    reduced = true;
    cues = new Set<string>();
    gemPulse = 0;
    flash = 0;
    flashColour = '#fff';
    take() {}
    tick() {}
    draw() {}
    addShake() {}
  },
}));

let frames: FrameRequestCallback[] = [];
/** One animation frame, 50 ms after now (the loop measures from performance.now()). */
const runFrame = () => act(() => {
  const now = frames;
  frames = [];
  for (const f of now) f(performance.now() + 50);
});

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => undefined }) as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The stand-in server, but its marks are the test's. */
function marking(mark: Mark): GoblinStormBackend {
  const b = standInBackend(undefined, true);
  return { ...b, answer: async () => ({ mark, correct: mark !== 'wrong', answer: 0, fact: '' }) };
}

describe('Goblin Storm level-up', () => {
  it.each([['wrong', CHOICES.wrong], ['right', CHOICES.right], ['quick', CHOICES.quick]] as const)(
    'asks the question, then a %s answer gives %i cards',
    async (mark, cards) => {
      const backend = marking(mark);
      const start = await backend.start('knight', 0);
      render(<PlayScreen backend={backend} start={start} hero={HEROES[0]} map={MAPS[0]} onEnd={() => {}} />);
      // The third level-up asks a question (every third does): owe one at that point.
      const s = (window as unknown as { __goblinstorm: { g: { s: RunState } } }).__goblinstorm.g.s;
      s.levelUps = 2;
      expect(questionSlot(s.levelUps)).toBe(0);
      s.owed = 1;
      runFrame();

      const ask = await screen.findByRole('dialog', { name: /level up/i });
      expect(screen.queryByRole('dialog', { name: /pick/i })).toBeNull();
      await userEvent.click(within(within(ask).getByRole('group', { name: 'Choose an answer' })).getAllByRole('button')[0]);

      const offer = await screen.findByRole('dialog', { name: /pick/i }, { timeout: 4000 });
      expect(screen.queryByRole('dialog', { name: /level up/i })).toBeNull();
      const buttons = [...offer.querySelectorAll<HTMLElement>('[data-card]')];
      expect(buttons).toHaveLength(cards + 1);
      expect(buttons[cards].textContent).toContain('Gold');

      // A number key picks that card (after a short pause, so a held Enter from the question doesn't).
      if (mark === 'right') {
        await new Promise((r) => setTimeout(r, 450));
        // C opens the Weapon Codex over the cards; the cards' keys wait until it closes (C again).
        await userEvent.keyboard('c');
        expect(screen.getByRole('dialog', { name: 'Weapon Codex' })).toBeTruthy();
        await userEvent.keyboard('2');
        expect(screen.getByRole('dialog', { name: /pick/i })).toBeTruthy();
        await userEvent.keyboard('c');
        expect(screen.queryByRole('dialog', { name: 'Weapon Codex' })).toBeNull();
        await userEvent.keyboard('2');
        expect(screen.queryByRole('dialog', { name: /pick/i })).toBeNull();
      }
    },
  );
});

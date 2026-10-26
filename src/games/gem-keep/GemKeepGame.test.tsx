import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MATHS } from '../../../shared/gem-keep/config';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import type { GameEngine } from './engine/GameEngine';
import { DEFAULT_SETTINGS, type GemKeepSettings } from './settings';
import { GemKeepGame } from './ui/GemKeepGame';
import { FEEDBACK_MS } from '../../maths/QuestionModal';

// Skip the pause after each right/wrong message (QuestionModal.test covers it).
const SHOWN = { ...FEEDBACK_MS };
beforeAll(() => Object.assign(FEEDBACK_MS, { right: 0, wrong: 0 }));
afterAll(() => Object.assign(FEEDBACK_MS, SHOWN));

/** Works out the answer from the question's spoken form ("7 times 8 equals what?"). */
function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('divided by', '÷').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

function setup(settings: GemKeepSettings = DEFAULT_SETTINGS) {
  let engine!: GameEngine;
  const user = userEvent.setup({ delay: null });
  render(<GemKeepGame level={CAMPAIGN[0]} settings={settings} timeScale={0} onEngine={(e) => (engine = e)} />);
  /** Answers the question on screen, right or wrong, and waits for the next one (or the end). */
  async function answer(right: boolean) {
    const dialog = await screen.findByRole('dialog', { name: /Mana Well|Gem Forge|Wave Gate|Keep Shield|Level Key/ });
    const fact = within(dialog).getByLabelText(/equals/);
    const label = fact.getAttribute('aria-label')!;
    const value = solve(label) + (right ? 0 : 1);
    await user.keyboard(`${value}{Enter}`);
    await waitFor(() => {
      const still = screen.queryByLabelText(/equals/);
      expect(!still || still.closest('.question')?.getAttribute('data-result') === null).toBe(true);
    });
  }
  return { user, answer, engine: () => engine };
}

describe('Gem Keep maths', () => {
  it('the Mana Well gives mana for right answers only, and can be left early', async () => {
    const { user, answer, engine } = setup();
    const start = engine().state.mana;
    await user.click(screen.getByRole('button', { name: /Mana Well: 10 questions left/ }));
    expect(engine().question).toBe('calm'); // the game is paused while it's open
    await answer(true);
    await answer(true);
    await answer(false);
    expect(engine().state.mana).toBe(start + 2 * MATHS.well.mana);
    await user.click(screen.getByRole('button', { name: 'Back to the game' }));
    expect(screen.queryByRole('dialog', { name: 'Mana Well' })).not.toBeInTheDocument();
    expect(engine().question).toBeNull();
    expect(screen.getByRole('button', { name: /Mana Well: 7 questions left/ })).toBeInTheDocument();
  });

});

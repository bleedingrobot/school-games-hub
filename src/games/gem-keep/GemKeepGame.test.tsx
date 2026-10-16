import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GEM, MATHS } from '../../../shared/gem-keep/config';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import type { GameEngine } from './engine/GameEngine';
import { DEFAULT_SETTINGS, type GemKeepSettings } from './settings';
import { GemKeepGame } from './ui/GemKeepGame';

/** Works out the answer from the question's spoken form ("7 times 8 equals what?"). */
function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('divided by', '÷').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

function setup(settings: GemKeepSettings = DEFAULT_SETTINGS) {
  let engine!: GameEngine;
  const user = userEvent.setup();
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

  it('the Mana Well asks all 10 questions in one go, then rests', async () => {
    const { user, answer } = setup();
    await user.click(screen.getByRole('button', { name: /Mana Well: 10/ }));
    for (let i = 0; i < 10; i++) await answer(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mana Well' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Mana Well: 0 questions left/ })).toBeDisabled();
  });

  it('the Gem Forge: a wrong answer spends nothing, a right one makes the gem', async () => {
    const { user, answer, engine } = setup();
    const start = engine().state.mana;
    await user.click(screen.getByRole('button', { name: /Red/ }));
    await answer(false);
    expect(engine().state.mana).toBe(start);
    expect(engine().state.inventory.every((g) => g === null)).toBe(true);
    expect(screen.getByText(/nothing was spent/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Red/ }));
    await answer(true);
    expect(engine().state.mana).toBe(start - GEM.createCost);
    expect(engine().state.inventory[0]?.colours).toEqual(['red']);
  });

  it('combining asks a question too', async () => {
    const { user, answer, engine } = setup();
    engine().state.mana = 500;
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: /Green/ }));
      await answer(true);
    }
    await user.click(screen.getAllByRole('button', { name: /Grade 1 green gem/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Combine' }));
    await user.click(screen.getAllByRole('button', { name: /Grade 1 green gem/ })[1]);
    await answer(true);
    expect(engine().state.inventory.filter(Boolean)).toEqual([expect.objectContaining({ grade: 2, colours: ['green'] })]);
  });

  it('Challenge mode keeps the game going (slowly) during questions', async () => {
    const { user, engine } = setup({ ...DEFAULT_SETTINGS, mode: 'challenge' });
    await user.click(screen.getByRole('button', { name: /Mana Well/ }));
    expect(engine().question).toBe('challenge');
  });

  it('the Wave Gate before a boss: 3 right gives a Power Surge', async () => {
    const { user, answer, engine } = setup();
    engine().state.wave = 4; // the boss is wave 5
    engine().setPaused(false);
    await user.click(await screen.findByRole('button', { name: /Start wave 5 \(boss!\)/ }));
    for (let i = 0; i < 3; i++) await answer(true);
    await waitFor(() => expect(engine().state.phase).toBe('wave'));
    expect(engine().state.surge).toBe(0.25);
    expect(screen.getByText(/Power Surge/)).toBeInTheDocument();
  });

  it('the Keep Shield: offered when the Keep is low, each right answer heals', async () => {
    const { answer, engine } = setup();
    const s = engine().state;
    s.phase = 'wave';
    s.keep = 20;
    s.shield = 'offered';
    engine().setPaused(true);
    engine().setPaused(false);
    await screen.findByRole('dialog', { name: 'Keep Shield' });
    for (let i = 0; i < 4; i++) await answer(true);
    await answer(false);
    await waitFor(() => expect(engine().state.shield).toBe('used'));
    expect(engine().state.keep).toBe(20 + 4 * MATHS.shield.heal * 100);
    expect(screen.getByText(/healed 20 health/)).toBeInTheDocument();
  });

  it('the Level Key: 8 of 10 unlocks the next level; a fail shows the missed facts and can be tried again', async () => {
    const { user, answer, engine } = setup();
    engine().state.phase = 'won';
    engine().state.stars = 3;
    engine().setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    for (let i = 0; i < 10; i++) await answer(i >= 3); // 7 right
    const failed = await screen.findByText(/7 out of 10. You need 8/);
    expect(failed).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Try the Level Key again' }));
    for (let i = 0; i < 10; i++) await answer(i !== 0); // 9 right
    expect(await screen.findByText(/9 out of 10. The next level is unlocked!/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Level Key/ })).not.toBeInTheDocument();
  });
});

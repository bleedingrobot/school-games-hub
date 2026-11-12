import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Question } from '../../../shared/maths/skillPack';
import type { GameEngine } from './engine/GameEngine';
import { loadProgress } from './progress';
import { GemKeepCampaign } from './ui/GemKeepCampaign';
import { FEEDBACK_MS } from '../../maths/QuestionModal';

// Each Level Key is 10 questions, and the right/wrong message stays up for most of a second after each one. These tests
// are about which questions are asked and what is reported, not that pause (QuestionModal.test covers it), so skip it.
const SHOWN = { ...FEEDBACK_MS };
beforeAll(() => Object.assign(FEEDBACK_MS, { right: 0, wrong: 0 }));
afterAll(() => Object.assign(FEEDBACK_MS, SHOWN));

/** The latest question the game's pack made, so a test can answer ones whose spoken text it can't read (rounding, order of operations). */
const latest: { question: Question | null } = { question: null };
vi.mock('../../../shared/maths/focus', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../shared/maths/focus')>();
  return {
    ...real,
    makeFocusPack: (...args: Parameters<typeof real.makeFocusPack>) => {
      const pack = real.makeFocusPack(...args);
      const next = pack.nextQuestion.bind(pack);
      pack.nextQuestion = (ctx) => {
        const q = next(ctx);
        if (q) latest.question = q;
        return q;
      };
      return pack;
    },
  };
});

function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

describe('campaign map', () => {
  it('win, pass the Level Key, go on to level 2, and the map remembers', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    render(<GemKeepCampaign onEngine={(e) => (engine = e)} />);
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    expect(screen.getByRole('heading', { name: 'Level 1 · Crystal Valley' })).toBeInTheDocument();
    engine.state.phase = 'won';
    engine.state.stars = 3;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    for (let i = 0; i < 10; i++) {
      const fact = await screen.findByLabelText(/equals/);
      await user.keyboard(`${solve(fact.getAttribute('aria-label')!)}{Enter}`);
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 3000 });
    }
    await user.click(await screen.findByRole('button', { name: 'Next level' }, { timeout: 4000 }));
    expect(screen.getByRole('heading', { name: 'Level 2 · Sunny Meadow' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(screen.getByRole('button', { name: /Level 1: Crystal Valley\. 3 stars/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Level 2: Sunny Meadow/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Level 3: River Bend/ })).toBeDisabled();
    expect(loadProgress()).toEqual({ 'level-1': { stars: 3, keyPassed: true } });
  }, 30_000);
});


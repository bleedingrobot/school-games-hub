import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import type { GameEngine } from './engine/GameEngine';
import { isUnlocked, loadProgress, totalStars, withKey, withWin } from './progress';
import { GemKeepCampaign, type FinishedLevel } from './ui/GemKeepCampaign';

const IDS = CAMPAIGN.map((l) => l.id);

function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

describe('campaign progress', () => {
  it('keeps the best stars, and a passed Level Key opens the next level', () => {
    let p = withWin({}, 'level-1', 2);
    p = withWin(p, 'level-1', 1);
    expect(p['level-1']).toEqual({ stars: 2, keyPassed: false });
    expect(isUnlocked(p, IDS, 0)).toBe(true);
    expect(isUnlocked(p, IDS, 1)).toBe(false);
    p = withKey(p, 'level-1');
    expect(isUnlocked(p, IDS, 1)).toBe(true);
    expect(isUnlocked(p, IDS, 2)).toBe(false);
    expect(totalStars(withWin(p, 'level-2', 3))).toBe(5);
  });

  it('copes with nothing saved, or junk', () => {
    expect(loadProgress()).toEqual({});
    localStorage.setItem('sgh-gem-keep-progress', '{oops');
    expect(loadProgress()).toEqual({});
  });
});

describe('campaign map', () => {
  it('shows 10 levels; only level 1 is open at first', () => {
    render(<GemKeepCampaign />);
    const stops = within(screen.getByRole('list')).getAllByRole('button');
    expect(stops).toHaveLength(10);
    expect(stops[0]).toBeEnabled();
    expect(stops[0]).toHaveAccessibleName(/Level 1: Crystal Valley\. 0 stars\. Times tables: 2, 5, 10/);
    expect(stops[1]).toBeDisabled();
    expect(stops[1]).toHaveAccessibleName(/Pass level 1's Level Key to open this/);
    expect(screen.getByText(/0 of 30 stars/)).toBeInTheDocument();
  });

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

  it('reports each level, Level Key and the maths records, for saving', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const ended: FinishedLevel[] = [];
    const onKey = vi.fn();
    const onFacts = vi.fn();
    const onProgress = vi.fn();
    render(
      <GemKeepCampaign
        initialProgress={{}}
        initialFacts={[{ key: 'mul:2x5', attempts: 9, correct: 9, avgMs: 1500, box: 3, lastSeen: 1, quickDays: [] }]}
        onEngine={(e) => (engine = e)}
        onLevelEnd={(l) => ended.push(l)}
        onKey={onKey}
        onFacts={onFacts}
        onProgress={onProgress}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    engine.state.phase = 'won';
    engine.state.stars = 2;
    engine.state.wave = CAMPAIGN[0].waves.length;
    engine.state.time = 321.4;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    expect(ended).toEqual([
      { levelId: 'level-1', result: 'won', stars: 2, waves: CAMPAIGN[0].waves.length, gameSeconds: 321, asked: 0, right: 0 },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith({ 'level-1': { stars: 2, keyPassed: false } });
    for (let i = 0; i < 10; i++) {
      const fact = await screen.findByLabelText(/equals/);
      await user.keyboard(`${solve(fact.getAttribute('aria-label')!)}{Enter}`);
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 3000 });
    }
    await screen.findByRole('button', { name: 'Next level' }, { timeout: 4000 });
    expect(onKey).toHaveBeenCalledWith('level-1', 10);
    // The saved records carried on: the 10 new answers were added to them.
    const facts = onFacts.mock.lastCall![0] as { attempts: number }[];
    expect(facts.reduce((n, f) => n + f.attempts, 0)).toBe(19);
    // Nothing goes to this browser's own storage when the progress is saved elsewhere.
    expect(localStorage.getItem('sgh-gem-keep-progress')).toBeNull();
  }, 30_000);
});

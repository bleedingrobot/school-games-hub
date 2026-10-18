import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rules } from '../data/progress';

const rules = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../data/progress', async (original) => ({
  ...(await original<typeof import('../data/progress')>()),
  fetchRules: vi.fn(async () => rules.value),
}));

import { HowPoints } from './HowPoints';

const base: Rules = {
  bot: { 'very-easy': { lost: 1, drawn: 2, won: 3 }, easy: { lost: 2, drawn: 3, won: 5 }, medium: { lost: 3, drawn: 5, won: 8 } },
  friend: { lost: 4, drawn: 6, won: 8 },
  botDailyCap: 40, pairDailyLimit: 5, achievementPoints: 10, levels: [0, 50, 125], ratingK: 20,
  weeklyMinGames: 3, allTimeMinGames: 5, improvedMinGames: 3, championMinGames: 15,
};
const clanQuest = {
  fame: { mineWin: 1, bossWin: 5, warWin: 2, kingdomRaidWin: 2, classRaidWin: 3, villageBuilt: 10 },
  points: { minesPerPoint: 3, boss: 3, war: 2, villageBuilt: 5 },
};

beforeEach(() => {
  rules.value = base;
});

describe('how Clan Quest points work', () => {
  it('says what earns points and what only earns fame, from the numbers the database gives', async () => {
    rules.value = { ...base, clanQuest };
    render(<HowPoints />);
    const heading = await screen.findByRole('heading', { name: /Clan Quest/ });
    const section = heading.closest('section')!;
    expect(section).toHaveTextContent('1 point for every 3 you win');
    expect(section).toHaveTextContent('Beat a boss: 3 points');
    expect(section).toHaveTextContent('Win a Friendly War: 2 points');
    expect(section).toHaveTextContent('everyone who voted that week gets 5 points');
    expect(section).toHaveTextContent('Raids and maths questions don’t earn points');
    expect(section).toHaveTextContent('40-points-a-day limit');
    expect(section).toHaveTextContent('Fame never comes from maths scores');
  });

  it('says nothing about Clan Quest while it is switched off', async () => {
    rules.value = { ...base, clanQuest: null };
    render(<HowPoints />);
    await screen.findByRole('heading', { name: 'How points work' });
    expect(screen.queryByRole('heading', { name: /Clan Quest/ })).toBeNull();
  });
});

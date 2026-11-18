import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Achievement } from '../data/progress';
import { AchievementHall } from './AchievementHall';
import { earnedWords, nextUp, progressWords, shelvesOf } from './hall';

const a = (id: string, game: string, extra: Partial<Achievement> = {}): Achievement => ({
  id, game, name: id, emoji: '⭐', how: `Do ${id}.`, tier: 1, measure: 'wins', goal: 10, progress: 0, earnedAt: null, ...extra,
});

const ALL = [
  a('chess-first', 'chess', { goal: 1, progress: 1, earnedAt: '2026-11-11T22:30:00Z' }),
  a('chess-ten', 'chess', { progress: 7, tier: 2 }),
  a('space-first', 'space'),
  a('marble-first', 'marble', { progress: 2 }),
  a('quests-one', 'quests', { goal: 1 }),
  a('chess-silver', 'chess', { measure: 'rank', goal: 2, progress: 1, tier: 3 }),
];

vi.mock('../data/homePage', () => ({
  fetchMyHomePage: vi.fn(async () => ({ progress: { achievements: ALL }, topGames: { mine: ['space'], classGames: [] } })),
}));
vi.mock('../data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/progress')>()),
  fetchRules: vi.fn(async () => ({ achievementPoints: 10 })),
}));
vi.mock('../games/sounds', () => ({ playSound: vi.fn() }));

beforeEach(() => localStorage.clear());

it('orders shelves by most played, then started, then untouched, and picks the closest three as Next up', () => {
  expect(shelvesOf(ALL, ['space']).map((s) => s.id)).toEqual(['space', 'chess', 'marble', 'quests']);
  const chess = shelvesOf(ALL, [])[0];
  expect([chess.id, chess.earned, chess.achievements.length, chess.playTo]).toEqual(['chess', 1, 3, '/chess']);
  expect(shelvesOf(ALL, []).find((s) => s.id === 'quests')).toMatchObject({ playTo: '/', playLabel: 'See this week’s quest' });
  expect(nextUp(ALL).map((x) => x.id)).toEqual(['chess-ten', 'chess-silver', 'marble-first']);
});

it('says progress and the earned day in plain words, in New Zealand time', () => {
  expect(progressWords(ALL[1])).toBe('7 of 10');
  expect(progressWords(ALL[5])).toBe('Not yet');
  expect(progressWords(ALL[0])).toBe('Earned');
  // 22:30 on the 11th in UTC is Thursday the 12th in Auckland.
  expect(earnedWords('2026-11-11T22:30:00Z', new Date('2026-11-19T00:00:00Z'))).toBe('Earned on Thursday 12 November');
  expect(earnedWords('2025-03-04T00:00:00Z', new Date('2026-11-19T00:00:00Z'))).toBe('Earned on Tuesday 4 March 2025');
});

it('filters the shelves, remembers the filter, and opens a badge card with how to earn it and a Play button', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <AchievementHall />
    </MemoryRouter>,
  );
  expect(await screen.findByText('of 6')).toBeTruthy();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain('Wormholes & Black Holes');

  await user.click(screen.getByRole('button', { name: /Nearly there/ }));
  expect(JSON.parse(localStorage.getItem('achievement-hall')!)).toEqual({ filter: 'nearly', game: '' });
  expect(screen.queryByRole('heading', { name: 'Wormholes & Black Holes' })).toBeNull();

  const chess = screen.getByRole('region', { name: 'Chess' });
  await user.click(within(chess).getByRole('button', { name: /chess-ten/ }));
  const card = screen.getByRole('dialog');
  expect(within(card).getByText('Do chess-ten.')).toBeTruthy();
  expect(within(card).getByText('7 of 10')).toBeTruthy();
  expect(within(card).getByText('+10 points')).toBeTruthy();
  expect(within(card).getByRole('link', { name: /Play Chess/ }).getAttribute('href')).toBe('/chess');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

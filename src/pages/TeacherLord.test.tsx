import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  fetchLordSettings: vi.fn(),
  saveLordSettings: vi.fn(),
  fetchClassLord: vi.fn(),
  fetchStudentLord: vi.fn(),
  resetLordHero: vi.fn(async () => {}),
}));
vi.mock('../data/lord', async (original) => ({ ...(await original<typeof import('../data/lord')>()), ...data }));

import { LordStudentPanel } from './TeacherLord';


const ALL = ['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals', 'money', 'patterns'];
const settings = (over = {}) => ({ enabled: false, forestPerDay: 10, seasonStart: null, pausedSince: null, topics: ALL, ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchLordSettings.mockResolvedValue(settings());
  data.saveLordSettings.mockImplementation(async (s: object) => settings(s));
  data.fetchClassLord.mockResolvedValue({
    season: { number: 2, start: '2026-11-23', daysLeft: 20 },
    players: 5,
    thisSeason: 4,
    levels: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', students: 3, attempts: 12, correct: 4 }],
    refusals: [{ name: 'Lucky Tui 21', realName: 'ana', reason: 'tampered', action: 'fight-finish', at: new Date().toISOString() }],
    hall: [{ season: 1, name: 'Brave Kiwi', realName: 'ben', kills: 2 }],
  });
  data.fetchStudentLord.mockResolvedValue({
    hero: { level: 5, heroClass: 'mage', exp: 900, stars: 1, season: 2, savedAt: new Date().toISOString(), stats: { forestWins: 20, masterWins: 4, arenaWins: 3, riddles: 15, dragons: 1, bestLevel: 7 }, hall: 1 },
    topics: [{ pack: 'times-tables', facts: 20, attempts: 30, correct: 24, fluent: 8 }, { pack: 'money', facts: 5, attempts: 9, correct: 6, fluent: 1 }],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', attempts: 5, correct: 1 }],
    refused: 2,
  });
});

describe('one pupil’s Dragon Maths', () => {
  it('shows their hero, their topics and their hardest questions', async () => {
    render(<LordStudentPanel student="kid-1" />);
    expect(await screen.findByText(/level 5 mage, season 2, 1 dragon star/)).toBeInTheDocument();
    expect(screen.getByText(/20 forest wins, 4 masters, 3 arena wins, 15 right answers, 1 dragons/)).toBeInTheDocument();
    expect(screen.getByText(/2 requests turned down this week/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: /How they are getting on/ })).getByText('Gold and shopping')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: /Their hardest questions/ })).getByText('7 × 8')).toBeInTheDocument();
  });
});

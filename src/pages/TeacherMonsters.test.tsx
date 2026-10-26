import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_TOPICS } from '../data/monsters';

const data = vi.hoisted(() => ({
  fetchMonstersSettings: vi.fn(),
  saveMonstersSettings: vi.fn(async () => {}),
  fetchClassMonsters: vi.fn(),
  fetchStudentMonsters: vi.fn(),
}));
vi.mock('../data/monsters', async (original) => ({ ...(await original<typeof import('../data/monsters')>()), ...data }));

import { MonstersStudentPanel } from './TeacherMonsters';

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchMonstersSettings.mockResolvedValue({ enabled: false, topics: ALL_TOPICS });
  data.fetchClassMonsters.mockResolvedValue({
    players: 3,
    badges: [3, 1, 0, 0, 0, 0],
    topics: ALL_TOPICS.map((pack, i) => ({ pack, students: 3, attempts: 40 + i, correct: 30 })),
    hardest: [
      { pack: 'add-sub', key: 'add:7+8', students: 3, attempts: 9, correct: 3 },
      { pack: 'fractions', key: 'frac:half', students: 2, attempts: 7, correct: 2 },
    ],
    refusals: [{ name: 'Lucky Tui 21', realName: 'ana', reason: 'badge', at: new Date().toISOString() }],
  });
});

describe('the Maths Monsters teacher page', () => {
  it('says what a student has, and what they are working on', async () => {
    data.fetchStudentMonsters.mockResolvedValue({
      save: { owned: 12, seen: 20, badges: 2, catches: 5, savedAt: new Date().toISOString(), map: 'kauri-bush', team: [{ species: 'plusplash-1', level: 9 }], badgeList: ['leaf', 'water'] },
      topics: [{ pack: 'add-sub', facts: 20, attempts: 50, correct: 40, fluent: 3 }],
      refused: 1,
    });
    render(<MonstersStudentPanel student="s1" />);
    expect(await screen.findByText(/12 of 54 monsters, 2 of 6 badges/)).toBeInTheDocument();
    expect(screen.getByText(/Plusplash \(level 9\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 save turned down this week/)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Adding and taking away 80% 50 3 of 20/ })).toBeInTheDocument();
    data.fetchStudentMonsters.mockResolvedValue({ save: null, topics: [], refused: 0 });
    render(<MonstersStudentPanel student="s2" />);
    await waitFor(() => expect(screen.getByText('Maths Monsters: not played yet.')).toBeInTheDocument());
  });
});

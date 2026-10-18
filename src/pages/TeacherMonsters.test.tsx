import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_TOPICS } from '../data/monsters';

const data = vi.hoisted(() => ({
  fetchMonstersSettings: vi.fn(),
  saveMonstersSettings: vi.fn(async () => {}),
  fetchClassMonsters: vi.fn(),
  fetchStudentMonsters: vi.fn(),
}));
vi.mock('../data/monsters', async (original) => ({ ...(await original<typeof import('../data/monsters')>()), ...data }));

import { keyLabel, MonstersStudentPanel, MonstersTeacherPanels } from './TeacherMonsters';

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

describe('the Maths Monsters teacher switches', () => {
  it('turns the game on, and each topic on or off, one change at a time', async () => {
    const user = userEvent.setup();
    render(<MonstersTeacherPanels />);
    expect(await screen.findByText('Off: students can’t see it yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Maths Monsters on' }));
    expect(data.saveMonstersSettings).toHaveBeenLastCalledWith({ enabled: true, topics: ALL_TOPICS }, null);
    expect(await screen.findByText('On: students can play it from the dashboard.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Fractions' }));
    expect(data.saveMonstersSettings).toHaveBeenLastCalledWith({ enabled: true, topics: ALL_TOPICS.filter((t) => t !== 'fractions') }, null);
    await user.click(screen.getByRole('checkbox', { name: 'Fractions' }));
    expect(data.saveMonstersSettings).toHaveBeenLastCalledWith({ enabled: true, topics: ALL_TOPICS }, null);
    await user.click(screen.getByRole('button', { name: 'Switch Maths Monsters off' }));
    expect(data.saveMonstersSettings).toHaveBeenLastCalledWith({ enabled: false, topics: ALL_TOPICS }, null);
  });

  it('never lets the last topic go off', async () => {
    data.fetchMonstersSettings.mockResolvedValue({ enabled: true, topics: ['decimals'] });
    render(<MonstersTeacherPanels />);
    expect(await screen.findByRole('checkbox', { name: 'Decimals and money' })).toBeDisabled();
  });

  it('puts the setting back and says so when saving fails', async () => {
    data.saveMonstersSettings.mockRejectedValueOnce(new Error('no'));
    render(<MonstersTeacherPanels />);
    await userEvent.click(await screen.findByRole('button', { name: 'Switch Maths Monsters on' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Off: students can’t see it yet.')).toBeInTheDocument();
  });

  it('shows the class: each topic, the hardest questions in words, badges and refused saves', async () => {
    render(<MonstersTeacherPanels />);
    const hardest = await screen.findByRole('table', { name: /Hardest questions/ });
    expect(within(hardest).getByRole('rowheader', { name: '7 + 8' })).toBeInTheDocument();
    expect(within(hardest).getByText('33%')).toBeInTheDocument();
    expect(within(await screen.findByRole('table', { name: 'Each topic' })).getAllByRole('row')).toHaveLength(7);
    expect(within(screen.getByRole('table', { name: 'Topic Tower badges' })).getByRole('rowheader', { name: '1 badge' }).nextSibling).toHaveTextContent('3');
    const refused = screen.getByRole('table', { name: /Saves the game turned down/ });
    expect(within(refused).getByRole('rowheader', { name: 'ana' })).toBeInTheDocument();
    expect(within(refused).getByText('a badge without a won Tower battle')).toBeInTheDocument();
  });

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

describe('question names for teachers', () => {
  it('writes facts as sums and other questions as the kind of question', () => {
    expect(keyLabel('times-tables', 'mul:7x8')).toBe('7 × 8');
    expect(keyLabel('add-sub', 'add:7+8')).toBe('7 + 8');
    expect(keyLabel('division', 'div:by10')).toMatch(/10/);
    expect(keyLabel('add-sub', 'nonsense')).toBe('nonsense');
  });
});

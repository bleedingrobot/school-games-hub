import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_TOPICS } from '../data/monsters';
import { monsters } from '../games/monsters';
import { GameSwitchSetting } from '../teacher/Games';

// Maths Monsters on the teacher's Games table (these checks were the old panels'): the switch in its row, and the topics and
// class report in its Settings, all for a named class.
const data = vi.hoisted(() => ({
  fetchMonstersSettings: vi.fn(),
  fetchMonstersEnabled: vi.fn(),
  saveMonstersEnabled: vi.fn(async () => {}),
  saveMonstersTopics: vi.fn(async () => {}),
  fetchClassMonsters: vi.fn(),
  fetchStudentMonsters: vi.fn(),
}));
vi.mock('../data/monsters', async (original) => ({ ...(await original<typeof import('../data/monsters')>()), ...data }));

import { keyLabel, MonstersStudentPanel, MonstersTeacherSettings, monstersStudentSummary } from './TeacherMonsters';

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.fetchMonstersSettings.mockResolvedValue({ enabled: false, topics: ALL_TOPICS });
  data.fetchMonstersEnabled.mockResolvedValue(false);
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

const loadedSwitch = async () => {
  const on = await screen.findByRole('switch', { name: 'Maths Monsters' });
  await waitFor(() => expect(on).toBeEnabled());
  return on;
};

describe('the Maths Monsters switch on the Games table', () => {
  it('turns the game on and off for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={monsters} classId="c12" />);
    const on = await loadedSwitch();
    expect(data.fetchMonstersEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(data.saveMonstersEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    await user.click(on);
    expect(data.saveMonstersEnabled).toHaveBeenLastCalledWith(false, 'c12');
  });

  it('puts the setting back and says so when saving fails', async () => {
    data.saveMonstersEnabled.mockRejectedValueOnce(new Error('no'));
    render(<GameSwitchSetting game={monsters} classId="c12" />);
    const on = await loadedSwitch();
    await userEvent.click(on);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(on).toHaveAttribute('aria-checked', 'false');
  });

  it('is never a red button', async () => {
    const { container } = render(<GameSwitchSetting game={monsters} classId="c12" />);
    await loadedSwitch();
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('Maths Monsters’ Settings', () => {
  it('turns each topic on or off for the class, one change at a time', async () => {
    const user = userEvent.setup();
    render(<MonstersTeacherSettings classId="c14" />);
    const fractions = await screen.findByRole('checkbox', { name: 'Fractions' });
    await waitFor(() => expect(fractions).toBeEnabled());
    expect(data.fetchMonstersSettings).toHaveBeenCalledWith('c14');
    await user.click(fractions);
    expect(data.saveMonstersTopics).toHaveBeenLastCalledWith(ALL_TOPICS.filter((t) => t !== 'fractions'), 'c14');
    await user.click(fractions);
    expect(data.saveMonstersTopics).toHaveBeenLastCalledWith(ALL_TOPICS, 'c14');
  });

  it('never lets the last topic go off', async () => {
    data.fetchMonstersSettings.mockResolvedValue({ enabled: true, topics: ['decimals'] });
    const user = userEvent.setup();
    render(<MonstersTeacherSettings classId="c12" />);
    const last = await screen.findByRole('checkbox', { name: 'Decimals and money' });
    await waitFor(() => expect(last).toBeChecked());
    await user.click(last);
    expect(await screen.findByText('Leave at least one ticked.')).toBeInTheDocument();
    expect(last).toBeChecked();
    expect(data.saveMonstersTopics).not.toHaveBeenCalled();
  });

  it('says the topics only matter once the game is on, and not while it is on', async () => {
    const { unmount } = render(<MonstersTeacherSettings classId="c12" />);
    expect(await screen.findByText(/off for this class/)).toBeInTheDocument();
    unmount();
    data.fetchMonstersSettings.mockResolvedValue({ enabled: true, topics: ALL_TOPICS });
    render(<MonstersTeacherSettings classId="c12" />);
    await screen.findByRole('checkbox', { name: 'Fractions' });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Fractions' })).toBeEnabled());
    expect(screen.queryByText(/off for this class/)).not.toBeInTheDocument();
  });

  it('shows the class: each topic, the hardest questions in words, badges and refused saves', async () => {
    render(<MonstersTeacherSettings classId="c12" />);
    expect(await screen.findByRole('region', { name: /^Maths Monsters: this class/ })).toBeInTheDocument();
    expect(data.fetchClassMonsters).toHaveBeenCalledWith('c12');
    const hardest = await screen.findByRole('table', { name: /Hardest questions/ });
    expect(within(hardest).getByRole('rowheader', { name: '7 + 8' })).toBeInTheDocument();
    expect(within(hardest).getByText('33%')).toBeInTheDocument();
    expect(within(await screen.findByRole('table', { name: 'Each topic' })).getAllByRole('row')).toHaveLength(7);
    expect(within(screen.getByRole('table', { name: 'Topic Tower badges' })).getByRole('rowheader', { name: '1 badge' }).nextSibling).toHaveTextContent('3');
    const refused = screen.getByRole('table', { name: /Saves the game turned down/ });
    expect(within(refused).getByRole('rowheader', { name: 'ana' })).toBeInTheDocument();
    expect(within(refused).getByText('a badge without a won Tower battle')).toBeInTheDocument();
  });

  it('has no red buttons', async () => {
    const { container } = render(<MonstersTeacherSettings classId="c12" />);
    await screen.findByRole('table', { name: /Hardest questions/ });
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('a student’s Maths Monsters', () => {
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

  it('sums a student up in one line, or says nothing before they have played', async () => {
    data.fetchStudentMonsters.mockResolvedValue({
      save: { owned: 12, seen: 20, badges: 2, catches: 5, savedAt: new Date().toISOString(), map: 'kauri-bush', team: [], badgeList: [] },
      topics: [],
      refused: 1,
    });
    expect(await monstersStudentSummary('s1')).toBe('12 of 54 monsters, 2 of 6 badges, 1 save turned down');
    data.fetchStudentMonsters.mockResolvedValue({ save: null, topics: [], refused: 0 });
    expect(await monstersStudentSummary('s2')).toBeNull();
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

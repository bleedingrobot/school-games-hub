import { render, screen, waitFor} from '@testing-library/react';
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
});

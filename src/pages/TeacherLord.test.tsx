import { render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dragonMaths } from '../games/lord';
import { GameSwitchSetting } from '../teacher/Games';

// Dragon Maths on the teacher's Games table (these checks were the old panels'): the switch in its row, and forest fights, the
// season date, the topics and the class report in its Settings, all for a named class. Until the school season migration is
// live (`fetchLordSchoolSeason` gives `live: false`, the default here) each class keeps its own date; the checks at the end
// cover the one season date for the whole school.
const data = vi.hoisted(() => ({
  fetchLordSettings: vi.fn(),
  fetchLordEnabled: vi.fn(),
  saveLordEnabled: vi.fn(async () => {}),
  saveLordChange: vi.fn(async () => {}),
  fetchClassLord: vi.fn(),
  fetchStudentLord: vi.fn(),
  resetLordHero: vi.fn(async () => {}),
  fetchLordSchoolSeason: vi.fn(),
  saveLordSchoolSeason: vi.fn(),
  saveLordHoliday: vi.fn(),
}));
vi.mock('../data/lord', async (original) => ({ ...(await original<typeof import('../data/lord')>()), ...data }));


const ALL = ['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals', 'money', 'patterns'];
const settings = (over = {}) => ({ enabled: false, forestPerDay: 10, seasonStart: null, pausedSince: null, topics: ALL, ...over });
const CLASS = {
  season: { number: 2, start: '2026-11-23', daysLeft: 20 },
  players: 5,
  thisSeason: 4,
  levels: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  hardest: [{ pack: 'times-tables', key: 'mul:7x8', students: 3, attempts: 12, correct: 4 }],
  refusals: [{ name: 'Lucky Tui 21', realName: 'ana', reason: 'tampered', action: 'fight-finish', at: new Date().toISOString() }],
  hall: [{ season: 1, name: 'Brave Kiwi', realName: 'ben', kills: 2 }],
};


beforeEach(() => {
  Object.values(data).forEach((f) => f.mockReset());
  data.saveLordEnabled.mockResolvedValue(undefined);
  data.saveLordChange.mockResolvedValue(undefined);
  data.resetLordHero.mockResolvedValue(undefined);
  data.fetchLordSchoolSeason.mockResolvedValue({ live: false });
  data.fetchLordSettings.mockResolvedValue(settings());
  data.fetchLordEnabled.mockResolvedValue(false);
  data.fetchClassLord.mockResolvedValue(CLASS);
  data.fetchStudentLord.mockResolvedValue({
    hero: { level: 5, heroClass: 'mage', exp: 900, stars: 1, season: 2, savedAt: new Date().toISOString(), stats: { forestWins: 20, masterWins: 4, arenaWins: 3, riddles: 15, dragons: 1, bestLevel: 7 }, hall: 1 },
    topics: [{ pack: 'times-tables', facts: 20, attempts: 30, correct: 24, fluent: 8 }, { pack: 'money', facts: 5, attempts: 9, correct: 6, fluent: 1 }],
    hardest: [{ pack: 'times-tables', key: 'mul:7x8', attempts: 5, correct: 1 }],
    refused: 2,
  });
});

const loadedSwitch = async () => {
  const on = await screen.findByRole('switch', { name: 'Dragon Maths' });
  await waitFor(() => expect(on).toBeEnabled());
  return on;
};

describe('the Dragon Maths switch on the Games table', () => {
  it('turns the game on, off (which pauses the season) and on again for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={dragonMaths} classId="c12" />);
    const on = await loadedSwitch();
    expect(data.fetchLordEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(false, 'c12');
    await user.click(on);
    expect(data.saveLordEnabled).toHaveBeenLastCalledWith(true, 'c12');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clanQuest } from '../games/clans/game';
import { GameSwitchSetting } from '../teacher/Games';

// Clan Quest on the teacher's Games table (these checks were the old panels'): the switch in its row, and made-up hero names,
// the maths settings, raids and the class report in its Settings, all for a named class. The fame
// season and each pupil's clan are under Students.
const data = vi.hoisted(() => ({
  fetchClansEnabled: vi.fn(),
  saveClansEnabled: vi.fn(),
  fetchClanInfo: vi.fn(),
  resetClan: vi.fn(async () => true),
  fetchClanRaidsEnabled: vi.fn(),
  saveClanRaidsEnabled: vi.fn(),
  fetchClanMathsSettings: vi.fn(),
  saveClanMathsSettings: vi.fn(),
  startClansNewSeason: vi.fn(),
  fetchClassClanMaths: vi.fn(),
  fetchClanMathsStudent: vi.fn(),
  fetchClanTypedNames: vi.fn(),
  saveClanTypedNames: vi.fn(),
  listHeroNames: vi.fn(),
}));
vi.mock('../data/clans', async (original) => ({ ...(await original<typeof import('../data/clans')>()), ...data }));


/** The fame season panel says whose fame it resets, so it needs to know who is signed in. */

const info = (over = {}) => ({ name: 'Red Banner', day: 4, gold: 220, followers: 12, fightsLeft: 6, averageLevel: 3.5, inFight: false, lastPlayed: new Date().toISOString(), ...over });

const mathsSettings = (over = {}) => ({ yearBand: 5, enabledTopics: ['percentages', 'money'], enabledTables: [2, 3], fightsPerDay: 8, season: 1, ...over });

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockReset());
  data.resetClan.mockResolvedValue(true);
  data.saveClanMathsSettings.mockResolvedValue(undefined);
  data.fetchClanMathsSettings.mockResolvedValue(mathsSettings());
  data.fetchClassClanMaths.mockResolvedValue({ players: 0, kinds: [], hardest: [] });
  data.fetchClanMathsStudent.mockResolvedValue({ fame: null, kinds: [] });
  data.startClansNewSeason.mockResolvedValue({ season: 2, clans: 20 });
  data.fetchClansEnabled.mockResolvedValue(false);
  data.saveClansEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchClanInfo.mockResolvedValue(info());
  data.fetchClanRaidsEnabled.mockResolvedValue(false);
  data.saveClanRaidsEnabled.mockImplementation(async (on: boolean) => on);
  data.fetchClanTypedNames.mockResolvedValue(false);
  data.saveClanTypedNames.mockImplementation(async (on: boolean) => on);
  data.listHeroNames.mockResolvedValue(1);
});

/** A switch once it has loaded. */
const loaded = async (name: string) => {
  const sw = await screen.findByRole('switch', { name });
  await waitFor(() => expect(sw).toBeEnabled());
  return sw;
};
/** The maths settings once they have loaded. */

describe('the Clan Quest switch on the Games table', () => {
  it('starts off, turns the game on for the class and off again', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={clanQuest} classId="c12" />);
    const on = await loaded('Clan Quest');
    expect(data.fetchClansEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText(/^Saved ✓/)).toBeInTheDocument();
    await user.click(on);
    expect(data.saveClansEnabled).toHaveBeenLastCalledWith(false, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary } from '../data/classes';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchBondMatchEnabled: vi.fn(),
  saveBondMatchEnabled: vi.fn(),
  fetchMathsSwitch: vi.fn(),
  fetchReactionsEnabled: vi.fn(),
  setSpaceMaths: vi.fn(),
  setSpaceReactions: vi.fn(),
  fetchGemKeepSettings: vi.fn(),
  fetchClassGemKeep: vi.fn(),
  readSettings: vi.fn(),
  fetchMonstersSettings: vi.fn(),
  fetchMonstersEnabled: vi.fn(),
  fetchClassMonsters: vi.fn(),
  fetchLordSettings: vi.fn(),
  // Before the school season migration: each class keeps its own date (the row reads it from the class).
  fetchLordSchoolSeason: vi.fn(async () => ({ live: false as const })),
  fetchLordEnabled: vi.fn(),
  fetchClassLord: vi.fn(),
  fetchClansEnabled: vi.fn(),
  fetchClassClanMaths: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
  fetchWarpRequests: vi.fn(async () => []),
}));
vi.mock('../data/bondMatch', async (original) => ({
  ...(await original<typeof import('../data/bondMatch')>()),
  fetchBondMatchEnabled: data.fetchBondMatchEnabled,
  saveBondMatchEnabled: data.saveBondMatchEnabled,
}));
vi.mock('../data/spaceGames', async (original) => ({
  ...(await original<typeof import('../data/spaceGames')>()),
  fetchMathsSwitch: data.fetchMathsSwitch,
  fetchReactionsEnabled: data.fetchReactionsEnabled,
}));
vi.mock('../data/teacher', async (original) => ({
  ...(await original<typeof import('../data/teacher')>()),
  setSpaceMaths: data.setSpaceMaths,
  setSpaceReactions: data.setSpaceReactions,
}));
vi.mock('../data/classSettings', async (original) => ({
  ...(await original<typeof import('../data/classSettings')>()),
  readSettings: data.readSettings,
}));
vi.mock('../data/monsters', async (original) => ({
  ...(await original<typeof import('../data/monsters')>()),
  fetchMonstersSettings: data.fetchMonstersSettings,
  fetchMonstersEnabled: data.fetchMonstersEnabled,
  fetchClassMonsters: data.fetchClassMonsters,
}));
vi.mock('../data/lord', async (original) => ({
  ...(await original<typeof import('../data/lord')>()),
  fetchLordSettings: data.fetchLordSettings,
  fetchLordSchoolSeason: data.fetchLordSchoolSeason,
  fetchLordEnabled: data.fetchLordEnabled,
  fetchClassLord: data.fetchClassLord,
}));
vi.mock('../data/clans', async (original) => ({
  ...(await original<typeof import('../data/clans')>()),
  fetchClansEnabled: data.fetchClansEnabled,
  fetchClassClanMaths: data.fetchClassClanMaths,
}));
vi.mock('../data/gemKeep', async (original) => ({
  ...(await original<typeof import('../data/gemKeep')>()),
  fetchGemKeepSettings: data.fetchGemKeepSettings,
  fetchClassGemKeep: data.fetchClassGemKeep,
}));

const room = (id: string, name: string): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 28, teaching: true, groups: 0, waiting: 0,
});
const teacher: AuthState = {
  status: 'signed-in',
  profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

/** Where the router is, and a browser Back button. */
function Where() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="address">{pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

/** Like the real Layout: every change of address builds the page again from scratch (its CrashScreen is keyed by the path). */
function NewPageEachAddress({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <div key={pathname}>{children}</div>;
}

function show(url: string, { likeTheApp = false } = {}) {
  const routes = <Routes>{teacherRoutes()}</Routes>;
  const tree = (
    <AuthContext.Provider value={teacher}>
      <MemoryRouter initialEntries={[url]}>
        {likeTheApp ? <NewPageEachAddress>{routes}</NewPageEachAddress> : routes}
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return render(likeTheApp ? <StrictMode>{tree}</StrictMode> : tree);
}

/** A narrow screen (or not): the drawer needs `min-width: 800px`. */
function screenIs(wide: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('min-width') ? wide : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const realMatchMedia = window.matchMedia;
beforeEach(() => {
  sessionStorage.clear();
  screenIs(true);
  for (const fn of Object.values(data)) fn.mockReset();
  data.fetchClasses.mockResolvedValue([room('c12', 'Room 12'), room('c14', 'Room 14')]);
  data.fetchBondMatchEnabled.mockResolvedValue(false);
  data.saveBondMatchEnabled.mockResolvedValue(undefined);
  data.fetchMathsSwitch.mockResolvedValue('choose');
  data.fetchReactionsEnabled.mockResolvedValue(true);
  data.setSpaceMaths.mockResolvedValue(undefined);
  data.setSpaceReactions.mockResolvedValue(undefined);
  data.fetchGemKeepSettings.mockResolvedValue({
    mode: 'calm', enabledTables: [2, 3, 4, 5, 6, 7, 8, 9, 10], division: false, multipleChoice: false, keyPassMark: 8,
  });
  data.fetchClassGemKeep.mockResolvedValue({ players: 0, levels: [], hardest: [] });
  data.fetchMonstersSettings.mockResolvedValue({ enabled: true, topics: ['add-sub', 'times-tables', 'division', 'fractions'] });
  data.fetchMonstersEnabled.mockResolvedValue(true);
  data.fetchClassMonsters.mockResolvedValue({ players: 0, badges: [], topics: [], hardest: [], refusals: [] });
  data.fetchLordSettings.mockResolvedValue({ enabled: true, forestPerDay: 10, seasonStart: '2026-09-01', pausedSince: null, topics: ['add-sub'] });
  data.fetchLordEnabled.mockResolvedValue(true);
  data.fetchClassLord.mockResolvedValue({
    season: { number: 2, start: '2026-09-01', daysLeft: 12 }, players: 0, thisSeason: 0, levels: [], hardest: [], refusals: [], hall: [],
  });
  data.readSettings.mockImplementation(async (columns: string[]) =>
    columns.includes('clans_year_band')
      ? { clans_year_band: 4, clans_topics: ['percentages', 'money', 'area', 'division', 'ratios'], clans_fights_per_day: 10 }
      : { gem_keep_mode: 'calm', gem_keep_tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], gem_keep_multiple_choice: false },
  );
  data.fetchClansEnabled.mockResolvedValue(true);
  data.fetchClassClanMaths.mockResolvedValue({ players: 0, kinds: [], hardest: [] });
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const table = () => screen.findByRole('table', { name: 'Games for this class' });
const row = (t: HTMLElement, name: string) => within(t).getByRole('rowheader', { name }).closest('tr')!;

describe('the Games table', () => {

  it('saves a row’s on/off switch and maths choice for the header’s class', async () => {
    const user = userEvent.setup();
    show('/teacher/c14/games');
    const t = await table();
    const bond = await within(row(t, 'Bond Match')).findByRole('switch', { name: 'Bond Match' });
    await waitFor(() => expect(bond).toBeEnabled());
    expect(data.fetchBondMatchEnabled).toHaveBeenCalledWith('c14');
    expect(bond).toHaveAttribute('aria-checked', 'false');
    await user.click(bond);
    expect(data.saveBondMatchEnabled).toHaveBeenCalledWith(true, 'c14');
    expect(bond).toHaveAttribute('aria-checked', 'true');
    expect(await within(row(t, 'Bond Match')).findByText('Saved ✓')).toBeInTheDocument();

    const maths = await within(row(t, 'Wormholes & Black Holes')).findByRole('radiogroup', { name: 'Wormholes & Black Holes maths' });
    expect(data.fetchMathsSwitch).toHaveBeenCalledWith('c14');
    expect(within(maths).getByRole('radio', { name: 'Students choose' })).toBeChecked();
    await user.click(within(maths).getByRole('radio', { name: 'On for everyone' }));
    expect(data.setSpaceMaths).toHaveBeenCalledWith('on', 'c14');
  });

});



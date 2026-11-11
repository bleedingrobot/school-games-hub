import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary } from '../data/classes';
import { switchColumnOf } from '../data/games';
import { GAMES } from '../games/registry';

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
  saveNonMathsGames: vi.fn(),
  fetchClassClanMaths: vi.fn(),
  saveGameSwitches: vi.fn(),
}));
vi.mock('../data/games', async (original) => ({
  ...(await original<typeof import('../data/games')>()),
  saveGameSwitches: data.saveGameSwitches,
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
vi.mock('../data/nonMathsGames', async (original) => ({
  ...(await original<typeof import('../data/nonMathsGames')>()),
  saveNonMathsGames: data.saveNonMathsGames,
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
  localStorage.clear();
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
  data.saveNonMathsGames.mockResolvedValue(undefined);
  data.saveGameSwitches.mockResolvedValue(undefined);
  data.fetchClassClanMaths.mockResolvedValue({ players: 0, kinds: [], hardest: [] });
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const table = () => screen.findByRole('table', { name: 'Games for this class' });
const row = (t: HTMLElement, name: string) => within(t).getByRole('rowheader', { name }).closest('tr')!;

/** A class where some games are on: the Foundational ones, Maths Monsters and Clan Quest; Non-maths games is off. */
const switchedOn = (column: string) => column.startsWith('weka') || column.startsWith('tui') || column === 'monsters_enabled' || column === 'clans_enabled';
function someGamesOn() {
  const inner = data.readSettings.getMockImplementation()!;
  data.readSettings.mockImplementation(async (columns: string[], classId?: string | null) => {
    if (columns.includes('clans_year_band')) return inner(columns, classId);
    const row: Record<string, unknown> = { ...(await inner(columns, classId)), non_maths_games: false };
    for (const game of GAMES) {
      const column = switchColumnOf(game);
      if (column && column !== 'non_maths_games') row[column] = switchedOn(column);
    }
    return row;
  });
  const isOn = (game: (typeof GAMES)[number]) => {
    const column = switchColumnOf(game);
    return column === null || (column !== 'non_maths_games' && switchedOn(column));
  };
  return { isOn, onCount: GAMES.filter(isOn).length };
}

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

    // The No maths rows share one switch (Non-maths games, as on Today); a game whose code switch is off has no row.
    const chess = await within(row(t, 'Chess')).findByRole('switch', { name: 'Chess (with Non-maths games)' });
    await waitFor(() => expect(chess).toBeEnabled());
    await user.click(chess);
    expect(data.saveNonMathsGames).toHaveBeenCalledWith(false, 'c14');
    await waitFor(() => expect(within(row(t, 'Checkers')).getByRole('switch', { name: 'Checkers (with Non-maths games)' })).toHaveAttribute('aria-checked', 'false'));
    expect(within(t).queryByRole('rowheader', { name: 'Kingdom Keeper' })).toBeNull();

    // What's on at a glance, whole sections at once, and the Unlimited column (a class where some games are on).
    {
    const { onCount } = someGamesOn();
    cleanup();
    localStorage.clear();
    data.saveGameSwitches.mockClear();
    show('/teacher/c12/games');
    const t = await table();
    expect(await screen.findByText(`${onCount} of ${GAMES.length} games`)).toBeInTheDocument();
    expect(screen.getByText(/On for Room 12:/)).toBeInTheDocument();
    const foundational = GAMES.filter((g) => g.group === 'foundational');
    const foundationalOn = foundational.filter((g) => ['weka', 'tui'].includes(g.id)).length;
    expect(within(t).getByText(`${foundationalOn} of ${foundational.length} on`)).toBeInTheDocument();
    expect(within(t).getByText(`0 of ${GAMES.filter((g) => g.group === 'no-maths').length} on`)).toBeInTheDocument();
    }
    {
    const user = userEvent.setup();
    const { isOn } = someGamesOn();
    cleanup();
    localStorage.clear();
    data.saveGameSwitches.mockClear();
    show('/teacher/c12/games');
    const t = await table();
    await screen.findByText(/ of \d+ games/);
    expect(within(t).getByRole('rowheader', { name: 'Chess' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'On' }));
    expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
    for (const game of GAMES) {
      if (isOn(game)) expect(within(t).getByRole('rowheader', { name: game.name })).toBeInTheDocument();
      else expect(within(t).queryByRole('rowheader', { name: game.name })).toBeNull();
    }
    expect(localStorage.getItem('teacher-games-show')).toBe('on');
    await user.click(screen.getByRole('button', { name: 'Off' }));
    expect(within(t).getByRole('rowheader', { name: 'Chess' })).toBeInTheDocument();
    expect(within(t).queryByRole('rowheader', { name: 'Maths Monsters' })).toBeNull();
    }
    {
    const user = userEvent.setup();
    someGamesOn();
    cleanup();
    localStorage.clear();
    data.saveGameSwitches.mockClear();
    show('/teacher/c12/games');
    const t = await table();
    const foundational = GAMES.filter((g) => g.group === 'foundational');
    const allOff = await within(t).findByRole('button', { name: 'All off, Foundational skills' });
    await waitFor(() => expect(allOff).toBeEnabled());
    await user.click(allOff);
    expect(within(t).getByText(`Turn off all ${foundational.length} Foundational skills games for Room 12?`)).toBeInTheDocument();
    expect(data.saveGameSwitches).not.toHaveBeenCalled();
    await user.click(within(t).getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(data.saveGameSwitches).toHaveBeenCalledTimes(1));
    expect(data.saveGameSwitches).toHaveBeenCalledWith(
      Object.fromEntries(foundational.map((g) => [switchColumnOf(g)!, false])),
      'c12',
    );
    expect(await within(t).findByText(`0 of ${foundational.length} on`)).toBeInTheDocument();
    }
    {
    const user = userEvent.setup();
    someGamesOn();
    cleanup();
    localStorage.clear();
    data.saveGameSwitches.mockClear();
    show('/teacher/c12/games');
    const t = await table();
    const allOn = await within(t).findByRole('button', { name: 'All on, Foundational skills' });
    await waitFor(() => expect(allOn).toBeEnabled());
    await user.click(allOn);
    await waitFor(() => expect(data.saveGameSwitches).toHaveBeenCalledTimes(1));
    expect(Object.values(data.saveGameSwitches.mock.calls[0][0]).every((v) => v === true)).toBe(true);
    }
    {
    cleanup();
    localStorage.clear();
    data.saveGameSwitches.mockClear();
    show('/teacher/c12/games');
    const t = await table();
    expect(await within(row(t, 'Maths Monsters')).findByRole('switch', { name: 'Maths Monsters unlimited today' })).toBeInTheDocument();
    expect(within(row(t, 'Chess')).queryByRole('switch', { name: /unlimited/ })).toBeNull();
    }
    for (const game of GAMES) if (game.teacher?.switch) expect(switchColumnOf(game), game.name).not.toBeNull();
  });

});

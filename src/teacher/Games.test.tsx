import { render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary } from '../data/classes';
import { ALL_GAMES } from '../games/registry';

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
const address = () => screen.getByRole('status', { name: 'address' }).textContent;

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
  it('lists every game once, under its dashboard group, with the four columns', async () => {
    show('/teacher/c12/games');
    const t = await table();
    expect(within(t).getAllByRole('columnheader').slice(0, 4).map((h) => h.textContent)).toEqual(['Game', 'On', 'Maths', 'Settings']);
    const groups = within(t).getAllByRole('rowgroup').slice(1);
    // The name, without the icon (hidden from screen readers, but the 101 card's icon says 101).
    const names = (g: HTMLElement) => within(g).getAllByRole('rowheader').map((h) => h.lastChild?.textContent);
    const want = (group: string) => ALL_GAMES.filter((g) => g.group === group).map((g) => g.name);
    expect(groups.map((g) => within(g).getAllByRole('columnheader')[0].textContent)).toEqual(['No maths', 'Easy maths', 'Complex maths']);
    expect(names(groups[0])).toEqual(want('no-maths'));
    expect(names(groups[1])).toEqual(want('easy-maths'));
    expect(names(groups[2])).toEqual(want('complex-maths'));
    expect(within(t).getAllByRole('rowheader')).toHaveLength(ALL_GAMES.length);
  });

  it('says "always" for a game with no switch, and gives a game with nothing to open no Settings', async () => {
    show('/teacher/c12/games');
    const chess = row(await table(), 'Chess');
    expect(within(chess).getByText('always')).toBeInTheDocument();
    expect(within(chess).queryByRole('link')).not.toBeInTheDocument();
    const space = row(await table(), 'Wormholes & Black Holes');
    expect(within(space).getByText('always')).toBeInTheDocument();
  });

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

  it('works from the keyboard: Space flips the switch, arrows then Enter pick a maths choice', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games');
    const t = await table();
    const bond = await within(row(t, 'Bond Match')).findByRole('switch', { name: 'Bond Match' });
    await waitFor(() => expect(bond).toBeEnabled());
    bond.focus();
    await user.keyboard(' ');
    expect(data.saveBondMatchEnabled).toHaveBeenCalledWith(true, 'c12');
    const choose = await within(row(t, 'Wormholes & Black Holes')).findByRole('radio', { name: 'Students choose' });
    choose.focus();
    await user.keyboard('{ArrowRight}');
    expect(data.setSpaceMaths).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(data.setSpaceMaths).toHaveBeenCalledWith('on', 'c12');
  });

  it('opens a game’s Settings in a drawer that keeps focus, closes on Escape and gives focus back', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games');
    const open = within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: 'Wormholes & Black Holes settings' });
    await user.click(open);
    const drawer = await screen.findByRole('dialog', { name: 'Wormholes & Black Holes' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(address()).toBe('/teacher/c12/games/space');
    const close = within(drawer).getByRole('button', { name: /^Close/ });
    expect(close).toHaveFocus();
    const reactions = await within(drawer).findByRole('switch', { name: 'Emoji reactions' });
    await waitFor(() => expect(reactions).toBeEnabled());
    expect(data.fetchReactionsEnabled).toHaveBeenCalledWith('c12');

    // Round and round inside the drawer.
    await user.tab();
    expect(within(drawer).getByRole('button', { name: 'About Emoji reactions' })).toHaveFocus();
    await user.tab();
    expect(reactions).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(reactions).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(address()).toBe('/teacher/c12/games');
    expect(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ })).toHaveFocus();
  });

  it('closes the drawer with its Close button too', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games');
    await user.click(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^Close/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ })).toHaveFocus();
  });

  it('shows Clan Quest’s switch and maths for the header’s class, and opens its settings for that class', async () => {
    const user = userEvent.setup();
    show('/teacher/c14/games');
    const clans = row(await table(), 'Clan Quest');
    const on = await within(clans).findByRole('switch', { name: 'Clan Quest' });
    await waitFor(() => expect(on).toHaveAttribute('aria-checked', 'true'));
    expect(await within(clans).findByText('Year 4 · 5 topics · 10/day')).toBeInTheDocument();
    expect(data.fetchClansEnabled).toHaveBeenCalledWith('c14');
    expect(data.readSettings).toHaveBeenCalledWith(expect.arrayContaining(['clans_year_band']), 'c14');
    await user.click(within(clans).getByRole('link', { name: 'Clan Quest settings' }));
    const drawer = await screen.findByRole('dialog', { name: 'Clan Quest' });
    expect(await within(drawer).findByRole('region', { name: 'Clan Quest settings' })).toBeInTheDocument();
    expect(await within(drawer).findByRole('region', { name: /^Clan Quest maths: this class/ })).toBeInTheDocument();
    expect(within(drawer).getByRole('region', { name: 'Clan Quest villages (whole school)' })).toBeInTheDocument();
    expect(data.fetchClassClanMaths).toHaveBeenCalledWith('c14');
  });

  it('says when Clan Quest’s maths settings couldn’t load, in its row', async () => {
    data.readSettings.mockResolvedValue(null);
    show('/teacher/c12/games');
    expect(await within(row(await table(), 'Clan Quest')).findByText('Couldn’t load')).toBeInTheDocument();
  });

  it('shows Dragon Maths’ switch and season for the header’s class, and opens its settings for that class', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T00:00:00Z') });
    try {
      const user = userEvent.setup();
      show('/teacher/c14/games');
      const dragon = row(await table(), 'Dragon Maths');
      const on = await within(dragon).findByRole('switch', { name: 'Dragon Maths' });
      await waitFor(() => expect(on).toHaveAttribute('aria-checked', 'true'));
      expect(await within(dragon).findByText('Season 2, 12 days left')).toBeInTheDocument();
      expect(data.fetchLordEnabled).toHaveBeenCalledWith('c14');
      await user.click(within(dragon).getByRole('link', { name: 'Dragon Maths settings' }));
      const drawer = await screen.findByRole('dialog', { name: 'Dragon Maths' });
      expect(await within(drawer).findByRole('region', { name: 'Dragon Maths settings' })).toBeInTheDocument();
      expect(await within(drawer).findByRole('region', { name: /^Dragon Maths: this class/ })).toBeInTheDocument();
      expect(data.fetchClassLord).toHaveBeenCalledWith('c14');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows Maths Monsters’ switch and topics for the header’s class, and opens its settings for that class', async () => {
    const user = userEvent.setup();
    show('/teacher/c14/games');
    const monsters = row(await table(), 'Maths Monsters');
    const on = await within(monsters).findByRole('switch', { name: 'Maths Monsters' });
    await waitFor(() => expect(on).toHaveAttribute('aria-checked', 'true'));
    expect(await within(monsters).findByText('4 of 6 topics')).toBeInTheDocument();
    expect(data.fetchMonstersEnabled).toHaveBeenCalledWith('c14');
    await user.click(within(monsters).getByRole('link', { name: 'Maths Monsters settings' }));
    const drawer = await screen.findByRole('dialog', { name: 'Maths Monsters' });
    expect(await within(drawer).findByRole('region', { name: 'Maths Monsters settings' })).toBeInTheDocument();
    expect(await within(drawer).findByRole('region', { name: /^Maths Monsters: this class/ })).toBeInTheDocument();
    expect(data.fetchClassMonsters).toHaveBeenCalledWith('c14');
  });

  it('shows Gem Keep as always on, sums up its settings for the header’s class, and opens them for that class', async () => {
    const user = userEvent.setup();
    show('/teacher/c14/games');
    const gem = row(await table(), 'Gem Keep');
    expect(within(gem).getByText('always')).toBeInTheDocument();
    expect(await within(gem).findByText('Calm · ×2–×10 · typing')).toBeInTheDocument();
    expect(data.readSettings).toHaveBeenCalledWith(expect.arrayContaining(['gem_keep_mode']), 'c14');
    expect(data.fetchGemKeepSettings).not.toHaveBeenCalled();
    await user.click(within(gem).getByRole('link', { name: 'Gem Keep settings' }));
    const drawer = await screen.findByRole('dialog', { name: 'Gem Keep' });
    expect(await within(drawer).findByRole('region', { name: 'Gem Keep settings' })).toBeInTheDocument();
    expect(await within(drawer).findByRole('region', { name: /^Gem Keep: this class/ })).toBeInTheDocument();
    expect(data.fetchGemKeepSettings).toHaveBeenCalledWith('c14');
    expect(data.fetchClassGemKeep).toHaveBeenCalledWith('c14');
  });

  it('says when Gem Keep’s settings couldn’t load, in its row', async () => {
    data.readSettings.mockResolvedValue(null);
    show('/teacher/c12/games');
    expect(await within(row(await table(), 'Gem Keep')).findByText('Couldn’t load')).toBeInTheDocument();
  });

  it('never makes a reversible control red', async () => {
    const user = userEvent.setup();
    const { container } = show('/teacher/c12/games');
    await table();
    expect(container.querySelector('.button--danger')).toBeNull();
    await user.click(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ }));
    await screen.findByRole('switch', { name: 'Emoji reactions' });
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('a game’s settings on a narrow screen', () => {
  beforeEach(() => screenIs(false));

  it('opens on their own page, and the back link goes back to the table with focus on the game', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games');
    await user.click(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ }));
    expect(address()).toBe('/teacher/c12/games/space');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wormholes & Black Holes' })).toHaveFocus();
    expect(await screen.findByRole('switch', { name: 'Emoji reactions' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /All games/ }));
    expect(address()).toBe('/teacher/c12/games');
    expect(within(row(await table(), 'Wormholes & Black Holes')).getByRole('link', { name: /settings/ })).toHaveFocus();
  });

  it('goes back with the browser’s Back button too', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games');
    await user.click(within(row(await table(), 'Gem Keep')).getByRole('link', { name: /settings/ }));
    expect(await screen.findByRole('region', { name: 'Gem Keep settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(address()).toBe('/teacher/c12/games');
    expect(await table()).toBeInTheDocument();
  });

  it('opens straight from a link, and its back link still reaches the table', async () => {
    const user = userEvent.setup();
    show('/teacher/c14/games/space');
    expect(await screen.findByRole('heading', { name: 'Wormholes & Black Holes' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /All games/ }));
    expect(address()).toBe('/teacher/c14/games');
    expect(await table()).toBeInTheDocument();
  });

  it('sends a game with nothing to open (or no such game) back to the table', async () => {
    show('/teacher/c12/games/bond-match');
    expect(await table()).toBeInTheDocument();
    expect(address()).toBe('/teacher/c12/games');
  });
});

describe('focus goes back to the game’s Settings when the page is built again', () => {
  const settingsLink = async (name: string) => within(row(await table(), name)).getByRole('link', { name: `${name} settings` });

  it('after Escape closes the drawer', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games', { likeTheApp: true });
    await user.click(await settingsLink('Wormholes & Black Holes'));
    await screen.findByRole('dialog', { name: 'Wormholes & Black Holes' });
    await user.keyboard('{Escape}');
    expect(address()).toBe('/teacher/c12/games');
    await waitFor(async () => expect(await settingsLink('Wormholes & Black Holes')).toHaveFocus());
  });

  it('after the browser’s Back button, from a narrow screen’s page', async () => {
    screenIs(false);
    const user = userEvent.setup();
    show('/teacher/c12/games', { likeTheApp: true });
    await user.click(await settingsLink('Gem Keep'));
    await screen.findByRole('heading', { name: 'Gem Keep' });
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(address()).toBe('/teacher/c12/games');
    await waitFor(async () => expect(await settingsLink('Gem Keep')).toHaveFocus());
  });

  it('after closing a drawer that was opened straight from a link', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/games/space', { likeTheApp: true });
    const drawer = await screen.findByRole('dialog', { name: 'Wormholes & Black Holes' });
    await user.click(within(drawer).getByRole('button', { name: /^Close/ }));
    expect(address()).toBe('/teacher/c12/games');
    await waitFor(async () => expect(await settingsLink('Wormholes & Black Holes')).toHaveFocus());
  });
});

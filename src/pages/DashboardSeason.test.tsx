import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { forgetSettings } from '../data/settingsMemory';
import { busyPupil, setWorld, type World } from './homePageFake';

/** The "This season" strip on the home page (same fake home page as DashboardHome.test.tsx). */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';

const signedIn = (role = 'student') =>
  ({ status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role }, message: null }) as unknown as AuthState;

async function settle() {
  for (let i = 0; i < 30; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

const season = (over: Record<string, unknown> = {}) => ({ number: 1, day: 24, daysLeft: 12, clockOn: true, ...over });

/** A busy pupil whose moves-left answer carries this season (or none), with Clan Quest on or off. */
async function show(seasonPart: unknown, opts: { clansOn?: boolean; role?: string } = {}) {
  const world: World = busyPupil();
  world.jobs.my_moves_left = { ...(world.jobs.my_moves_left as object), ...(seasonPart === undefined ? {} : { season: seasonPart }) };
  if (opts.clansOn === false) world.tables.app_settings = [{ ...world.tables.app_settings[0], clans_enabled: false }];
  setWorld(world);
  render(
    <AuthContext.Provider value={signedIn(opts.role)}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await settle();
}

describe('the season strip on the home page', () => {
  beforeEach(() => forgetSettings());

  it('shows under the hero when there is a season and the clock is on', async () => {
    await show(season());
    const strip = screen.getByRole('region', { name: /Season 1, day 24 of 35/ });
    expect(strip).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Clan Quest' })).toHaveAttribute('href', '/clan-quest');
    const hero = screen.getByRole('region', { name: 'Speedy Otter 27' });
    expect(hero.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const going = screen.getByRole('region', { name: 'Games still going' });
    expect(strip.compareDocumentPosition(going) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is hidden when the clock is off', async () => {
    await show(season({ clockOn: false }));
    expect(screen.queryByRole('region', { name: /Season 1/ })).not.toBeInTheDocument();
  });

  it('is hidden when there is no season number yet', async () => {
    await show(season({ number: 0, day: 0, daysLeft: 0 }));
    expect(screen.queryByText('This season')).not.toBeInTheDocument();
  });

  it('is hidden when the answer has no season', async () => {
    await show(undefined);
    expect(screen.queryByText('This season')).not.toBeInTheDocument();
  });

  it('is hidden when Clan Quest is switched off', async () => {
    await show(season(), { clansOn: false });
    expect(screen.queryByText('This season')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Clan Quest' })).not.toBeInTheDocument();
  });

  it('is not for teachers', async () => {
    await show(season(), { role: 'teacher' });
    expect(screen.queryByText('This season')).not.toBeInTheDocument();
  });
});

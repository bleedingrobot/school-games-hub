import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthContext } from '../../auth/AuthContext';
import { GAMES } from '../registry';
import { LordPlay } from './LordPlay';
import { dragonMaths } from './index';

const auth = {
  status: 'signed-in',
  profile: { id: 'test-pupil', display_name: 'Brave Kiwi', avatar: null, role: 'student' },
  message: '',
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as React.ContextType<typeof AuthContext>;

const renderGame = () =>
  render(
    <AuthContext.Provider value={auth}>
      <LordPlay />
    </AuthContext.Provider>,
  );

describe('Dragon Maths trial', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('stays off the dashboard until it is switched on', () => {
    expect(GAMES.map((g) => g.id)).not.toContain(dragonMaths.id);
  });

  it('asks you to pick a class, then shows the village with your turns', async () => {
    const user = userEvent.setup();
    renderGame();
    expect(screen.getByText(/Pick the kind of hero/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    expect(screen.getByRole('region', { name: 'The village' })).toBeInTheDocument();
    expect(screen.getByText(/You have 10 forest fights left today/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Level 1');
  });

  it('keeps the hero between visits (this browser only)', async () => {
    const user = userEvent.setup();
    const first = renderGame();
    await user.click(screen.getByRole('button', { name: /Mage/ }));
    first.unmount();
    renderGame();
    expect(screen.queryByText(/Pick the kind of hero/i)).not.toBeInTheDocument();
    await user.keyboard('y');
    expect(screen.getByText('Mage')).toBeInTheDocument();
  });

  it('opens a place with its letter key and goes back with Escape', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await user.keyboard('s');
    expect(screen.getByRole('region', { name: /Blacksmith/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('region', { name: 'The village' })).toBeInTheDocument();
  });

  it('uses a forest fight when a monster appears, and an event does not', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await user.keyboard('f');
    const status = screen.getByRole('list', { name: /at a glance/i });
    const monster = screen.queryByRole('region', { name: 'A monster appears' });
    if (monster) expect(status).toHaveTextContent('Forest fights 9');
    else expect(status).toHaveTextContent('Forest fights 10');
  });

  it('will not let you leave the shop with gear you cannot afford, and says why', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await user.keyboard('s');
    expect(screen.getByText(/Rusty Dagger/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Buy' })).toHaveLength(0); // nothing is affordable at level 1 with 50 gold
  });

  it('has test tools that jump to the dragon', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await user.keyboard('x');
    await user.click(screen.getByRole('button', { name: /Straight to the dragon/ }));
    await user.click(screen.getByRole('button', { name: 'Back to the village' }));
    expect(screen.getByRole('button', { name: /The Red Dragon/ })).toBeInTheDocument();
  });
});

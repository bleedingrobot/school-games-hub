import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { forestTrip, newHero } from '../../../shared/lord/engine';
import { emptyDb, type MemoryDb } from '../../../shared/lord/memoryServices';
import { AuthContext } from '../../auth/AuthContext';
import type { LordBackend } from '../../data/lord';
import { GAMES } from '../registry';
import { LordPlay } from './LordPlay';
import { createLocalBackend } from './trialBackend';
import { dragonMaths } from './index';

const auth = {
  status: 'signed-in',
  profile: { id: 'test-pupil', display_name: 'Brave Kiwi', avatar: null, role: 'student' },
  message: '',
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as unknown as React.ContextType<typeof AuthContext>;

const renderGame = (backend: LordBackend) =>
  render(
    <AuthContext.Provider value={auth}>
      <LordPlay backend={backend} />
    </AuthContext.Provider>,
  );

/** The same rules the server runs, against an in-memory database. `trial: false` is what a pupil gets: no test tools. */
const newGame = (over: Partial<MemoryDb['settings']> = {}, trial = true, teacher = true) => {
  const db = emptyDb({ enabled: true, ...over });
  db.teacher = teacher;
  const seeds: number[] = [];
  return { db, seeds, backend: createLocalBackend(db, { trial, seed: () => seeds.shift() ?? 1 }) };
};

/** A seed for the server's next forest trip that finds a monster (or an event). */
function tripSeed(kind: 'fight' | 'event') {
  const hero = newHero('knight', '2026-10-19');
  for (let s = 1; s < 5000; s++) {
    const trip = forestTrip(hero, s);
    if (trip.kind === kind && (trip.kind === 'fight' || !trip.event.maths)) return s;
  }
  throw new Error('no seed');
}

const village = () => screen.findByRole('region', { name: 'The village' });

describe('Dragon Maths with a server keeping the hero', () => {
  afterEach(cleanup);

  it('stays off the dashboard until it is switched on', () => {
    expect(GAMES.map((g) => g.id)).not.toContain(dragonMaths.id);
  });

  it('asks you to pick a class, then shows the village with your turns', async () => {
    const user = userEvent.setup();
    const { db, backend } = newGame();
    renderGame(backend);
    expect(await screen.findByText(/Pick the kind of hero/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await village();
    expect(screen.getByText(/You have 10 forest fights left today/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Level 1');
    expect(db.row?.hero.heroClass).toBe('knight');
  });

  it('keeps the hero between visits, as the server has it', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    const first = renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Mage/ }));
    await village();
    first.unmount();
    renderGame(backend);
    await village();
    expect(screen.queryByText(/Pick the kind of hero/i)).not.toBeInTheDocument();
    await user.keyboard('y');
    expect(screen.getByText('Mage')).toBeInTheDocument();
  });

  it('opens a place with its letter key and goes back with Escape', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('s');
    expect(screen.getByRole('region', { name: /Blacksmith/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await village()).toBeInTheDocument();
  });

  it('waits for the server to hand out a fight, and an event does not use a turn', async () => {
    const user = userEvent.setup();
    const { db, seeds, backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    seeds.push(tripSeed('event'));
    await user.keyboard('f');
    await screen.findByText(/Events do not use up a forest fight/);
    expect(db.openFight).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await village();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Forest fights 10');
    seeds.push(tripSeed('fight'));
    await user.keyboard('f');
    await screen.findByRole('region', { name: 'A monster appears' });
    await user.keyboard('{Escape}');
    expect(db.openFight).not.toBeNull();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Forest fights 9');
  });

  it('plays a fight in the browser and is paid by the server only after the replay', async () => {
    const user = userEvent.setup();
    const { db, seeds, backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    db.row!.hero = { ...db.row!.hero, strength: 900, hp: 400, maxHp: 400 };
    seeds.push(tripSeed('fight'));
    await user.keyboard('f');
    await user.click(await screen.findByRole('button', { name: /^Fight!/ }));
    expect(db.openFight).not.toBeNull();
    await user.keyboard('a');
    await user.keyboard('{Enter}');
    await village();
    expect(db.fights.map((f) => f.status)).toEqual(['finished']);
    expect(db.row!.hero.forestWins).toBe(1);
    expect(db.row!.hero.exp).toBeGreaterThan(0);
    expect(screen.getByText(/You beat the/)).toBeInTheDocument();
  });

  it('offers a half-finished fight again after a reload, with no extra fight used', async () => {
    const user = userEvent.setup();
    const { db, seeds, backend } = newGame();
    const first = renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    seeds.push(tripSeed('fight'));
    await user.keyboard('f');
    await screen.findByRole('region', { name: 'A monster appears' });
    const id = db.openFight!.id;
    first.unmount();
    renderGame(backend);
    expect(await screen.findByText(/in the middle of a fight/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Forest fights 9');
    await user.keyboard('f');
    expect(await screen.findByRole('region', { name: 'A monster appears' })).toBeInTheDocument();
    expect(db.openFight!.id).toBe(id);
    expect(db.row!.hero.forestLeft).toBe(9);
  });

  it('will not let you leave the shop with gear you cannot afford, and says why', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('s');
    expect(screen.getByText(/Rusty Dagger/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Buy' })).toHaveLength(0); // nothing is affordable at level 1 with 50 gold
  });

  it('banks gold through the server', async () => {
    const user = userEvent.setup();
    const { db, backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('b');
    await user.click(screen.getByRole('button', { name: 'Deposit all' }));
    await waitFor(() => expect(db.row!.hero.bank).toBe(50));
    expect(db.row!.hero.gold).toBe(0);
  });

  it('has test tools that jump to the dragon in the trial', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('x');
    await user.click(await screen.findByRole('button', { name: /Straight to the dragon/ }));
    await user.click(screen.getByRole('button', { name: 'Back to the village' }));
    expect(await screen.findByRole('button', { name: /The Red Dragon/ })).toBeInTheDocument();
  });

  it('has no test tools in the live game, even for a teacher', async () => {
    const user = userEvent.setup();
    const { backend } = newGame({}, false, true);
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    expect(screen.queryByRole('button', { name: /Test tools/ })).not.toBeInTheDocument();
    await user.keyboard('x');
    expect(screen.getByRole('region', { name: 'The village' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Test tools' })).not.toBeInTheDocument();
  });

  it('says the gates are closed while the teacher’s switch is off, and keeps the hero safe', async () => {
    const { db, backend } = newGame({ enabled: false }, false, false);
    renderGame(backend);
    expect(await screen.findByRole('region', { name: 'Closed' })).toHaveTextContent(/switched off/);
    expect(db.row).toBeNull();
  });

  it('says plainly when it cannot connect, and tries again on request', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    let up = false;
    const flaky: LordBackend = { ...backend, load: async () => (up ? backend.load() : { kind: 'offline' }) };
    renderGame(flaky);
    const box = await screen.findByRole('region', { name: 'Cannot connect' });
    expect(within(box).getByText(/Check the Wi-Fi/)).toBeInTheDocument();
    up = true;
    await user.click(within(box).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Pick the kind of hero/i)).toBeInTheDocument();
  });

  it('tells the pupil a fight is saved on this device when the connection drops as it ends', async () => {
    const user = userEvent.setup();
    const { db, seeds, backend } = newGame();
    let offline = false;
    let waiting = 0;
    const flaky: LordBackend = {
      ...backend,
      waiting: () => waiting,
      send: async (request) => {
        if (offline && request.action === 'fight-finish') {
          waiting = 1;
          return { kind: 'queued' };
        }
        return backend.send(request);
      },
    };
    renderGame(flaky);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    db.row!.hero = { ...db.row!.hero, strength: 900, hp: 400, maxHp: 400 };
    seeds.push(tripSeed('fight'));
    await user.keyboard('f');
    await user.click(await screen.findByRole('button', { name: /^Fight!/ }));
    offline = true;
    await user.keyboard('a');
    await user.keyboard('{Enter}');
    expect((await screen.findAllByText(/saved on this Chromebook/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Try again now' })).toBeInTheDocument();
    expect(db.openFight).not.toBeNull();
  });
});

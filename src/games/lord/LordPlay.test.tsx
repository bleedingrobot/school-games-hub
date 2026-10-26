import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { forestTrip, newHero } from '../../../shared/lord/engine';
import { emptyDb, type MemoryDb } from '../../../shared/lord/memoryServices';
import { AuthContext } from '../../auth/AuthContext';
import type { LordBackend } from '../../data/lord';
import { LordPlay } from './LordPlay';
import { createLocalBackend } from './trialBackend';

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

/** Makes a hero the way a pupil does: a class, then the first look of it. */
async function pickHero(user: ReturnType<typeof userEvent.setup>, heroClass: RegExp) {
  await user.click(await screen.findByRole('button', { name: heroClass }));
  await user.click((await screen.findAllByRole('button', { name: /painting 1/ }))[0]);
}

describe('Dragon Maths with a server keeping the hero', () => {
  afterEach(cleanup);

  it('starts a hero, plays a fight in the browser and is paid by the server only after the replay', async () => {
    const user = userEvent.setup();
    const { db, seeds, backend } = newGame();
    renderGame(backend);
    expect(await screen.findByText(/Pick the kind of hero/i)).toBeInTheDocument();
    await pickHero(user, /Knight/);
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

  it('has no test tools in the live game, even for a teacher', async () => {
    const user = userEvent.setup();
    const { backend } = newGame({}, false, true);
    renderGame(backend);
    await pickHero(user, /Knight/);
    await village();
    expect(screen.queryByRole('button', { name: /Test tools/ })).not.toBeInTheDocument();
    await user.keyboard('x');
    expect(screen.getByRole('region', { name: 'The village' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Test tools' })).not.toBeInTheDocument();
  });
});

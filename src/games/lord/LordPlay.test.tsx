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

  it('has a card on the dashboard (which hides itself while the teacher’s switch is off)', () => {
    expect(GAMES.map((g) => g.id)).toContain(dragonMaths.id);
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

  it('has a how-to-play page, on the ? key and as a button, and it is in the class choice too', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await screen.findByText(/Pick the kind of hero/i);
    await user.click(screen.getByText('How to play')); // the fold-out on the class screen
    expect(screen.getByText(/The Red Dragon stole the village/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('?');
    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument();
    expect(screen.getByText(/A wrong answer never takes anything away/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await village();
    await user.click(screen.getByRole('button', { name: /How to play/ }));
    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument();
  });

  it('can turn the letter keys off, and buttons and Escape still work', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.click(screen.getByRole('checkbox', { name: /Letter-key shortcuts/ }));
    await user.keyboard('s');
    expect(screen.queryByRole('region', { name: /Blacksmith/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Shop/ }));
    expect(screen.getByRole('region', { name: /Blacksmith/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await village()).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Letter-key shortcuts/ }));
    window.localStorage.removeItem('dragon-maths-letter-keys');
  });

  it('puts the keyboard on the new screen’s heading after a button press', async () => {
    const user = userEvent.setup();
    const { backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.click(screen.getByRole('button', { name: /Healer/ }));
    await waitFor(() => expect(document.activeElement?.tagName).toBe('H2'));
  });

  it('offers one hint on a question, which narrows it down and is recorded as a hint, never as a plain right answer', async () => {
    const user = userEvent.setup();
    const { db, backend } = newGame();
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('i');
    await user.click(screen.getByRole('button', { name: /riddle/i }));
    await user.click(await screen.findByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('button', { name: 'Hint used' })).toBeDisabled();
    // Pick-one questions grey out two choices; typed ones say where the answer is. Either way, answer by guessing.
    const picks = screen.queryAllByRole('button').filter((b) => b.classList.contains('question__choice') && !(b as HTMLButtonElement).disabled);
    if (picks.length) await user.click(picks[0]);
    else {
      await user.click(screen.getByRole('button', { name: '1' }));
      await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    }
    await waitFor(() => expect(db.events.some((e) => e.action === 'inn')).toBe(true), { timeout: 4000 });
    const summary = db.events.find((e) => e.action === 'inn')!.summary as { riddle: string };
    expect(['hint', 'wrong']).toContain(summary.riddle);
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


describe('the arena, the news, the Warriors list and the Hall of Heroes', () => {
  afterEach(cleanup);

  async function inVillage(over: Parameters<typeof newGame>[0] = {}, trial = false) {
    const user = userEvent.setup();
    const game = newGame(over, trial);
    renderGame(game.backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    return { user, ...game };
  }

  it('fights a hero for you in the arena: a win pays a little, the fight is used, and it is all in words', async () => {
    const { user, db } = await inVillage();
    db.row!.hero = { ...db.row!.hero, strength: 900, hp: 400, maxHp: 400 };
    await user.keyboard('a');
    const arena = await screen.findByRole('region', { name: 'The Arena' });
    expect(arena).toHaveTextContent('Losing costs you nothing');
    expect(arena).toHaveTextContent('Arena fights left today: 3 of 3');
    await user.click(screen.getByRole('button', { name: 'Step into the arena' }));
    expect(await screen.findByText(/You won! \+\d+ experience/)).toBeInTheDocument();
    expect(screen.getByLabelText('What happened in the fight').children.length).toBeGreaterThan(0);
    expect(screen.getByText('computer hero')).toBeInTheDocument();
    expect(screen.getByText(/Arena fights left today/)).toHaveTextContent('2 of 3');
    expect(db.row!.hero.arenaWins).toBe(1);
    expect(db.fights.at(-1)).toMatchObject({ kind: 'arena', status: 'finished' });
  });

  it('tells a loser it cost nothing, and stops after three fights', async () => {
    const { user, db } = await inVillage();
    db.row!.hero = { ...db.row!.hero, strength: 1, defence: 0, hp: 1, maxHp: 1, gold: 70 };
    await user.keyboard('a');
    for (let i = 0; i < 3; i++) {
      await user.click(await screen.findByRole('button', { name: 'Step into the arena' }));
      expect(await screen.findByText(/You lost this one. It costs you nothing/)).toBeInTheDocument();
    }
    expect(db.row!.hero).toMatchObject({ gold: 70, hp: 1, arenaLeft: 0 });
    expect(screen.getByRole('button', { name: 'No arena fights left today' })).toBeDisabled();
  });

  it('shows the Daily News the code wrote, with the day’s village line, and your deeds this visit', async () => {
    const { user } = await inVillage();
    await user.keyboard('n');
    const page = await screen.findByRole('region', { name: 'The Daily News' });
    expect(await within(page).findByText('Today')).toBeInTheDocument();
    expect(page.querySelectorAll('.lord-news__village').length).toBe(1);
    expect(page).toHaveTextContent('Nobody can write into it');
    expect(page).toHaveTextContent('Your deeds this visit');
  });

  it('says when the news can’t be fetched, and tries again', async () => {
    const user = userEvent.setup();
    const { backend } = newGame({}, false);
    let tries = 0;
    renderGame({ ...backend, fetchNews: async () => (tries++ === 0 ? null : [{ day: '2026-10-19', kind: 'village', line: 'A quiet day.' }]) });
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('n');
    expect(await screen.findByText(/couldn’t fetch that just now/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('A quiet day.')).toBeInTheDocument();
  });

  it('shows the Warriors list with levels and stars only, and you in it', async () => {
    const user = userEvent.setup();
    const { backend } = newGame({}, false);
    renderGame({
      ...backend,
      fetchWarriors: async () => [
        { place: 1, display_name: 'Brave Tui', avatar: null, level: 7, stars: 2, dragons: 1, is_me: false },
        { place: 2, display_name: 'Brave Kiwi', avatar: null, level: 5, stars: 0, dragons: 0, is_me: true },
        { place: 11, display_name: 'Quiet Moa', avatar: null, level: 1, stars: 0, dragons: 0, is_me: false },
      ],
    });
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('w');
    const list = await screen.findByRole('list', { name: 'Warriors this season' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(list).toHaveTextContent('Brave Tui');
    expect(list).toHaveTextContent('Level 7');
    expect(within(list).getByLabelText('2 dragon stars')).toHaveTextContent('★★');
    expect(list.querySelector('.is-me')).toHaveTextContent('(you)');
    expect(screen.getByRole('region', { name: 'The Warriors list' })).toHaveTextContent('never maths');
  });

  it('shows the Hall of Heroes season by season, or an empty hall', async () => {
    const user = userEvent.setup();
    const { backend } = newGame({}, false);
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    await user.keyboard('g');
    expect(await screen.findByText(/The Hall is empty/)).toBeInTheDocument();
    cleanup();
    const filled = newGame({}, false);
    renderGame({
      ...filled.backend,
      fetchHall: async () => [
        { season: 2, display_name: 'Brave Kiwi', avatar: null, kills: 2, is_me: true },
        { season: 1, display_name: 'Brave Tui', avatar: null, kills: 1, is_me: false },
      ],
    });
    await user.click(await screen.findByRole('button', { name: /Mage/ }));
    await village();
    await user.keyboard('g');
    const hall = await screen.findByRole('region', { name: 'The Hall of Heroes' });
    expect(within(hall).getByRole('heading', { name: 'Season 2' })).toBeInTheDocument();
    expect(hall).toHaveTextContent('beat the dragon 2 times');
    expect(hall).toHaveTextContent('beat the dragon');
  });

  it('counts down the last days of a season', async () => {
    const user = userEvent.setup();
    const db = emptyDb({ enabled: true, seasonStart: '2026-09-19' });
    const backend = createLocalBackend(db, { trial: false, now: () => Date.parse('2026-10-19T00:00:00Z') });
    renderGame(backend);
    await user.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    expect(screen.getAllByText(/4 days left/).length).toBeGreaterThan(0);
  });

  it('says when a fight left alone for a whole day counted as a loss', async () => {
    const { backend } = newGame({}, false);
    renderGame({ ...backend, load: async () => ({ ...(await backend.load()), abandoned: 'forest' }) as never });
    await userEvent.click(await screen.findByRole('button', { name: /Knight/ }));
    await village();
    expect(screen.getByText(/left unfinished counted as a loss after a day/)).toBeInTheDocument();
  });

  it('shows arena fights left on the status bar and the lifetime counts on the hero page', async () => {
    const { user } = await inVillage();
    expect(screen.getByRole('list', { name: /at a glance/i })).toHaveTextContent('Arena 3');
    await user.keyboard('y');
    expect(await screen.findByText('All your seasons')).toBeInTheDocument();
    expect(screen.getByText(/0 forest fights won/)).toBeInTheDocument();
  });
});

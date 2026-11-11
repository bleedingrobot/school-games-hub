import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/space/engine';
import { launchLive, type LiveGame, type Played } from '../../../shared/space/live';
import { randomFromSeed, seededDice } from '../../../shared/space/random';
import * as data from '../../data/spaceGames';
import type { SpaceGame } from '../../data/spaceGames';
import type { SpaceSession } from '../../space/useSpaceGame';
import { SoundProvider } from '../../sound';
import { SpaceLive } from './SpaceLive';

vi.mock('../../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/spaceGames')>()),
  fetchSpaceLog: vi.fn(async () => []),
  fetchReactionsEnabled: vi.fn(async () => false),
}));

const SETUP = { board: { id: 'nebula' as const }, settings: DEFAULT_SETTINGS };
const dice = seededDice('live-test');
const random = randomFromSeed('live-test:bots');

/** A game row as the server would save it, with "me" and "them" (and maybe a bot). */
function row(played: Played, version: number, players: (string | null)[], extra: Partial<SpaceGame> = {}): SpaceGame {
  const seats = [...players, null, null, null].slice(0, 4);
  return {
    id: 'g1',
    code: 'KMTPX',
    in_lobby: false,
    host: 'me',
    seat1: seats[0],
    seat2: seats[1],
    seat3: seats[2],
    seat4: seats[3],
    status: played.game.state.phase === 'over' ? 'finished' : 'playing',
    setup: SETUP,
    rockets: played.game.seats.length,
    seat_info: played.game.seats,
    state: played.game.state,
    events: played.events,
    actions: played.actions,
    version,
    created_at: '2026-10-20T09:00:00Z',
    expires_at: '2026-10-20T09:10:00Z',
    started_at: '2026-10-20T09:00:00Z',
    turn_deadline: new Date(Date.now() + 30_000).toISOString(),
    last_action_at: null,
    finished_at: null,
    ending: null,
    places: null,
    counts: null,
    reactions: { last: null, sent: [0, 0, 0, 0], at: [0, 0, 0, 0] },
    rematch_game: null,
    ...extra,
  };
}

function session(game: SpaceGame, overrides: Partial<SpaceSession> = {}): SpaceSession {
  return {
    game,
    me: 'me',
    mySeat: [game.seat1, game.seat2, game.seat3, game.seat4].indexOf('me'),
    cards: new Map([
      ['me', { id: 'me', display_name: 'Speedy Otter 27', avatar: {} }],
      ['them', { id: 'them', display_name: 'Brave Kiwi 7', avatar: {} }],
    ]),
    live: 'live',
    present: ['me', 'them'],
    serverNow: () => Date.now(),
    busy: false,
    message: '',
    clearMessage: () => {},
    act: vi.fn(async () => true),
    ask: vi.fn(async () => {
      throw new Error('no maths in this test');
    }),
    reload: async () => {},
    ...overrides,
  };
}

const wrap = (node: ReactNode) => (
  <SoundProvider>
    <MemoryRouter>{node}</MemoryRouter>
  </SoundProvider>
);

/** Starts a game where it's "me" to play first. */
function myTurnGame(players: (string | null)[] = ['me', 'them']): { game: LiveGame; first: SpaceGame } {
  for (let n = 0; n < 50; n++) {
    const played = launchLive(SETUP, players, dice, random);
    if (players[played.game.state.turn] === 'me') return { game: played.game, first: row(played, 1, players) };
  }
  throw new Error('never my turn');
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(data.fetchReactionsEnabled).mockResolvedValue(false);
});

describe('Wormholes & Black Holes with classmates', () => {
  it('lets me roll on my turn, sending the version I can see', async () => {
    const user = userEvent.setup();
    const { first } = myTurnGame();
    const s = session(first);
    render(wrap(<SpaceLive session={s} timeScale={0} />));
    const roll = await screen.findByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    expect(screen.getByRole('status')).toHaveTextContent('Your turn!');
    await user.click(roll);
    expect(s.act).toHaveBeenCalledWith({ action: 'roll', gameId: 'g1', version: 1 });
  });
});

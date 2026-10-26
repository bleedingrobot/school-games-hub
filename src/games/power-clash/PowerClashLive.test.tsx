import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { newLiveGame, TURN_MS, type LiveGame } from '../../../shared/power-clash/live';
import type { PowerId } from '../../../shared/power-clash/types';
import type { PowerGame } from '../../data/powerGames';
import type { PowerSession } from '../../power-clash/usePowerGame';
import { SoundProvider } from '../../sound';
import { PowerClashLive } from './PowerClashLive';

const START = Date.parse('2026-10-20T09:00:00Z');
const ANA: PowerId[] = ['wild-card', 'body-swap', 'freeze-ray'];
const BEN: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];

/** Ana is X (seat 0), Ben is O (seat 1). */
function rowOf(game: LiveGame, over: Partial<PowerGame> = {}): PowerGame {
  return {
    id: 'g1', code: null, in_lobby: false, host: 'ana', seat1: 'ana', seat2: 'ben', first_player: null,
    loadouts: [ANA, BEN], status: 'playing', game, events: [], version: 5, created_at: '', expires_at: '',
    started_at: new Date(START).toISOString(), deadline: new Date(START + TURN_MS).toISOString(), last_action_at: null,
    finished_at: null, ending: null, leaver: null, won: null, counts: null, stats: null, rematch_game: null, ...over,
  };
}

function sessionFor(row: PowerGame, seat: 0 | 1, over: Partial<PowerSession> = {}, clock = { now: START }) {
  const act = vi.fn(async () => true);
  const session: PowerSession = {
    game: row,
    me: seat === 0 ? 'ana' : 'ben',
    mySeat: seat,
    cards: new Map([
      ['ana', { id: 'ana', display_name: 'Ana Kiwi', avatar: {} }],
      ['ben', { id: 'ben', display_name: 'Ben Tui', avatar: {} }],
    ]) as PowerSession['cards'],
    live: 'live',
    present: ['ana', 'ben'],
    serverNow: () => clock.now,
    busy: false,
    message: '',
    clearMessage: () => {},
    act,
    reload: async () => {},
    ...over,
  };
  return { session, act, clock };
}

const ui = (session: PowerSession) => (
  <SoundProvider>
    <MemoryRouter>
      <PowerClashLive session={session} tick={20} />
    </MemoryRouter>
  </SoundProvider>
);
const show = (session: PowerSession) => render(ui(session));

const cell = (n: number) => screen.getByRole('button', { name: new RegExp(`Row ${Math.floor((n - 1) / 3) + 1}, column ${((n - 1) % 3) + 1}:`) });

beforeEach(() => {
  // Reduced motion keeps the animation lock to a blink.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

it('sends the move with the version it was looking at, draws nothing itself, and is locked on their turn', async () => {
  const user = userEvent.setup();
  const { session, act } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
  show(session);
  await user.click(cell(5));
  expect(act).toHaveBeenCalledWith({ action: 'place', gameId: 'g1', version: 5, square: 4 });
  // The page waits for the server: the square is still empty on screen.
  expect(cell(5)).toHaveTextContent('');
  const theirs = sessionFor(rowOf(newLiveGame(ANA, BEN)), 1);
  show(theirs.session);
  expect(screen.getByText('Waiting for Ana Kiwi…')).toBeInTheDocument();
});

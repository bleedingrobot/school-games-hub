import { act as reactAct, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { botAction } from '../../../shared/space/bot';
import { DEFAULT_SETTINGS } from '../../../shared/space/engine';
import { launchLive, playerAction, type LiveGame, type Played } from '../../../shared/space/live';
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

  it('waits while it’s someone else’s turn, then plays what happened', async () => {
    const { game, first } = myTurnGame();
    const s = session(first);
    const view = render(wrap(<SpaceLive session={s} timeScale={0} />));
    // I roll: now it's Brave Kiwi's turn.
    const mine = playerAction(game, { kind: 'roll' }, dice, random);
    const second = row(mine, 2, ['me', 'them']);
    view.rerender(wrap(<SpaceLive session={session(second)} timeScale={0} />));
    const log = screen.getByRole('log');
    await waitFor(() => expect(log).toHaveTextContent(/Speedy Otter 27 rolled/));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Brave Kiwi 7’s turn'));
    expect(screen.getByRole('button', { name: /^🎲 Roll/ })).toBeDisabled();
  });

  it('names bots, and marks a classmate who has gone away', async () => {
    const { first } = myTurnGame(['me', null, 'them']);
    render(wrap(<SpaceLive session={session(first, { present: ['me'] })} timeScale={0} />));
    const rockets = await screen.findByRole('region', { name: /^Rockets/ });
    expect(rockets).toHaveTextContent('Pilot Kea · bot');
    expect(rockets).toHaveTextContent('Brave Kiwi 7 · away');
  });

  it('offers the controls back when autopilot is flying my rocket', async () => {
    const user = userEvent.setup();
    const { first } = myTurnGame();
    const seats = structuredClone(first.seat_info!);
    seats[0] = { ...seats[0], autopilot: true, left: true };
    const s = session({ ...first, seat_info: seats });
    render(wrap(<SpaceLive session={s} timeScale={0} />));
    await user.click(await screen.findByRole('button', { name: /Take the controls/ }));
    expect(s.act).toHaveBeenCalledWith({ action: 'take-controls', gameId: 'g1' });
  });

  it('tells the server when the clock runs out (the next player’s page first)', async () => {
    // It's "them" to play (seat 0) and I'm next, so my page asks half a second after the deadline.
    const first = row(launchLive(SETUP, ['them', 'me'], dice, random), 1, ['them', 'me']);
    const late = { ...first, turn_deadline: new Date(Date.now() - 1000).toISOString() };
    const s = session(late);
    render(wrap(<SpaceLive session={s} timeScale={0} />));
    await waitFor(() => expect(s.act).toHaveBeenCalledWith({ action: 'times-up', gameId: 'g1' }), { timeout: 2000 });
  });

  it('shows the podium at the end, with a rematch', async () => {
    const user = userEvent.setup();
    let { game } = myTurnGame();
    let played: Played | null = null;
    for (let n = 0; game.state.phase !== 'over'; n++) {
      played = playerAction(game, botAction(game.state, 'easy', random), dice, random);
      game = played.game;
    }
    const end = row(played!, 2, ['me', 'them'], {
      status: 'finished',
      ending: game.state.ending,
      places: game.state.places,
      counts: [true, true],
      turn_deadline: null,
    });
    const s = session(end);
    render(wrap(<SpaceLive session={s} timeScale={0} />));
    const podium = await screen.findByRole('dialog');
    expect(podium).toHaveTextContent(/You (docked first|got the furthest|came 2nd)/);
    expect(podium).toHaveTextContent('Taking part earns points');
    await user.click(within(podium).getByRole('button', { name: 'Rematch' }));
    expect(s.act).toHaveBeenCalledWith({ action: 'rematch', gameId: 'g1' });
  });

  it('shows reactions only when the teacher has switched them on, and pops them over the rocket', async () => {
    vi.mocked(data.fetchReactionsEnabled).mockResolvedValue(true);
    const user = userEvent.setup();
    const { first } = myTurnGame();
    const s = session(first);
    const view = render(wrap(<SpaceLive session={s} timeScale={0} />));
    const group = await screen.findByRole('group', { name: 'Send a reaction' });
    expect(within(group).getAllByRole('button')).toHaveLength(7); // 6 emoji and "hide"
    await user.click(within(group).getByRole('button', { name: 'Send 🎉' }));
    expect(s.act).toHaveBeenCalledWith({ action: 'react', gameId: 'g1', emoji: '🎉' });
    expect(within(group).getByRole('button', { name: 'Send 👍' })).toBeDisabled(); // one every 5 seconds

    const reacted = { ...first, reactions: { last: { seat: 1, emoji: '👏', id: 1 }, sent: [0, 1, 0, 0], at: [0, 0, 0, 0] } };
    view.rerender(wrap(<SpaceLive session={session(reacted)} timeScale={0} />));
    await waitFor(() => expect(document.querySelector('.rocket__bubble')).toHaveTextContent('👏'));

    // Hiding them is remembered on this device.
    await user.click(within(group).getByRole('button', { name: 'Hide reactions' }));
    expect(localStorage.getItem('sgh-space-hide-reactions')).toBe('true');
    expect(document.querySelector('.rocket__bubble')).toBeNull();
  });

  it('has no reaction buttons while they’re switched off', async () => {
    const { first } = myTurnGame();
    render(wrap(<SpaceLive session={session(first)} timeScale={0} />));
    await screen.findByRole('button', { name: /^🎲 Roll/ });
    await reactAct(async () => {});
    expect(screen.queryByRole('group', { name: 'Send a reaction' })).not.toBeInTheDocument();
  });
});

describe('Mission Control maths with classmates', () => {
  const MATHS = { board: { id: 'nebula' as const }, settings: { ...DEFAULT_SETTINGS, maths: true } };
  const question = { id: 1, skill: 'times-tables', kind: 'multiply', parts: ['7', '×', '8', '=', '?'], spoken: '7 times 8 equals what?' };

  /** A maths game where it's my turn. */
  function mathsTurn(): { game: LiveGame; first: SpaceGame } {
    for (let n = 0; n < 50; n++) {
      const played = launchLive(MATHS, ['me', 'them'], dice, random);
      if (played.game.state.turn === 0) return { game: played.game, first: row(played, 1, ['me', 'them'], { setup: MATHS }) };
    }
    throw new Error('never my turn');
  }

  it('asks the server for the wormhole question when I land on one, and sends back what I type', async () => {
    const user = userEvent.setup();
    const { first } = mathsTurn();
    const state = structuredClone(first.state!);
    const wormhole = Number(Object.entries(state.board.squares).find(([, q]) => q.kind === 'wormhole')![0]);
    state.rockets[0].position = wormhole;
    state.phase = 'choice';
    state.pending = { kind: 'question', square: wormhole, moment: 'wormhole' };
    state.turnInfo.rolled = true;
    const ask = vi.fn(async (request: data.SpaceAction): Promise<data.SpaceMathsReply> =>
      request.action === 'question'
        ? { game: first, question }
        : { game: first, right: true, answer: 56 },
    );
    render(wrap(<SpaceLive session={session({ ...first, state }, { ask })} timeScale={0} />));
    const box = await screen.findByRole('dialog', { name: 'Wormhole boost' });
    expect(ask).toHaveBeenCalledWith({ action: 'question', gameId: 'g1', kind: 'moment', version: 1 });
    expect(box).toHaveTextContent('⏱');
    await user.click(within(box).getByRole('button', { name: '5' }));
    await user.click(within(box).getByRole('button', { name: '6' }));
    await user.click(within(box).getByRole('button', { name: 'Check my answer' }));
    await waitFor(() =>
      expect(ask).toHaveBeenCalledWith(expect.objectContaining({ action: 'answer', kind: 'moment', answer: 56, version: 1 })),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Wormhole boost' })).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows the after-turn question on the side card once I’ve finished a turn, and says nothing about a wrong answer', async () => {
    const user = userEvent.setup();
    const { game } = mathsTurn();
    const mine = playerAction(game, { kind: 'roll' }, dice, random);
    const next = row(mine, 2, ['me', 'them'], { setup: MATHS });
    expect(next.seat_info![0].stats.turns).toBe(1);
    const ask = vi.fn(async (request: data.SpaceAction): Promise<data.SpaceMathsReply> =>
      request.action === 'question' ? { game: next, question } : { game: next, right: false, answer: 56 },
    );
    render(wrap(<SpaceLive session={session(next, { ask })} timeScale={0} />));
    const card = await screen.findByRole('region', { name: 'Mission Control question' });
    expect(ask).toHaveBeenCalledWith({ action: 'question', gameId: 'g1', kind: 'charge' });
    // It's a card on the page, not a pop-up.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: '1' }));
    await user.click(within(card).getByRole('button', { name: 'Check my answer' }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith(expect.objectContaining({ action: 'answer', kind: 'charge', answer: 1 })));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Mission Control question' })).not.toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByText(/charged/i)).not.toBeInTheDocument();
  });

  it('says "+1 charged" on my turn when the server has added it', async () => {
    const { first } = mathsTurn();
    const state = structuredClone(first.state!);
    state.turnInfo.mathsCharge = true;
    render(wrap(<SpaceLive session={session({ ...first, state })} timeScale={0} />));
    expect(await screen.findByText('⚡ +1 charged from your answer')).toBeInTheDocument();
  });

  it('asks nothing when maths is off', async () => {
    const { first } = myTurnGame();
    const s = session(first);
    render(wrap(<SpaceLive session={s} timeScale={0} />));
    await screen.findByRole('button', { name: /^🎲 Roll/ });
    await reactAct(async () => {});
    expect(s.ask).not.toHaveBeenCalled();
  });
});

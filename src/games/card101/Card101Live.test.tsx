import { act as reactAct, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame, play, type Action, type Game } from '../../../shared/card101/engine';
import { GRACE_MS, type PublicInfo, type SeatRow } from '../../../shared/card101/live';
import { seededDice } from '../../../shared/card101/random';
import { viewFor } from '../../../shared/card101/view';
import type { CardSession } from '../../card101/useCardGame';
import { SoundProvider } from '../../sound';
import { Card101Live } from './Card101Live';

const START = Date.parse('2026-10-20T09:00:00Z');

/** A 3-player game seen from seat 1 (Ben), with the server's moves played by the test. */
function table(prepare: (step: (actor: number | 'system', action: Action) => void, game: () => Game) => void = () => {}) {
  const dice = seededDice('live-test');
  let game = newGame(3, { target: 50 }, dice).game;
  const step = (actor: number | 'system', action: Action) => (game = play(game, actor, action, dice).game);
  prepare(step, () => game);
  return game;
}

function sessionFor(game: Game, over: Partial<PublicInfo> = {}, clock = { now: START }) {
  const info: PublicInfo = {
    code: null,
    inLobby: false,
    host: 'ana',
    players: ['ana', 'ben', 'cat'],
    wanted: 3,
    settings: { target: 50 },
    status: game.phase === 'over' ? 'finished' : 'playing',
    version: 7,
    expiresAt: '',
    deadline: new Date(START + 15_000).toISOString(),
    ready: null,
    ending: game.phase === 'over' ? 'finished' : null,
    places: null,
    counts: null,
    rematchGame: null,
    ...over,
  };
  const seat: SeatRow = { game: 'g1', player: 'ben', seat: 1, version: 7, status: info.status, info, view: viewFor(game, 1), events: [], log: [] };
  const act = vi.fn(async () => true);
  const session: CardSession = {
    seat,
    me: 'ben',
    cards: new Map([
      ['ana', { id: 'ana', display_name: 'Ana Kiwi', avatar: {} }],
      ['cat', { id: 'cat', display_name: 'Cat Tui', avatar: {} }],
    ]) as CardSession['cards'],
    live: 'live',
    present: null,
    serverNow: () => clock.now,
    busy: false,
    message: '',
    clearMessage: () => {},
    act,
    reload: async () => {},
  };
  return { session, act };
}

function show(session: CardSession) {
  return render(
    <SoundProvider>
      <MemoryRouter>
        <Card101Live session={session} />
      </MemoryRouter>
    </SoundProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe('101 with classmates: the table', () => {
  it('my cards are at the bottom whatever my seat, and the peek asks the server', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(table());
    show(session);
    const mine = screen.getByRole('group', { name: 'Your four cards' });
    expect(within(mine).getAllByRole('button')[2]).toHaveAccessibleName(/bottom left: .+ of .+, face up/);
    expect(screen.getByRole('region', { name: 'Ana Kiwi’s cards' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remembered them/ }));
    expect(act).toHaveBeenCalledWith({ action: 'peek-done', gameId: 'g1' });
  });

  it('on my turn, moves carry the version I was looking at', async () => {
    const user = userEvent.setup();
    const game = table((step, g) => {
      for (const s of [0, 1, 2]) step(s, { type: 'peek-done' });
      while (g().turn !== 1) {
        step(g().turn, { type: 'draw', from: 'stack' });
        step(g().turn, { type: 'throw' });
      }
    });
    const { session, act } = sessionFor(game, { deadline: new Date(START + 60_000).toISOString() });
    show(session);
    expect(screen.getByRole('status')).toHaveTextContent('Your turn!');
    await user.click(screen.getByRole('button', { name: /^Stack:/ }));
    expect(act).toHaveBeenCalledWith({ action: 'draw', gameId: 'g1', version: 7, from: 'stack' });
  });

  it('when the clock runs out, asks the server once (it checks its own clock)', async () => {
    vi.useFakeTimers();
    const clock = { now: START };
    const game = table((step) => {
      for (const s of [0, 1, 2]) step(s, { type: 'peek-done' });
    });
    const { session, act } = sessionFor(game, { deadline: new Date(START + 60_000).toISOString() }, clock);
    show(session);
    await reactAct(async () => vi.advanceTimersByTime(1000));
    expect(act).not.toHaveBeenCalled();
    clock.now = START + 60_000 + GRACE_MS + 10;
    await reactAct(async () => vi.advanceTimersByTime(1000));
    await reactAct(async () => vi.advanceTimersByTime(1000));
    expect(act).toHaveBeenCalledTimes(1);
    expect(act).toHaveBeenCalledWith({ action: 'times-up', gameId: 'g1' });
  });

  it('between rounds: the scores, then Next tells the server I’m ready', async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, 'error');
    const game = table((step, g) => {
      for (const s of [0, 1, 2]) step(s, { type: 'peek-done' });
      while (g().phase === 'play') {
        const t = g().turn;
        if (g().turnsThisRound.every((n) => n >= 1) && g().knocker === null) step(t, { type: 'knock' });
        else {
          step(t, { type: 'draw', from: 'stack' });
          step(t, { type: 'throw' });
        }
      }
    });
    expect(game.phase).toBe('round-over');
    const { session, act } = sessionFor(game, { ready: [false, false, false], deadline: new Date(START + 30_000).toISOString() });
    show(session);
    await user.click(screen.getByRole('button', { name: 'Scores' }));
    const scores = screen.getByRole('dialog', { name: 'Round 1 scores' });
    await user.click(within(scores).getByRole('button', { name: 'Skip' }));
    await user.click(within(scores).getByRole('button', { name: /Next round/ }));
    expect(act).toHaveBeenCalledWith({ action: 'next', gameId: 'g1' });
    // (Round 1, seat 1: the scores panel and my seat once shared a key.)
    expect(errors.mock.calls.filter((c) => String(c[0]).includes('same key'))).toEqual([]);
  });

  it('at the end: places from the server, points, and Rematch', async () => {
    const user = userEvent.setup();
    const game = table((step) => step(0, { type: 'leave' }));
    const finished = play(game, 2, { type: 'leave' }, () => 1).game;
    const { session, act } = sessionFor(finished, { places: [0, 1, 0], counts: [false, false, false], status: 'finished', ending: 'finished' });
    show(session);
    const podium = screen.getByRole('dialog', { name: /You won!/ });
    expect(within(podium).getByRole('status')).toHaveTextContent('too short to earn points');
    await user.click(within(podium).getByRole('button', { name: 'Rematch' }));
    expect(act).toHaveBeenCalledWith({ action: 'rematch', gameId: 'g1' });
  });
});

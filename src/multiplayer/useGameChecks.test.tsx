import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveStatus } from '../data/multiplayer';
import { CHECK_EVERY_MS, checkGap, useGameChecks } from './useGameChecks';

/**
 * Server load S.3: games with classmates check for missed changes less and less often while live updates are broken, spread out
 * so a class doesn't ask in step, never in a hidden tab, and back to normal as soon as live updates work again.
 */

// What each game's live-updates channel told it last, so a test can break and mend it.
const { onLive, capture, playing } = vi.hoisted(() => {
  const onLive: ((status: LiveStatus) => void)[] = [];
  const capture = (_id: string, _me: string, handlers: { onLive: (s: LiveStatus) => void }) => (onLive.push(handlers.onLive), { stop() {} });
  const playing = { id: 'g1', status: 'playing', version: 1, seat1: 'me', seat2: 'ben', first_player: 'me', second_player: 'ben', rematch_game: null };
  return { onLive, capture, playing };
});

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'me' } }) }));
vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  fetchFriendGame: vi.fn(async () => ({ ...playing, game: 'chess' })),
  watchGame: vi.fn(capture),
  fetchClockOffset: vi.fn(async () => 0),
  fetchPlayerCards: vi.fn(async () => new Map()),
}));
vi.mock('../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/spaceGames')>()),
  fetchSpaceGame: vi.fn(async () => ({ ...playing, state: {} })),
  watchSpaceGame: vi.fn(capture),
}));
vi.mock('../data/cardGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/cardGames')>()),
  fetchMySeat: vi.fn(async () => ({ game: 'g1', player: 'me', seat: 0, version: 1, status: 'playing', info: { players: ['me', 'ben'] }, view: null, events: [], log: [] })),
  watchCardGame: vi.fn(capture),
}));
vi.mock('../data/powerGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/powerGames')>()),
  fetchPowerGame: vi.fn(async () => ({ ...playing, game: {} })),
  watchPowerGame: vi.fn(capture),
}));

import * as cards from '../data/cardGames';
import * as friends from '../data/multiplayer';
import * as power from '../data/powerGames';
import * as space from '../data/spaceGames';
import { useCardGame } from '../card101/useCardGame';
import { usePowerGame } from '../power-clash/usePowerGame';
import { useSpaceGame } from '../space/useSpaceGame';
import { useFriendGame } from './useFriendGame';

let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  onLive.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const SECOND = 1000;

describe('the wait between checks', () => {
  it('is 20 seconds while live updates work', () => {
    expect(checkGap(true, 0, () => 0)).toBe(20_000);
    expect(checkGap(true, 9, () => 0)).toBe(20_000);
  });

  it('is 4, 8, 16 and then 30 seconds while they are broken', () => {
    expect([0, 1, 2, 3, 4, 10].map((step) => checkGap(false, step, () => 0))).toEqual([4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
    expect(CHECK_EVERY_MS.down.at(-1)).toBe(30_000);
  });

  it('is made up to a quarter longer at random, never shorter', () => {
    expect(checkGap(false, 0, () => 0.999)).toBe(Math.round(4_000 * 1.24975));
    expect(checkGap(false, 2, () => 0.5)).toBe(18_000);
    expect(checkGap(true, 0, () => 1)).toBe(25_000);
  });

  it('is never more than 30 seconds, so an opponent\'s move always shows within 30 seconds', () => {
    for (const r of [0, 0.3, 0.7, 1]) for (let step = 0; step < 8; step++) expect(checkGap(false, step, () => r)).toBeLessThanOrEqual(30_000);
    expect(checkGap(false, 3, () => 1)).toBe(30_000);
  });
});

describe('checking a game', () => {
  function checks(start: LiveStatus = 'down') {
    const check = vi.fn();
    const view = renderHook(({ live, active }) => useGameChecks(active, live, check), { initialProps: { live: start, active: true } });
    return { check, view };
  }

  it('slows down while live updates are broken: 6 checks in 2 minutes instead of 30', async () => {
    const { check } = checks('down');
    await pass(4 * SECOND);
    expect(check).toHaveBeenCalledTimes(1);
    await pass(8 * SECOND);
    expect(check).toHaveBeenCalledTimes(2);
    await pass(16 * SECOND);
    expect(check).toHaveBeenCalledTimes(3);
    await pass(30 * SECOND);
    expect(check).toHaveBeenCalledTimes(4);
    await pass(62 * SECOND); // to 2 minutes
    expect(check).toHaveBeenCalledTimes(6);
  });

  it('goes back to every 20 seconds as soon as live updates work, and starts at 4 seconds again if they break again', async () => {
    const { check, view } = checks('down');
    await pass(60 * SECOND);
    expect(check).toHaveBeenCalledTimes(4);
    view.rerender({ live: 'live', active: true });
    await pass(19 * SECOND);
    expect(check).toHaveBeenCalledTimes(4);
    await pass(1 * SECOND);
    expect(check).toHaveBeenCalledTimes(5);
    view.rerender({ live: 'down', active: true });
    await pass(4 * SECOND);
    expect(check).toHaveBeenCalledTimes(6);
  });

  it('a connection that keeps dropping and reconnecting does not start the waits again', async () => {
    const { check, view } = checks('down');
    await pass(12 * SECOND); // checks at 4 and 12 seconds
    view.rerender({ live: 'connecting', active: true });
    await pass(3 * SECOND);
    view.rerender({ live: 'down', active: true });
    await pass(3 * SECOND);
    expect(check).toHaveBeenCalledTimes(2);
    await pass(10 * SECOND); // the next one is 16 seconds after the last
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('spreads a class out: each screen waits a little longer, at random', async () => {
    vi.mocked(Math.random).mockReturnValue(0.5);
    const { check } = checks('down');
    await pass(4 * SECOND);
    expect(check).not.toHaveBeenCalled();
    await pass(0.5 * SECOND);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('never checks in a hidden tab', async () => {
    visibility = 'hidden';
    const { check } = checks('down');
    await pass(120 * SECOND);
    expect(check).not.toHaveBeenCalled();
  });

  it('stops when the game is over', async () => {
    const { check, view } = checks('live');
    view.rerender({ live: 'live', active: false });
    await pass(120 * SECOND);
    expect(check).not.toHaveBeenCalled();
  });
});

describe('in every game with classmates', () => {
  const games: [string, () => unknown, () => unknown][] = [
    ['chess and checkers', () => useFriendGame('g1'), () => friends.fetchFriendGame],
    ['Wormholes & Black Holes', () => useSpaceGame('g1'), () => space.fetchSpaceGame],
    ['101', () => useCardGame('g1'), () => cards.fetchMySeat],
    ['Power Clash', () => usePowerGame('g1'), () => power.fetchPowerGame],
  ];

  for (const [name, hook, fetcher] of games) {
    describe(name, () => {
      it('checks 6 times in 2 minutes with live updates broken, and 6 times with them working', async () => {
        const fetched = vi.mocked(fetcher() as (...args: unknown[]) => Promise<unknown>);
        fetched.mockClear();
        renderHook(hook);
        await pass(0);
        expect(fetched).toHaveBeenCalledTimes(1); // the first load
        act(() => onLive.at(-1)!('down'));
        await pass(120 * SECOND);
        expect(fetched).toHaveBeenCalledTimes(1 + 6);
        act(() => onLive.at(-1)!('live'));
        await pass(120 * SECOND);
        expect(fetched).toHaveBeenCalledTimes(1 + 6 + 6);
      });

      it('checks nothing while hidden, and once straight away on coming back', async () => {
        const fetched = vi.mocked(fetcher() as (...args: unknown[]) => Promise<unknown>);
        fetched.mockClear();
        renderHook(hook);
        await pass(0);
        act(() => onLive.at(-1)!('down'));
        visibility = 'hidden';
        await pass(120 * SECOND);
        expect(fetched).toHaveBeenCalledTimes(1);
        visibility = 'visible';
        act(() => void document.dispatchEvent(new Event('visibilitychange')));
        await pass(0);
        expect(fetched).toHaveBeenCalledTimes(2);
      });
    });
  }
});

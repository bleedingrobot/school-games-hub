import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { findBondSet } from '../../../shared/bond-match/bonds';
import { buildDeck } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import type { BondMatchItem } from '../../../shared/bond-match/save';
import { makeHandler, type GameRow, type Services } from './handler';

const RUN = '6f1c2a54-1d3e-4b5a-9c7d-0e1f2a3b4c5d';

function services(over: Partial<Services> = {}) {
  const games: GameRow[] = [];
  const s: Services = {
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : null)),
    isOn: vi.fn(async () => true),
    recordGame: vi.fn(async (_player: string, game: GameRow) => {
      games.push(game);
      return {
        ok: true as const,
        value: {
          status: 'saved' as const,
          points: 2,
          stars: game.stars as 1 | 2 | 3,
          best: {
            flips: game.flipCount,
            seconds: game.seconds,
            stars: game.stars,
          },
        },
      };
    }),
    ...over,
  };
  return { s, games };
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'https://bleedingrobot.github.io',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/bond-match', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const perfect = (bondId = 'whole-10', size: BondMatchItem['size'] = 'small', seed = 3): BondMatchItem => ({
  runId: RUN,
  seed,
  bondId,
  size,
  seconds: 60,
  flips: perfectFlips(newGame(buildDeck(findBondSet(bondId)!, size, seed))),
});

async function send(s: Services, items: unknown[]) {
  const response = await makeHandler(s)(post({ items }));
  return { status: response.status, body: await response.json() };
}

describe('the bond-match server function', () => {
  it('needs a signed-in student', async () => {
    const { s } = services();
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
    expect((await makeHandler(s)(post({ items: [] }, 'fake-token'))).status).toBe(401);
    expect(s.recordGame).not.toHaveBeenCalled();
  });

  it('ignores stars and flip counts the browser claims (a tampered save)', async () => {
    const { s, games } = services();
    await send(s, [{ ...perfect(), stars: 1, flipCount: 99, flips_count: 1 }]);
    expect(games[0]).toMatchObject({ stars: 3, flipCount: 6 });
    // A messy game really is worse: bronze here is the replay's verdict.
    const mess = perfect();
    const deck = newGame(buildDeck(findBondSet('whole-10')!, 'small', 3)).deck;
    const wrong = deck.cards.findIndex((c, j) => j > 0 && c.pair !== deck.cards[0].pair);
    const flips = [...Array(12).fill([0, wrong]).flat(), ...mess.flips];
    await send(s, [{ ...mess, flips, seconds: 900 }]);
    expect(games[1]).toMatchObject({ flipCount: 18, stars: 1 });
  });

  it('drops bad games for good and carries on', async () => {
    const cases: [string, object][] = [
      ['a doctored flip list', { flips: [0, 0, 0] }],
      ['a game that did not finish', { flips: [0, 1] }],
      ['the wrong seed for those flips', { seed: 4 }],
      ['an unknown bond', { bondId: 'whole-7' }],
      ['an unknown size', { size: 'huge' }],
      ['a bad run id', { runId: 'not-a-uuid' }],
      ['a negative time', { seconds: -5 }],
      ['a game faster than a human', { seconds: 1 }],
    ];
    for (const [, over] of cases) {
      const { s } = services();
      const { body } = await send(s, [{ ...perfect(), ...over }, perfect('whole-20')]);
      expect(body.handled).toBe(2);
      expect(body.results[0].status).toBe('invalid');
      expect(body.results[1].status).toBe('saved');
      expect(s.recordGame).toHaveBeenCalledTimes(1);
    }
  });

  it('passes on a duplicate (the same run sent again) as the database answers it', async () => {
    const { s } = services({
      recordGame: vi.fn(async () => ({
        ok: true as const,
        value: {
          status: 'duplicate' as const,
          points: 2,
          stars: 3 as const,
          best: { flips: 6, seconds: 60, stars: 3 },
        },
      })),
    });
    const { body } = await send(s, [perfect(), perfect()]);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate']);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `node scripts/build-bond-match.mjs` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('bond-match');
    expect(readFileSync(resolve('supabase/functions/bond-match/index.ts'), 'utf8')).toBe(built);
  });
});

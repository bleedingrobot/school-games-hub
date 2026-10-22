import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { findBondSet } from '../../../shared/bond-match/bonds';
import { buildDeck } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import { BOND_MATCH_SAVE, MAX_ITEMS, minSecondsFor, type BondMatchItem } from '../../../shared/bond-match/save';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type GameRow, type Services } from './handler';

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
        value: { status: 'saved' as const, points: 2, stars: game.stars as 1 | 2 | 3, best: { flips: game.flipCount, seconds: game.seconds, stars: game.stars } },
      };
    }),
    ...over,
  };
  return { s, games };
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/bond-match', { method: 'POST', headers, body: JSON.stringify(body) });
}

const perfect = (bondId = 'whole-10', size: BondMatchItem['size'] = 'small', seed = 3): BondMatchItem => ({
  runId: RUN, seed, bondId, size, seconds: 60,
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

  it('saves nothing while Bond Match is switched off for the class, so the website keeps its queue', async () => {
    const { s } = services({ isOn: vi.fn(async () => false) });
    const { status, body } = await send(s, [perfect()]);
    expect(status).toBe(403);
    expect(body.error).toMatch(/switched on/);
    expect(s.recordGame).not.toHaveBeenCalled();
  });

  it('says "try later" when the class settings can\'t be read', async () => {
    const { s } = services({ isOn: vi.fn(async () => null) });
    expect((await send(s, [perfect()])).status).toBe(503);
    expect(s.recordGame).not.toHaveBeenCalled();
  });

  it('passes on the game mode: solo when left out, two-player and computer games as sent', async () => {
    const { s, games } = services();
    await send(s, [perfect(), { ...perfect('whole-20'), mode: 'pass' }, { ...perfect('whole-100-tens'), mode: 'bot' }]);
    expect(games.map((g) => g.mode)).toEqual(['solo', 'pass', 'bot']);
  });

  it('drops an unknown game mode', async () => {
    const { s } = services();
    const { body } = await send(s, [{ ...perfect(), mode: 'online' }]);
    expect(body.results[0]).toEqual({ status: 'invalid', problem: 'bad mode' });
    expect(s.recordGame).not.toHaveBeenCalled();
  });

  it('only answers POST, and says hello to a browser check', async () => {
    const { s } = services();
    expect((await makeHandler(s)(new Request('http://x/bond-match', { method: 'GET' }))).status).toBe(405);
    expect((await makeHandler(s)(new Request('http://x/bond-match', { method: 'OPTIONS', headers: { Origin: 'https://bleedingrobot.github.io' } }))).status).toBe(204);
  });

  it('saves a good game, with the server\'s own flips and stars', async () => {
    const { s, games } = services();
    const item = perfect();
    const { status, body } = await send(s, [item]);
    expect(status).toBe(200);
    expect(body.handled).toBe(1);
    expect(body.results[0]).toMatchObject({ status: 'saved', points: 2, stars: 3 });
    expect(games[0]).toMatchObject({ runId: RUN, bondId: 'whole-10', size: 'small', seed: 3, flipCount: 6, stars: 3, seconds: 60 });
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

  it.each([
    ['a doctored flip list', { flips: [0, 0, 0] }],
    ['a game that did not finish', { flips: [0, 1] }],
    ['the wrong seed for those flips', { seed: 4 }],
    ['an unknown bond', { bondId: 'whole-7' }],
    ['an unknown size', { size: 'huge' }],
    ['a bad run id', { runId: 'not-a-uuid' }],
    ['a negative time', { seconds: -5 }],
    ['a game faster than a human', { seconds: 1 }],
  ])('drops %s for good and carries on', async (_what, over) => {
    const { s } = services();
    const { body } = await send(s, [{ ...perfect(), ...over }, perfect('whole-20')]);
    expect(body.handled).toBe(2);
    expect(body.results[0].status).toBe('invalid');
    expect(body.results[1].status).toBe('saved');
    expect(s.recordGame).toHaveBeenCalledTimes(1);
  });

  it('takes a game right at the speed limit', async () => {
    const { s } = services();
    const item = perfect();
    const { body } = await send(s, [{ ...item, seconds: Math.ceil(minSecondsFor(item.flips.length)) }]);
    expect(body.results[0].status).toBe('saved');
  });

  it('passes on a duplicate (the same run sent again) as the database answers it', async () => {
    const { s } = services({
      recordGame: vi.fn(async () => ({
        ok: true as const,
        value: { status: 'duplicate' as const, points: 2, stars: 3 as const, best: { flips: 6, seconds: 60, stars: 3 } },
      })),
    });
    const { body } = await send(s, [perfect(), perfect()]);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate']);
  });

  it('drops a game the database refuses, and carries on', async () => {
    let n = 0;
    const { s } = services({
      recordGame: vi.fn(async () => (n++ === 0
        ? { ok: false as const, why: 'refused' as const }
        : { ok: true as const, value: { status: 'saved' as const, points: 2, stars: 3 as const, best: { flips: 6, seconds: 60, stars: 3 } } })),
    });
    const { body } = await send(s, [perfect(), perfect('whole-20')]);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['invalid', 'saved']);
  });

  it('stops at the daily limit, or when the database is busy, and keeps the rest of the queue', async () => {
    for (const why of ['too-many', 'busy'] as const) {
      let n = 0;
      const { s } = services({
        recordGame: vi.fn(async () => (n++ === 0
          ? { ok: true as const, value: { status: 'saved' as const, points: 2, stars: 3 as const, best: { flips: 6, seconds: 60, stars: 3 } } }
          : { ok: false as const, why })),
      });
      const { status, body } = await send(s, [perfect(), perfect('whole-20'), perfect('whole-100-tens')]);
      expect(status).toBe(200);
      expect(body.handled).toBe(1);
      expect(s.recordGame).toHaveBeenCalledTimes(2);
    }
    const down = services({ recordGame: vi.fn(async () => ({ ok: false as const, why: 'busy' as const })) });
    expect((await send(down.s, [perfect()])).status).toBe(503);
  });

  it('refuses a request that cannot be read, or has too many games', async () => {
    const { s } = services();
    expect((await makeHandler(s)(post({ nope: 1 }))).status).toBe(400);
    expect((await makeHandler(s)(post({ items: 'x' }))).status).toBe(400);
    expect((await send(s, Array(MAX_ITEMS + 1).fill(perfect()))).status).toBe(400);
    expect((await makeHandler(s)(new Request('http://x/bond-match', { method: 'POST', headers: { Authorization: 'Bearer good-token' }, body: '{{{' }))).status).toBe(400);
  });

  it('limits how often one student can ask', async () => {
    const { s } = services();
    const handler = makeHandler(s, () => 1_000_000);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) expect((await handler(post({ items: [] }))).status).toBe(200);
    expect((await handler(post({ items: [] }))).status).toBe(429);
  });

  it('never touches fact records: it has no way to (its only services are the sign-in, the switch and recordGame)', () => {
    const { s } = services();
    expect(Object.keys(s).sort()).toEqual(['isOn', 'recordGame', 'userIdFor']);
    expect(BOND_MATCH_SAVE.pointsPerGame).toBe(2);
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

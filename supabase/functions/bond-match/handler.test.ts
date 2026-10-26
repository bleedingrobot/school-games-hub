import { describe, expect, it, vi } from 'vitest';
import { findBondSet } from '../../../shared/bond-match/bonds';
import { buildDeck } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import type { BondMatchItem } from '../../../shared/bond-match/save';
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
  it('needs a signed-in student, saves nothing while switched off, and limits how often one student can ask', async () => {
    const { s } = services();
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
    expect((await makeHandler(s)(post({ items: [] }, 'fake-token'))).status).toBe(401);
    const off = services({ isOn: vi.fn(async () => false) }).s;
    expect((await send(off, [perfect()])).status).toBe(403);
    expect(off.recordGame).not.toHaveBeenCalled();
    const handler = makeHandler(s, () => 1_000_000);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) expect((await handler(post({ items: [] }))).status).toBe(200);
    expect((await handler(post({ items: [] }))).status).toBe(429);
    expect(s.recordGame).not.toHaveBeenCalled();
  });

  it('saves the server\'s own flips and stars, not the browser\'s, and drops doctored or too-fast games', async () => {
    const { s, games } = services();
    const { body } = await send(s, [
      { ...perfect(), stars: 1, flipCount: 99 },
      { ...perfect(), flips: [0, 0, 0] },
      { ...perfect(), seed: 4 },
      { ...perfect(), seconds: 1 },
    ]);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['saved', 'invalid', 'invalid', 'invalid']);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ runId: RUN, stars: 3, flipCount: 6 });
  });
});

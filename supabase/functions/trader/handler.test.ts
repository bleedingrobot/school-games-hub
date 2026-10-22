import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WATER } from '../../../shared/trader/config';
import { makeGalaxy } from '../../../shared/trader/galaxy';
import { emptyPlan } from '../../../shared/trader/plan';
import { DEFAULT_SETTINGS, newGame, type Game } from '../../../shared/trader/server';
import type { MathsContext } from '../../../shared/trader/questions';
import { nzDay, makeHandler, parseActions, type ClassSettings, type Saved, type SaveArgs, type Services, type StoredDay } from './handler';

const SEED = 'handler-test';
const galaxy = makeGalaxy(SEED);
const NOW = Date.UTC(2026, 9, 22, 1, 0, 0);
const TODAY = nzDay(NOW);

/** An in-memory stand-in for the database, with the same rules as the SQL (versions, claims saved with the game, repeats). */
function world(opts: { settings?: Partial<ClassSettings>; now?: () => number } = {}) {
  const state = {
    games: new Map<string, Saved>(),
    days: new Map<string, StoredDay>(),
    requests: new Map<string, unknown>(),
    records: [] as { once: string; answers: unknown }[],
    saves: 0,
    settings: { enabled: true, ...DEFAULT_SETTINGS, ...opts.settings } as ClassSettings,
    busy: false,
  };
  const context: MathsContext = { facts: [], settings: {} };
  const services: Services = {
    userIdFor: async (token) => (token === 'good' ? 'ana' : token === 'good2' ? 'ben' : null),
    now: opts.now ?? (() => NOW),
    randomHex: (n) => 'ab'.repeat(n),
    random: (() => {
      let i = 0;
      return () => ((i = (i * 31 + 7) % 97) + 1) / 100;
    })(),
    settings: async () => state.settings,
    schoolSeed: async () => ({ seed: SEED, season: 1 }),
    loadGame: async (p) => (state.busy ? 'busy' : structuredClone(state.games.get(p) ?? null)),
    request: async (p, id) => state.requests.get(`${p}:${id}`) ?? null,
    loadDay: async (p, d) => structuredClone(state.days.get(`${p}:${d}`) ?? null),
    storeDay: async (p, d, questions) => {
      if (!state.days.has(`${p}:${d}`)) state.days.set(`${p}:${d}`, { questions, answered: {} });
      return true;
    },
    mathsContext: async () => context,
    save: async (p, a: SaveArgs) => {
      const cur = state.games.get(p);
      if ((cur?.version ?? 0) !== a.expectedVersion) return null;
      const version = a.expectedVersion + 1;
      state.games.set(p, { game: structuredClone(a.game), version, season: a.season });
      const day = state.days.get(`${p}:${a.day}`);
      if (day) Object.assign(day.answered, a.claims);
      state.requests.set(`${p}:${a.requestId}`, a.reply);
      state.saves++;
      return version;
    },
    recordAnswers: async (_p, once, answers) => {
      state.records.push({ once, answers });
    },
  };
  const handler = makeHandler(services);
  const call = async (body: object, token = 'good') => {
    const r = await handler(new Request('https://x/trader', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  let n = 0;
  const id = () => `req-${String(++n).padStart(6, '0')}`;
  return { state, call, id };
}

describe('the Star Trader server function', () => {
  it('refuses a missing or fake sign-in and anything that is not a POST', async () => {
    const { call } = world();
    expect((await call({ action: 'load' }, 'nope')).status).toBe(401);
    const handler = makeHandler(world().state as unknown as Services);
    expect((await handler(new Request('https://x/trader', { method: 'GET' }))).status).toBe(405);
  });

  it('says it is switched off while the teacher\'s switch is off, and does nothing', async () => {
    const w = world({ settings: { enabled: false } });
    const r = await w.call({ action: 'load' });
    expect(r.status).toBe(403);
    expect(w.state.games.size).toBe(0);
  });

  it('opens a new pupil\'s game today with the school\'s galaxy, 100 credits, the jumps and 40 questions without answers', async () => {
    const w = world();
    const r = await w.call({ action: 'load' });
    expect(r.status).toBe(200);
    expect(r.body.galaxySeed).toBe(SEED);
    expect(r.body.version).toBe(1);
    expect(r.body.game.t.credits).toBe(100);
    expect(r.body.game.t.day).toBe(TODAY);
    expect(r.body.questions).toHaveLength(40);
    expect(JSON.stringify(r.body.questions)).not.toMatch(/"answer"|factKey/);
    // Loading again changes nothing.
    const again = await w.call({ action: 'load' });
    expect(again.body.version).toBe(1);
    expect(w.state.saves).toBe(1);
  });

  it('applies a trade with the shared rules and a request sent twice counts once', async () => {
    const w = world();
    const first = await w.call({ action: 'load' });
    const g = first.body.game as Game;
    const line = g.t.market.find((m) => m.buy > 0 && m.stock > 5)!;
    const plan = emptyPlan();
    plan[line.good] = 2;
    const requestId = w.id();
    const sent = { action: 'act', requestId, version: first.body.version, actions: [{ type: 'trade', plan }] };
    const r1 = await w.call(sent);
    expect(r1.status).toBe(200);
    expect(r1.body.game.t.credits).toBe(100 - line.buy * 2);
    expect(r1.body.version).toBe(2);
    const r2 = await w.call(sent);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual(r1.body);
    expect(w.state.saves).toBe(2);
    expect(w.state.games.get('ana')!.game.t.credits).toBe(100 - line.buy * 2);
  });

  it('refuses a move that cannot be done, keeps nothing, and does not use up a question', async () => {
    const w = world();
    const first = await w.call({ action: 'load' });
    const greedy = emptyPlan();
    greedy[WATER] = 400;
    const r = await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'trade', plan: greedy, ask: { slot: 0, value: 1, ms: 10 } }] });
    expect(r.status).toBe(400);
    expect(w.state.games.get('ana')!.version).toBe(1);
    expect(w.state.days.get(`ana:${TODAY}`)!.answered).toEqual({});
    expect(first.body.game.t.credits).toBe(100);
  });

  it('marks an answer on the server, uses the question once, and records it for the maths ladder', async () => {
    const w = world();
    const first = await w.call({ action: 'load' });
    const line = (first.body.game as Game).t.market.find((m) => m.buy > 0 && m.stock > 5)!;
    const plan = emptyPlan();
    plan[line.good] = 1;
    const stored = w.state.days.get(`ana:${TODAY}`)!;
    const right = stored.questions[0].answer;
    const r = await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'trade', plan, ask: { slot: 0, value: right, ms: 2500 } }] });
    expect(r.status).toBe(200);
    expect(r.body.answers).toEqual([{ slot: 0, right: true, answer: right, ms: 2500 }]);
    expect(r.body.trade.sharp).toBe(true);
    expect(r.body.game.asked).toBe(1);
    expect(w.state.days.get(`ana:${TODAY}`)!.answered['0']).toEqual({ value: right, right: true });
    expect(w.state.records).toHaveLength(1);
    // The same slot again is refused.
    const plan2 = emptyPlan();
    plan2[line.good] = 1;
    const again = await w.call({ action: 'act', requestId: w.id(), version: 2, actions: [{ type: 'trade', plan: plan2, ask: { slot: 0, value: right, ms: 1 } }] });
    expect(again.status).toBe(400);
  });

  it('a request made from an old version is refused with a hint to reload, and changes nothing', async () => {
    const w = world();
    await w.call({ action: 'load' });
    const plan = emptyPlan();
    const line = w.state.games.get('ana')!.game.t.market.find((m) => m.buy > 0 && m.stock > 5)!;
    plan[line.good] = 1;
    await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'trade', plan }] });
    const stale = await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'trade', plan }] });
    expect(stale.status).toBe(409);
    expect(stale.body.stale).toBe(true);
    expect(w.state.games.get('ana')!.version).toBe(2);
  });

  it('pupils cannot touch each other\'s games', async () => {
    const w = world();
    await w.call({ action: 'load' });
    await w.call({ action: 'load' }, 'good2');
    expect(w.state.games.has('ben')).toBe(true);
    expect(w.state.games.get('ben')!.game).not.toBe(w.state.games.get('ana')!.game);
  });

  it('a new day brings the jumps back (and drops a half-finished event)', async () => {
    let now = NOW;
    const w = world({ now: () => now });
    await w.call({ action: 'load' });
    const saved = w.state.games.get('ana')!;
    saved.game.t.jumpsLeft = 0;
    saved.game.pending = { kind: 'junk' };
    now += 24 * 3_600_000;
    const stale = await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [] });
    expect(stale.status).toBe(409);
    const r = await w.call({ action: 'load' });
    expect(r.body.game.t.jumpsLeft).toBe(10);
    expect(r.body.game.pending).toBeNull();
    expect(r.body.day).toBe(TODAY + 1);
    expect(r.body.questions).toHaveLength(40);
  });

  it('with maths switched off there are no questions and a laser charge is full power', async () => {
    const w = world({ settings: { maths: false } });
    const r = await w.call({ action: 'load' });
    expect(r.body.questions).toEqual([]);
  });

  it('refuses things it cannot read and caps how many moves come in one request', async () => {
    const w = world();
    await w.call({ action: 'load' });
    expect((await w.call({ action: 'act', requestId: 'x', version: 1, actions: [] })).status).toBe(400);
    expect((await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'steal' }] })).status).toBe(400);
    expect((await w.call({ action: 'act', requestId: w.id(), version: 1, actions: Array.from({ length: 50 }, () => ({ type: 'buyPod' })) })).status).toBe(400);
    expect((await w.call({ action: 'fly' })).status).toBe(400);
    expect(parseActions([{ type: 'jump', dest: 3 }])).toEqual([{ type: 'jump', dest: 3 }]);
  });

  it('the New Zealand day starts at New Zealand midnight', () => {
    // 11:30 am UTC on the 22nd is 12:30 am on the 23rd in New Zealand (summer time).
    expect(nzDay(Date.UTC(2026, 9, 22, 10, 30))).toBe(nzDay(Date.UTC(2026, 9, 22, 1, 0)) + 0);
    expect(nzDay(Date.UTC(2026, 9, 22, 12, 30))).toBe(nzDay(Date.UTC(2026, 9, 22, 1, 0)) + 1);
  });

  it('a game that has a new game for a new pupil is the same one the shared rules make', async () => {
    const w = world();
    const r = await w.call({ action: 'load' });
    expect(r.body.game.t.market).toEqual(newGame(galaxy, TODAY, DEFAULT_SETTINGS).t.market);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- trader` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('trader');
    expect(readFileSync(resolve('supabase/functions/trader/index.ts'), 'utf8')).toBe(built);
  });
});

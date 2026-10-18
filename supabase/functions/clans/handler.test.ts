import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Result, ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { nzDayNumber } from '../../../shared/clans/clock';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Loaded, type Outcome, type SaveStatus, type Services } from './handler';

const NOW = Date.UTC(2026, 9, 19, 2, 0, 0);
const SEED = 424242;
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Stands in for the database the way load_clan() and save_clan() behave: copies in and out, versions, remembered requests. */
function fakeDb() {
  const clans = new Map<string, { version: number; state: ServerState; requests: Map<string, Result> }>();
  const seeds = new Map<string, number>();
  const log: string[] = [];
  const db: Pick<Services, 'load' | 'save'> & { raceOnce?: () => void } = {
    async load(player, requestId) {
      if (!seeds.has(player)) seeds.set(player, SEED + seeds.size);
      const row = clans.get(player);
      const replay = row?.requests.get(requestId) ?? null;
      return { ok: true, value: { seed: row ? row.state.seed : seeds.get(player)!, version: row?.version ?? 0, state: row ? json(row.state) : null, replay: replay && json(replay) } satisfies Loaded };
    },
    async save(player, expected, requestId, action, state, result): Promise<Outcome<SaveStatus>> {
      db.raceOnce?.();
      db.raceOnce = undefined;
      const row = clans.get(player);
      const dup = row?.requests.get(requestId);
      if (dup) return { ok: true, value: { status: 'duplicate', result: json(dup) } };
      if ((row?.version ?? 0) !== expected) return { ok: true, value: { status: 'stale' } };
      const requests = row?.requests ?? new Map<string, Result>();
      requests.set(requestId, json(result));
      clans.set(player, { version: expected + 1, state: json(state), requests });
      log.push(`${player}:${action}`);
      return { ok: true, value: { status: 'saved', version: expected + 1 } };
    },
  };
  return { db, clans, log };
}

function setup(over: Partial<Services> = {}, now = () => NOW) {
  const { db, clans, log } = fakeDb();
  const services: Services = {
    now,
    userIdFor: vi.fn(async (token: string) => (token === 'ana' ? 'student-1' : token === 'ben' ? 'student-2' : null)),
    ...db,
    ...over,
  };
  const handler = makeHandler(services);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const send = async (action: unknown, opts: { token?: string | null; requestId?: string; raw?: unknown } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    const token = opts.token === undefined ? 'ana' : opts.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await handler(new Request('http://x/clans', { method: 'POST', headers, body: JSON.stringify(opts.raw ?? { requestId: opts.requestId ?? id(), action }) }));
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
  return { send, clans, log, services, id, handler };
}

const create = (seed = SEED) => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(seed) });

describe('the clans server function', () => {
  it('needs a signed-in student', async () => {
    const { send } = setup();
    expect((await send({ type: 'load' }, { token: null })).status).toBe(401);
    expect((await send({ type: 'load' }, { token: 'fake' })).status).toBe(401);
  });

  it('answers the browser\'s "may I?" and refuses anything but POST', async () => {
    const { handler } = setup();
    expect((await handler(new Request('http://x/clans', { method: 'OPTIONS', headers: { Origin: 'https://bleedingrobot.github.io' } }))).status).toBe(204);
    expect((await handler(new Request('http://x/clans', { method: 'GET' }))).status).toBe(405);
  });

  it.each([
    ['no request id', { action: { type: 'load' } }],
    ['a request id that is not an id', { requestId: 'abc', action: { type: 'load' } }],
    ['no action', { requestId: '00000000-0000-4000-8000-000000000001' }],
    ['an action that does not exist', { requestId: '00000000-0000-4000-8000-000000000001', action: { type: 'giveMeGold', gold: 1e9 } }],
    ['an action with bad numbers', { requestId: '00000000-0000-4000-8000-000000000001', action: { type: 'deposit', gold: -50 } }],
  ])('refuses %s', async (_why, raw) => {
    const { send, clans } = setup();
    const { status } = await send(null, { raw });
    expect(status).toBe(400);
    expect(clans.size).toBe(0);
  });

  it('says there is no clan yet, and gives the seed the server chose', async () => {
    const { send } = setup();
    const { status, body } = await send({ type: 'load' });
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, seed: SEED, state: null });
  });

  it('makes a clan from the creator\'s choices and loads it again', async () => {
    const { send, clans } = setup();
    const made = await send(create());
    expect(made.body).toMatchObject({ ok: true, result: { type: 'create' }, state: { seed: SEED, day: 1, fightsLeft: 8 } });
    expect(made.body.state.clan.name).toBe('Red Banner');
    expect(made.body.state.clan.members).toHaveLength(4);
    expect(clans.get('student-1')!.version).toBe(1);
    const again = await send({ type: 'load' });
    expect(again.body.state.clan).toEqual(made.body.state.clan);
    expect(clans.get('student-1')!.version).toBe(1);
  });

  it("builds the clan from the server's seed, whatever seed the browser's drafts carry", async () => {
    const { send } = setup();
    const made = await send({ ...create(), drafts: startingDrafts(1).map((d) => ({ ...d, seed: 1 })) });
    // The stats come from the server's seed, so they match a clan made from it, not from seed 1.
    const proper = await send(create(), { token: 'ben' });
    expect(made.body.state.clan.members.map((m: any) => m.stats)).not.toEqual(proper.body.state.clan.members.map((m: any) => m.stats));
    expect(made.body.state.seed).toBe(SEED);
  });

  it('keeps clans of different students apart', async () => {
    const { send } = setup();
    await send(create());
    await send(create(), { token: 'ben' });
    await send({ type: 'deposit', gold: 100 });
    const ben = await send({ type: 'load' }, { token: 'ben' });
    expect(ben.body.state.clan.gold).toBe(200);
    expect(ben.body.state.seed).not.toBe(SEED);
  });

  it('pays a request once: the same request id sent again gets the first answer back, even if the rules would now say no', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const id = '00000000-0000-4000-8000-0000000000aa';
    const first = await send({ type: 'deposit', gold: 150 }, { requestId: id });
    expect(first.body).toMatchObject({ ok: true, replayed: false });
    // 150 more would be refused (the purse now has 50), but the repeat never reaches the rules.
    const second = await send({ type: 'deposit', gold: 150 }, { requestId: id });
    expect(second.body).toMatchObject({ ok: true, replayed: true, result: { type: 'deposit' } });
    expect(second.body.state.clan.gold).toBe(50);
    expect(clans.get('student-1')!.state.clan.gold).toBe(50);
    expect(log.filter((l) => l.endsWith('deposit'))).toHaveLength(1);
  });

  it('pays once even when two copies arrive at the same moment', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const id = '00000000-0000-4000-8000-0000000000bb';
    const [a, b] = await Promise.all([send({ type: 'deposit', gold: 100 }, { requestId: id }), send({ type: 'deposit', gold: 100 }, { requestId: id })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(clans.get('student-1')!.state.clan.gold).toBe(100);
    expect(log.filter((l) => l.endsWith('deposit'))).toHaveLength(1);
  });

  it('redoes a request when another one saved first, using the newer clan', async () => {
    // Another request sneaks in between this one's load and its save.
    const raced = setup();
    await raced.send(create());
    const original = raced.services.save;
    let injected = false;
    raced.services.save = async (...args) => {
      if (!injected) {
        injected = true;
        await original('student-1', 1, '00000000-0000-4000-8000-0000000000cc', 'deposit', (() => {
          const s = json(raced.clans.get('student-1')!.state);
          s.clan.gold -= 100;
          s.clan.empire!.vault += 100;
          return s;
        })(), { type: 'deposit' });
      }
      return original(...args);
    };
    const handler = makeHandler(raced.services);
    const response = await handler(new Request('http://x/clans', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ana' },
      body: JSON.stringify({ requestId: '00000000-0000-4000-8000-0000000000dd', action: { type: 'deposit', gold: 60 } }),
    }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    // 200 - 100 (the request that got in first) - 60 = 40: both were paid, neither twice.
    expect(raced.clans.get('student-1')!.state.clan.gold).toBe(40);
    expect(raced.clans.get('student-1')!.state.clan.empire!.vault).toBe(160);
    expect(raced.clans.size).toBe(1);
  });

  it('gives up with a kind message if the clan keeps being busy', async () => {
    const { send } = setup({ save: async () => ({ ok: true, value: { status: 'stale' } }) });
    const { body, status } = await send(create());
    expect(status).toBe(409);
    expect(body.error).toMatch(/try that again/i);
  });

  it('saves nothing when the rules say no, and shows the clan as it is', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const before = structuredClone(clans.get('student-1'));
    const { status, body } = await send({ type: 'deposit', gold: 5000 });
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: false, why: 'gold' });
    expect(body.say).toMatch(/purse/);
    expect(body.state.clan.gold).toBe(200);
    expect(clans.get('student-1')!.version).toBe(before!.version);
    expect(log).toEqual(['student-1:create']);
  });

  it('cannot be asked to do things before the clan exists, or twice', async () => {
    const { send } = setup();
    expect((await send({ type: 'wakeAll' })).body).toMatchObject({ ok: false, why: 'no-clan' });
    await send(create());
    expect((await send(create())).body).toMatchObject({ ok: false, why: 'exists' });
  });

  it('ignores gold, stats and days the browser puts in a request', async () => {
    const { send, clans } = setup();
    await send(create());
    await send(null, { raw: { requestId: '00000000-0000-4000-8000-0000000000ee', action: { type: 'deposit', gold: 10, clan: { gold: 99999 }, state: { day: 99 } }, gold: 99999 } });
    expect(clans.get('student-1')!.state.clan.gold).toBe(190);
    expect(clans.get('student-1')!.state.day).toBe(1);
  });

  it('gives the clan its night\'s rest on the next New Zealand day, and saves it', async () => {
    let now = NOW;
    const { send, clans } = setup({}, () => now);
    await send(create());
    const s = clans.get('student-1')!.state;
    s.clan.members[1].knockedOut = true;
    s.clan.members[1].hp = 0;
    s.fightsLeft = 0;
    now += 24 * 3600 * 1000;
    const { body } = await send({ type: 'load' });
    expect(body.state.day).toBe(2);
    expect(body.state.fightsLeft).toBe(8);
    expect(body.state.clan.members[1].knockedOut).toBe(false);
    expect(clans.get('student-1')!.state.day).toBe(2);
    expect(nzDayNumber(now)).toBe(nzDayNumber(NOW) + 1);
  });

  it('does the whole day\'s quest once: a second try is refused', async () => {
    const { send } = setup();
    await send(create());
    const first = await send({ type: 'quest', choice: 0, answer: null });
    const second = await send({ type: 'quest', choice: 0, answer: null });
    // The first may need charm; if so it is refused for that reason, and the day is not used up.
    if (first.body.ok) expect(second.body).toMatchObject({ ok: false, why: 'quest' });
    else expect(first.body.say).toMatch(/charm/i);
  });

  it('tells the browser the settings the server used, and never anything private', async () => {
    const { send } = setup();
    const { body } = await send(create());
    expect(Object.keys(body.state).sort()).toEqual(['clan', 'day', 'examined', 'fightNo', 'fightsLeft', 'raidNo', 'seed', 'settings']);
    expect(body.state.settings.yearBand).toBeDefined();
  });

  it('says so if the database cannot be reached, without saving', async () => {
    const down = setup({ load: async () => ({ ok: false, why: 'busy' }) });
    expect((await down.send({ type: 'load' })).status).toBe(503);
    const refusedSave = setup();
    await refusedSave.send(create());
    refusedSave.services.save = async () => ({ ok: false, why: 'refused' });
    const handler = makeHandler(refusedSave.services);
    const response = await handler(new Request('http://x/clans', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ana' },
      body: JSON.stringify({ requestId: '00000000-0000-4000-8000-0000000000ff', action: { type: 'deposit', gold: 10 } }),
    }));
    expect(response.status).toBe(400);
  });

  it('limits how fast one student can ask', async () => {
    const { send } = setup();
    let last = 0;
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE + 1; i++) last = (await send({ type: 'load' })).status;
    expect(last).toBe(429);
    expect((await send({ type: 'load' }, { token: 'ben' })).status).toBe(200);
  });
});

describe('the deployed file', () => {
  it('is up to date (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('clans');
    expect(readFileSync(resolve('supabase/functions/clans/index.ts'), 'utf8')).toBe(built);
  });
});

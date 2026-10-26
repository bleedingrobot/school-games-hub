import { describe, expect, it, vi } from 'vitest';
import type { OpenFight, Result, ServerState } from '../../../shared/clans/actions';
import { nextCryQuestion, replayFight } from '../../../shared/clans/battleCry';
import { botOrders } from '../../../shared/clans/bot';
import { startingDrafts } from '../../../shared/clans/create';
import { nzDayNumber } from '../../../shared/clans/clock';
import type { Empire } from '../../../shared/clans/types';
import { empireOf } from '../../../shared/clans/empire';
import type { Sketch, VillageKind, VillageView } from '../../../shared/clans/village';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Extras, type Loaded, type LoadedTarget, type Outcome, type SaveStatus, type Services } from './handler';

const NOW = Date.UTC(2026, 9, 19, 2, 0, 0);
const SEED = 424242;
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Stands in for the database the way load_clan(), save_clan() and save_raid() behave: copies in and out, versions, remembered requests,
 * and one village shared by every pupil.
 */
function fakeDb() {
  const clans = new Map<string, { version: number; state: ServerState; requests: Map<string, Result> }>();
  const seeds = new Map<string, number>();
  const log: string[] = [];
  const flags = { enabled: true, raidsOn: false };
  const village = { chest: 0, levels: { trainingHall: 0, smithy: 0, church: 0 }, votes: new Map<string, VillageKind>(), news: [] as string[] };
  const teacher = { enabledTopics: [...DEFAULT_PRACTICAL_SETTINGS.enabledTopics] as string[], yearBand: 5, enabledTables: [...DEFAULT_PRACTICAL_SETTINGS.enabledTables], fightsPerDay: 8, season: 1 };
  const publicId = (player: string) => player.replace('student-', 'pid-');
  const playerOf = (id: string) => [...clans.keys()].find((p) => publicId(p) === id);
  const villageView = (player: string): VillageView => ({ name: 'Room 12', chest: village.chest, levels: { ...village.levels }, week: 2900, votes: {}, myVote: village.votes.get(player) ?? null, clans: clans.size });
  const db: Omit<Services, 'now' | 'userIdFor'> = {
    async load(player, requestId) {
      if (!seeds.has(player)) seeds.set(player, SEED + seeds.size);
      const row = clans.get(player);
      const replay = row?.requests.get(requestId) ?? null;
      const state = row ? json(row.state) : null;
      if (state) state.clan.village = { ...village.levels };
      return {
        ok: true,
        value: {
          seed: row ? row.state.seed : seeds.get(player)!, version: row?.version ?? 0, state, replay: replay && json(replay), enabled: flags.enabled,
          news: [...village.news], village: row ? villageView(player) : null, self: row ? publicId(player) : null, raidsOn: flags.raidsOn, notes: [],
        } satisfies Loaded,
      };
    },
    async save(player, expected, requestId, action, state, result): Promise<Outcome<SaveStatus>> {
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
    async extras(): Promise<Outcome<Extras>> {
      return { ok: true, value: { settings: json(teacher), fame: 0, achievements: [] } };
    },
    async recordAnswers(_player, _batch, list) {
      return { ok: true, value: list.length };
    },
    // The child's maths can't be read, so fights are old-style.
    async mathsContext() {
      return null;
    },
    async recordLadderAnswers() {},
    async vote(player, kind) {
      village.votes.set(player, kind);
      return { ok: true, value: { ok: true } };
    },
    async mates(player) {
      const list: Sketch[] = [];
      for (const [p, row] of clans) {
        if (p === player) continue;
        const e = empireOf(row.state.clan);
        list.push({ id: publicId(p), name: row.state.clan.name, createdNzDay: row.state.createdNzDay, shieldUntil: e.shieldUntil, troops: { ...e.troops } });
      }
      return { ok: true, value: list };
    },
    async target(player, id) {
      const p = playerOf(id);
      const row = p && p !== player ? clans.get(p) : undefined;
      if (!p || !row) return { ok: true, value: null };
      return { ok: true, value: { id, name: row.state.clan.name, createdNzDay: row.state.createdNzDay, empire: json(empireOf(row.state.clan)), version: row.version } satisfies LoadedTarget };
    },
    async saveRaid(player, expected, raid, requestId, state, result): Promise<Outcome<SaveStatus>> {
      const defender = playerOf(raid.targetId);
      const a = clans.get(player);
      const d = defender ? clans.get(defender) : undefined;
      if (!a || !d || !defender) return { ok: false, why: 'refused' };
      const dup = a.requests.get(requestId);
      if (dup) return { ok: true, value: { status: 'duplicate', result: json(dup) } };
      if (a.version !== expected || d.version !== raid.targetVersion) return { ok: true, value: { status: 'stale' } };
      a.requests.set(requestId, json(result));
      clans.set(player, { version: a.version + 1, state: json(state), requests: a.requests });
      const after = json(d.state);
      after.clan.empire = json(raid.empire) as Empire;
      clans.set(defender, { version: d.version + 1, state: after, requests: d.requests });
      log.push(`${player}:raidClass`);
      return { ok: true, value: { status: 'saved', version: a.version + 1 } };
    },
  };
  return { db, clans, log, flags };
}

function setup() {
  const { db, clans, log, flags } = fakeDb();
  const services: Services = {
    now: () => NOW,
    userIdFor: vi.fn(async (token: string) => (token === 'ana' ? 'student-1' : token === 'ben' ? 'student-2' : token === 'cai' ? 'student-3' : null)),
    ...db,
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
  return { send, clans, log, id, flags };
}

const create = (name = 'Red Banner') => ({ type: 'create', name, drafts: startingDrafts(SEED) });

/** The next round, the way the browser would play it: rebuild the fight from what the server keeps, then pick orders. */
function nextRound(fight: OpenFight, members: ServerState['clan']['members']) {
  const local = replayFight(members, fight.depth, fight.seed, fight.boss, fight.rounds, fight.settings).state;
  const q = nextCryQuestion(local, fight.settings);
  return { type: 'fightRound', round: fight.rounds.length + 1, orders: botOrders(local), cry: q ? { answer: q.answer, reward: 'damage' } : null };
}

describe('the clans server function', () => {
  it('refuses a student who is not signed in, a bad request, and one who asks too fast', async () => {
    const { send, clans } = setup();
    expect((await send({ type: 'load' }, { token: null })).status).toBe(401);
    expect((await send({ type: 'load' }, { token: 'fake' })).status).toBe(401);
    expect((await send(null, { raw: { requestId: 'abc', action: { type: 'load' } } })).status).toBe(400);
    expect((await send({ type: 'giveMeGold', gold: 1e9 })).status).toBe(400);
    expect((await send({ type: 'deposit', gold: -50 })).status).toBe(400);
    expect(clans.size).toBe(0);
    let last = 0;
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE + 1; i++) last = (await send({ type: 'load' })).status;
    expect(last).toBe(429);
    expect((await send({ type: 'load' }, { token: 'ben' })).status).toBe(200);
  });

  it('pays a request once, whether it is sent again later or twice at the same moment', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const id = '00000000-0000-4000-8000-0000000000aa';
    await send({ type: 'deposit', gold: 150 }, { requestId: id });
    // 150 more would be refused (the purse now has 50), but the repeat never reaches the rules.
    const again = await send({ type: 'deposit', gold: 150 }, { requestId: id });
    expect(again.body).toMatchObject({ ok: true, replayed: true, result: { type: 'deposit' } });
    const both = '00000000-0000-4000-8000-0000000000bb';
    await Promise.all([send({ type: 'deposit', gold: 20 }, { requestId: both }), send({ type: 'deposit', gold: 20 }, { requestId: both })]);
    expect(clans.get('student-1')!.state.clan.gold).toBe(30);
    expect(log.filter((l) => l.endsWith('deposit'))).toHaveLength(2);
  });

  it('plays a mine fight to the end and pays once, even if the last round is sent twice at the same moment', async () => {
    const t = setup();
    await t.send(create());
    let state = (await t.send({ type: 'fightStart', depth: 2, boss: false })).body.state;
    expect(state.fightsLeft).toBe(7);
    const wrong = await t.send({ ...nextRound(state.fight, state.clan.members), round: 2 });
    expect(wrong.body).toMatchObject({ ok: false, why: 'stale-round' });
    for (let i = 0; i < 12 && state.fight; i++) {
      const action = nextRound(state.fight, state.clan.members);
      const id = t.id();
      const [a, b] = await Promise.all([t.send(action, { requestId: id }), t.send(action, { requestId: id })]);
      state = a.body.state ?? b.body.state;
      if (!state.fight) {
        // A brand-new request for the same last round does not pay again.
        const fresh = await t.send(action);
        expect(fresh.body).toMatchObject({ ok: false, why: 'no-fight' });
        expect(fresh.body.state.clan.gold).toBe(state.clan.gold);
      }
    }
    expect(state.fight).toBeNull();
  });

  it('refuses a raid on a clan that is not in the village, on yourself, or a second raid the same day', async () => {
    const t = setup();
    const day = nzDayNumber(NOW);
    const plan = { rounds: 3, push: 'steady', loot: 10 };
    for (const [token, name, player] of [['ana', 'Red Banner', 'student-1'], ['ben', 'Swift Foxes', 'student-2'], ['cai', 'Brave Owls', 'student-3']] as const) {
      await t.send(create(name), { token });
      const row = t.clans.get(player)!;
      row.state.createdNzDay = day - 14;
      row.state.day = 15;
      Object.assign(empireOf(row.state.clan), { day: 15, vault: 1000 });
      empireOf(row.state.clan).troops.footman = 40;
    }
    t.flags.raidsOn = true;
    const targets = (await t.send({ type: 'raidTargets' }, { token: 'ben' })).body.result.targets as { id: string; name: string }[];
    const me = targets.find((x) => x.name === 'Red Banner')!.id;
    const owls = targets.find((x) => x.name === 'Brave Owls')!.id;
    const ben = (await t.send({ type: 'raidTargets' })).body.result.targets.find((x: any) => x.name === 'Swift Foxes').id;
    expect((await t.send({ type: 'raidClass', target: 'nobody', take: 'gold', plan })).body).toMatchObject({ ok: false, why: 'target' });
    expect((await t.send({ type: 'raidClass', target: me, take: 'gold', plan })).body).toMatchObject({ ok: false, why: 'target' });
    expect((await t.send({ type: 'raidClass', target: ben, take: 'gold', plan })).body.ok).toBe(true);
    expect((await t.send({ type: 'raidClass', target: owls, take: 'land', plan })).body).toMatchObject({ ok: false, why: 'limit' });
    expect(t.log.filter((l) => l.endsWith('raidClass'))).toHaveLength(1);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OpenFight, Result, ServerState } from '../../../shared/clans/actions';
import { nextCryQuestion, replayFight } from '../../../shared/clans/battleCry';
import { botOrders } from '../../../shared/clans/bot';
import { startingDrafts } from '../../../shared/clans/create';
import { nzDayNumber } from '../../../shared/clans/clock';
import type { Empire, OldEmpire, Village } from '../../../shared/clans/types';
import { empireOf } from '../../../shared/clans/empire';
import { todaysQuest } from '../../../shared/clans/quests';
import type { Sketch } from '../../../shared/clans/village';
import { addEarned, fameFor, measures, NO_STATS, pointsFor, reached, type ClanStats, type Earned } from '../../../shared/clans/rewards';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { parseFocus } from '../../../shared/maths/focus';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { CONFIG } from '../../../shared/clans/config';
import { makeHandler, MAX_REQUESTS_PER_MINUTE, type Extras, type Loaded, type LoadedTarget, type Outcome, type SaveStatus, type Services } from './handler';

const NOW = Date.UTC(2026, 9, 19, 2, 0, 0);
const SEED = 424242;
const TH_COST = CONFIG.empire.buildings.trainingHall.base;
const json = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Stands in for the database the way load_clan(), save_clan() and save_raid() behave: copies in and out, versions, remembered requests,
 * the village news every pupil reads, each clan's private notes, and the old group village's levels (used once, to convert an old save).
 */
function fakeDb() {
  const clans = new Map<string, { version: number; state: ServerState; requests: Map<string, Result> }>();
  const seeds = new Map<string, number>();
  const log: string[] = [];
  const flags = { enabled: true, raidsOn: false, news: ['One fight was won in the Mines yesterday.'] as string[], clock: undefined as unknown };
  const village = { news: [] as string[] };
  const group: { levels: Village | null } = { levels: null };
  const notes = new Map<string, string[]>();
  // What the database's trigger keeps: fame, the wins waiting for a point, lifetime counts, points earned, and the teacher's private maths records.
  const fame = new Map<string, number>();
  const waiting = new Map<string, number>();
  const stats = new Map<string, ClanStats>();
  const points: { player: string; points: number }[] = [];
  const answers: { player: string; batch: string; list: FactAnswer[] }[] = [];
  // The child's own maths (space_maths_context) and the answers kept in it (recordMathsAnswers), for ladder fights.
  const ladder = { context: { facts: [], settings: { enabledTables: [2, 3, 4, 5, 10] }, focus: parseFocus(null) } as MathsContext | null, loads: [] as string[], kept: [] as { player: string; once: string; list: FactAnswer[] }[] };
  const teacher = { enabledTopics: [...DEFAULT_PRACTICAL_SETTINGS.enabledTopics] as string[], yearBand: 5, enabledTables: [...DEFAULT_PRACTICAL_SETTINGS.enabledTables], fightsPerDay: 8, season: 1, typedNames: false };
  const earn = (player: string, result: Result) => {
    const earned = 'earned' in result ? (result.earned as Earned | undefined) : undefined;
    if (!earned) return;
    fame.set(player, (fame.get(player) ?? 0) + fameFor(earned));
    const p = pointsFor(earned, waiting.get(player) ?? 0);
    waiting.set(player, p.pending);
    if (p.points > 0) points.push({ player, points: p.points });
    stats.set(player, addEarned(stats.get(player) ?? NO_STATS, earned));
  };
  const publicId = (player: string) => player.replace('student-', 'pid-');
  const playerOf = (id: string) => [...clans.keys()].find((p) => publicId(p) === id);
  const db: Pick<Services, 'load' | 'save' | 'mates' | 'target' | 'saveRaid' | 'extras' | 'recordAnswers' | 'mathsContext' | 'recordLadderAnswers'> & { raceOnce?: () => void } = {
    async load(player, requestId) {
      if (!seeds.has(player)) seeds.set(player, SEED + seeds.size);
      const row = clans.get(player);
      const replay = row?.requests.get(requestId) ?? null;
      const state = row ? json(row.state) : null;
      return {
        ok: true,
        value: {
          seed: row ? row.state.seed : seeds.get(player)!, version: row?.version ?? 0, state, replay: replay && json(replay), enabled: flags.enabled,
          news: [...village.news, ...flags.news], groupVillage: group.levels && { ...group.levels }, self: row ? publicId(player) : null, raidsOn: flags.raidsOn,
          notes: [...(notes.get(player) ?? [])],
        } satisfies Loaded,
      };
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
      earn(player, result);
      log.push(`${player}:${action}`);
      return { ok: true, value: { status: 'saved', version: expected + 1 } };
    },
    async extras(player): Promise<Outcome<Extras>> {
      const row = clans.get(player);
      const achievements = row ? reached(measures(row.state.clan, stats.get(player) ?? NO_STATS)) : [];
      return { ok: true, value: { settings: json(teacher), fame: fame.get(player) ?? 0, achievements, ...(flags.clock !== undefined ? { clock: flags.clock } : {}) } };
    },
    async recordAnswers(player, batch, list) {
      // Like record_fact_answers: a batch seen before adds nothing.
      if (answers.some((a) => a.player === player && a.batch === batch)) return { ok: true, value: 0 };
      answers.push({ player, batch, list: json(list) });
      return { ok: true, value: list.length };
    },
    async mathsContext(player) {
      ladder.loads.push(player);
      return ladder.context && json(ladder.context);
    },
    async recordLadderAnswers(player, once, list) {
      // Like recordMathsAnswers: a batch seen before adds nothing.
      if (!ladder.kept.some((k) => k.player === player && k.once === once)) ladder.kept.push({ player, once, list: json(list) });
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
      return { ok: true, value: { id, name: row.state.clan.name, createdNzDay: row.state.createdNzDay, empire: json(empireOf(row.state.clan)), gold: row.state.clan.gold, version: row.version } satisfies LoadedTarget };
    },
    async saveRaid(player, expected, raid, requestId, state, result): Promise<Outcome<SaveStatus>> {
      db.raceOnce?.();
      db.raceOnce = undefined;
      const defender = playerOf(raid.targetId);
      const a = clans.get(player);
      const d = defender ? clans.get(defender) : undefined;
      if (!a || !d || !defender) return { ok: false, why: 'refused' };
      const dup = a.requests.get(requestId);
      if (dup) return { ok: true, value: { status: 'duplicate', result: json(dup) } };
      if (a.version !== expected || d.version !== raid.targetVersion) return { ok: true, value: { status: 'stale' } };
      if (!flags.raidsOn) return { ok: false, why: 'refused' };
      // Like the database: the gold the raiders gain is the gold the raided clan loses, and nothing else is made or lost.
      if (a.state.clan.gold + d.state.clan.gold !== state.clan.gold + raid.gold) return { ok: false, why: 'refused' };
      a.requests.set(requestId, json(result));
      clans.set(player, { version: a.version + 1, state: json(state), requests: a.requests });
      earn(player, result);
      const after = json(d.state);
      after.clan.empire = json(raid.empire) as Empire;
      after.clan.gold = raid.gold;
      clans.set(defender, { version: d.version + 1, state: after, requests: d.requests });
      village.news.unshift(raid.news);
      notes.set(defender, [raid.note, ...(notes.get(defender) ?? [])]);
      log.push(`${player}:raidClass`);
      return { ok: true, value: { status: 'saved', version: a.version + 1 } };
    },
  };
  return { db, clans, log, flags, village, group, notes, fame, points, answers, teacher, stats, ladder };
}

function setup(over: Partial<Services> = {}, now = () => NOW) {
  const { db, clans, log, flags, village, group, notes, fame, points, answers, teacher, stats, ladder } = fakeDb();
  const services: Services = {
    now,
    userIdFor: vi.fn(async (token: string) => (token === 'ana' ? 'student-1' : token === 'ben' ? 'student-2' : token === 'cai' ? 'student-3' : null)),
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
  return { send, clans, log, services, id, handler, flags, village, group, notes, fame, points, answers, teacher, stats, ladder };
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

  it('takes made-up hero names only while the teacher\'s switch is on', async () => {
    const typed = () => ({ ...create(), drafts: startingDrafts(SEED).map((d, i) => (i === 0 ? { ...d, name: 'zoe' } : d)) });
    const t = setup();
    expect((await t.send(typed())).body).toMatchObject({ ok: false });
    expect(t.clans.size).toBe(0);
    t.teacher.typedNames = true;
    const made = await t.send(typed());
    expect(made.body.state.clan.members[0].name).toBe('Zoe');
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
    await send({ type: 'upgrade', building: 'trainingHall' });
    const ben = await send({ type: 'load' }, { token: 'ben' });
    expect(ben.body.state.clan.gold).toBe(200);
    expect(ben.body.state.seed).not.toBe(SEED);
  });

  it('pays a request once: the same request id sent again gets the first answer back, even if the rules would now say no', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const id = '00000000-0000-4000-8000-0000000000aa';
    const first = await send({ type: 'upgrade', building: 'trainingHall' }, { requestId: id });
    expect(first.body).toMatchObject({ ok: true, replayed: false });
    // Another upgrade would be refused (the purse is short), but the repeat never reaches the rules.
    const second = await send({ type: 'upgrade', building: 'trainingHall' }, { requestId: id });
    expect(second.body).toMatchObject({ ok: true, replayed: true, result: { type: 'upgrade' } });
    expect(second.body.state.clan.gold).toBe(CONFIG.startGold - TH_COST);
    expect(clans.get('student-1')!.state.clan.gold).toBe(CONFIG.startGold - TH_COST);
    expect(log.filter((l) => l.endsWith('upgrade'))).toHaveLength(1);
  });

  it('pays once even when two copies arrive at the same moment', async () => {
    const { send, clans, log } = setup();
    await send(create());
    const id = '00000000-0000-4000-8000-0000000000bb';
    const [a, b] = await Promise.all([send({ type: 'upgrade', building: 'trainingHall' }, { requestId: id }), send({ type: 'upgrade', building: 'trainingHall' }, { requestId: id })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(clans.get('student-1')!.state.clan.gold).toBe(CONFIG.startGold - TH_COST);
    expect(log.filter((l) => l.endsWith('upgrade'))).toHaveLength(1);
  });

  it('redoes a request when another one saved first, using the newer clan', async () => {
    // Another request sneaks in between this one's load and its save.
    const raced = setup();
    await raced.send(create());
    raced.clans.get('student-1')!.state.clan.gold = 1000;
    const original = raced.services.save;
    let injected = false;
    raced.services.save = async (...args) => {
      if (!injected) {
        injected = true;
        await original('student-1', 1, '00000000-0000-4000-8000-0000000000cc', 'upgrade', (() => {
          const s = json(raced.clans.get('student-1')!.state);
          s.clan.gold -= TH_COST;
          const e = empireOf(s.clan);
          e.levels.trainingHall = 1;
          e.buildsToday = 1;
          return s;
        })(), { type: 'upgrade', building: 'trainingHall', level: 1 });
      }
      return original(...args);
    };
    const handler = makeHandler(raced.services);
    const response = await handler(new Request('http://x/clans', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ana' },
      body: JSON.stringify({ requestId: '00000000-0000-4000-8000-0000000000dd', action: { type: 'upgrade', building: 'smithy' } }),
    }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    // 1000 - one training hall (the request that got in first) - one smithy: both were paid, neither twice.
    expect(raced.clans.get('student-1')!.state.clan.gold).toBe(1000 - TH_COST - CONFIG.empire.buildings.smithy.base);
    expect(empireOf(raced.clans.get('student-1')!.state.clan).levels).toMatchObject({ trainingHall: 1, smithy: 1 });
    expect(empireOf(raced.clans.get('student-1')!.state.clan).buildsToday).toBe(2);
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
    clans.get('student-1')!.state.clan.gold = TH_COST - 50;
    const { status, body } = await send({ type: 'upgrade', building: 'trainingHall' });
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: false, why: 'gold' });
    expect(body.say).toMatch(new RegExp(`costs ${TH_COST} gold and the clan has ${TH_COST - 50}`));
    expect(body.state.clan.gold).toBe(TH_COST - 50);
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
    await send(null, { raw: { requestId: '00000000-0000-4000-8000-0000000000ee', action: { type: 'upgrade', building: 'trainingHall', clan: { gold: 99999 }, state: { day: 99 } }, gold: 99999 } });
    expect(clans.get('student-1')!.state.clan.gold).toBe(CONFIG.startGold - TH_COST);
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
    expect(Object.keys(body.state).sort()).toEqual(['achievements', 'clan', 'clock', 'day', 'examined', 'fame', 'fight', 'fightNo', 'fightsLeft', 'fightsPerDay', 'news', 'notes', 'raidNo', 'raidsOn', 'season', 'seed', 'settings']);
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
      body: JSON.stringify({ requestId: '00000000-0000-4000-8000-0000000000ff', action: { type: 'upgrade', building: 'trainingHall' } }),
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

describe('mine fights through the server function', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });

  /** The next round, the way the browser would play it: rebuild the fight from what the server keeps, then pick orders. */
  function nextRound(fight: OpenFight, members: ServerState['clan']['members']) {
    const local = replayFight(members, fight.depth, fight.seed, fight.boss, fight.rounds, fight.settings).state;
    const q = nextCryQuestion(local, fight.settings);
    return { type: 'fightRound', round: fight.rounds.length + 1, orders: botOrders(local), cry: q ? { answer: q.answer, reward: 'damage' } : null };
  }

  it('starts a fight, plays it to the end and pays once, even if the last round is sent twice or at the same moment', async () => {
    const t = setup();
    await t.send(create());
    const start = await t.send({ type: 'fightStart', depth: 2, boss: false });
    expect(start.body.result).toEqual({ type: 'fightStart', resumed: false });
    expect(start.body.state.fightsLeft).toBe(7);
    let state = start.body.state;
    for (let i = 0; i < 12 && state.fight; i++) {
      const action = nextRound(state.fight, state.clan.members);
      const id = t.id();
      const [a, b] = await Promise.all([t.send(action, { requestId: id }), t.send(action, { requestId: id })]);
      expect([a.status, b.status]).toEqual([200, 200]);
      state = (a.body.state ?? b.body.state);
      if (!state.fight) {
        const goldAfter = state.clan.gold;
        // The same request once more, and then a brand-new request for the same round: neither pays.
        const again = await t.send(action, { requestId: id });
        expect(again.body.replayed).toBe(true);
        expect(again.body.state.clan.gold).toBe(goldAfter);
        const fresh = await t.send(action);
        expect(fresh.body).toMatchObject({ ok: false, why: 'no-fight' });
        expect(fresh.body.state.clan.gold).toBe(goldAfter);
      }
    }
    expect(state.fight).toBeNull();
    expect(t.log.filter((l) => l.endsWith(':fightRound')).length).toBeGreaterThan(0);
  });

  it('keeps a half-finished fight for a refresh: the server shows it again and starting again uses no fight', async () => {
    const t = setup();
    await t.send(create());
    let state = (await t.send({ type: 'fightStart', depth: 4, boss: false })).body.state;
    state = (await t.send(nextRound(state.fight, state.clan.members))).body.state;
    const open = state.fight;
    if (!open) return;
    const reloaded = await t.send({ type: 'load' });
    expect(reloaded.body.state.fight).toEqual(open);
    const again = await t.send({ type: 'fightStart', depth: 1, boss: false });
    expect(again.body.result).toEqual({ type: 'fightStart', resumed: true });
    expect(again.body.state.fightsLeft).toBe(7);
    expect(again.body.state.fight).toEqual(open);
  });

  it('refuses a round with the wrong number and shows the fight as the server has it', async () => {
    const t = setup();
    await t.send(create());
    const state = (await t.send({ type: 'fightStart', depth: 2, boss: false })).body.state;
    const wrong = await t.send({ ...nextRound(state.fight, state.clan.members), round: 2 });
    expect(wrong.body).toMatchObject({ ok: false, why: 'stale-round' });
    expect(wrong.body.state.fight.rounds).toHaveLength(0);
  });

  it('ignores a result, gold or experience the browser claims', async () => {
    const t = setup();
    await t.send(create());
    const state = (await t.send({ type: 'fightStart', depth: 2, boss: false })).body.state;
    const claim = { ...nextRound(state.fight, state.clan.members), result: 'won', gold: 99999, summary: { gold: 99999 }, xp: [999] };
    const out = await t.send(claim);
    expect(out.body.state.clan.gold).toBeLessThan(1000);
  });

  it('tells the browser the open fight and the news, and nothing private', async () => {
    const t = setup();
    await t.send(create());
    const out = await t.send({ type: 'fightStart', depth: 2, boss: false });
    expect(Object.keys(out.body.state.fight).sort()).toEqual(['boss', 'depth', 'no', 'rounds', 'seed', 'settings']);
    expect(out.body.state.news).toEqual(['One fight was won in the Mines yesterday.']);
  });

  it('stops everything with a plain message when the teacher\'s switch is off, and works again when it is on', async () => {
    const t = setup();
    await t.send(create());
    t.flags.enabled = false;
    const off = await t.send({ type: 'load' });
    expect(off.status).toBe(403);
    expect(off.body).toMatchObject({ off: true });
    expect((await t.send({ type: 'fightStart', depth: 1, boss: false })).status).toBe(403);
    t.flags.enabled = true;
    expect((await t.send({ type: 'load' })).status).toBe(200);
  });
});

const DAY = nzDayNumber(NOW);
const PUSH = 'steady';

/** Three pupils with clans that began a fortnight ago, each with an army and 1000 gold in the purse. */
async function village(t: ReturnType<typeof setup>) {
  for (const [token, name] of [['ana', 'Red Banner'], ['ben', 'Swift Foxes'], ['cai', 'Brave Owls']] as const) {
    await t.send({ ...create(), name }, { token });
    const row = t.clans.get(token === 'ana' ? 'student-1' : token === 'ben' ? 'student-2' : 'student-3')!;
    row.state.createdNzDay = DAY - 14;
    row.state.day = 15;
    const e = empireOf(row.state.clan);
    e.day = 15;
    e.troops.footman = 40;
    row.state.clan.gold = 1000;
  }
  t.flags.raidsOn = true;
}
const purse = (t: ReturnType<typeof setup>, p: string) => t.clans.get(p)!.state.clan.gold;
const selfOf = async (t: ReturnType<typeof setup>, token: string) => {
  const list = await t.send({ type: 'raidTargets' }, { token: token === 'ana' ? 'ben' : 'ana' });
  return list.body.result.targets.find((x: any) => x.name === (token === 'ana' ? 'Red Banner' : 'Swift Foxes')).id as string;
};

/** A clan as it was saved before My Village: gold in the vault, plots, and the class village's levels not yet copied in. */
const oldEmpire = (): OldEmpire => ({
  vault: 300, wild: 0, claimed: 0, plots: [{ width: 3, length: 3, building: 'barracks' }, { width: 3, length: 3 }], troops: { footman: 30, axeman: 0, knight: 0 },
  draftPercent: 0, day: 1, createdDay: 1, energyUsed: 0, raidsToday: 0, kingdomRaidsToday: 0, shieldUntil: 0, raidedToday: [],
});

describe('moving an old save to My Village', () => {
  it('converts it once, using the class village levels the database sends, and saves the converted clan', async () => {
    const t = setup();
    await t.send(create());
    const row = t.clans.get('student-1')!;
    row.state.clan.empire = oldEmpire() as unknown as Empire;
    t.group.levels = { trainingHall: 3, smithy: 2, church: 1 };
    const first = await t.send({ type: 'load' });
    const e = first.body.state.clan.empire;
    expect(e.version).toBe(2);
    expect(e.levels).toMatchObject({ trainingHall: 3, smithy: 2, church: 1, barracks: 1 });
    // The old vault joined the purse (200 + 300, and a refund for the spare plot on top).
    expect(first.body.state.clan.gold).toBeGreaterThanOrEqual(500);
    expect(t.clans.get('student-1')!.version).toBe(2);
    expect(t.clans.get('student-1')!.state.clan.empire!.version).toBe(2);
    // A converted save ignores the group village from then on.
    t.group.levels = { trainingHall: 5, smithy: 6, church: 3 };
    const second = await t.send({ type: 'load' });
    expect(second.body.state.clan.empire.levels).toMatchObject({ trainingHall: 3, smithy: 2, church: 1 });
    expect(t.clans.get('student-1')!.version).toBe(2);
  });

  it('sends the browser no village chest, votes or group levels', async () => {
    const t = setup();
    await t.send(create());
    t.group.levels = { trainingHall: 1, smithy: 1, church: 1 };
    const out = await t.send({ type: 'load' });
    expect(JSON.stringify(out.body)).not.toMatch(/chest|votes|groupVillage/);
    expect((await t.send({ type: 'chestGive', gold: 5 })).status).toBe(400);
    expect((await t.send({ type: 'vote', kind: 'church' })).status).toBe(400);
  });
});

describe('raids on classmates', () => {
  it('lists who can be raided and why not, and nothing else about them', async () => {
    const t = setup();
    await village(t);
    empireOf(t.clans.get('student-3')!.state.clan).troops.footman = 3;
    const out = await t.send({ type: 'raidTargets' });
    const list = out.body.result.targets;
    expect(list.map((x: any) => x.name)).toEqual(['Swift Foxes', 'Brave Owls']);
    expect(list[0]).toMatchObject({ allowed: true, say: '' });
    expect(list[1]).toMatchObject({ allowed: false });
    expect(list[1].say).toMatch(/fair match/);
    expect(Object.keys(list[0]).sort()).toEqual(['allowed', 'id', 'name', 'say']);
    expect(JSON.stringify(out.body)).not.toMatch(/student-/);
  });

  it('is refused while the teacher has raids off, and nothing moves', async () => {
    const t = setup();
    await village(t);
    t.flags.raidsOn = false;
    const id = await selfOf(t, 'ben');
    const out = await t.send({ type: 'raidClass', target: id, take: 'gold', push: PUSH });
    expect(out.body).toMatchObject({ ok: false, why: 'off' });
    expect(purse(t, 'student-1')).toBe(1000);
    expect(purse(t, 'student-2')).toBe(1000);
  });

  it('moves gold between the two clans only, writes the news, and the raided clan reads a note', async () => {
    const t = setup();
    await village(t);
    const id = await selfOf(t, 'ben');
    const before = { a: 1000, total: purse(t, 'student-1') + purse(t, 'student-2'), c: purse(t, 'student-3') };
    // Find a seed where the raiders win, so there is gold to move.
    let out = await t.send({ type: 'raidClass', target: id, take: 'gold', push: PUSH });
    for (let k = 1; k < 30 && out.body.result?.result?.outcome !== 'won'; k++) {
      if (!out.body.ok) break;
      const row = t.clans.get('student-1')!;
      // Try again tomorrow-like: reset the day's raid so another seed is tried.
      empireOf(row.state.clan).raidsToday = 0;
      empireOf(row.state.clan).raidedToday = [];
      empireOf(t.clans.get('student-2')!.state.clan).shieldUntil = 0;
      empireOf(row.state.clan).troops.footman = 40;
      empireOf(t.clans.get('student-2')!.state.clan).troops.footman = 40;
      out = await t.send({ type: 'raidClass', target: id, take: 'gold', push: PUSH });
    }
    expect(out.body).toMatchObject({ ok: true });
    expect(out.body.result.type).toBe('raidClass');
    expect(purse(t, 'student-1') + purse(t, 'student-2')).toBe(before.total);
    // The raiders' gain is the raided clan's loss, saved on both clans (10% of 1000 is 100).
    expect(out.body.result.gold).toBe(100);
    expect(purse(t, 'student-1')).toBe(before.a + 100);
    expect(purse(t, 'student-2')).toBe(900);
    expect(purse(t, 'student-3')).toBe(before.c);
    expect(empireOf(t.clans.get('student-2')!.state.clan).shieldUntil).toBe(DAY + 1);
    expect(t.village.news[0]).toMatch(/^A raider from the Red Banner clan /);
    expect(t.notes.get('student-2')![0]).toMatch(/^A raider from the Red Banner clan /);
    const read = await t.send({ type: 'load' }, { token: 'ben' });
    expect(read.body.state.notes[0]).toMatch(/Red Banner/);
    expect(read.body.state.news[0]).toMatch(/Red Banner/);
    // Nobody's account id, in the news or anywhere in what the browser is told.
    expect(JSON.stringify([out.body, read.body])).not.toMatch(/student-/);
  });

  it('pays a raid once when the same request is sent twice', async () => {
    const t = setup();
    await village(t);
    const id = await selfOf(t, 'ben');
    const rid = '00000000-0000-4000-8000-0000000000f1';
    const first = await t.send({ type: 'raidClass', target: id, take: 'gold', push: PUSH }, { requestId: rid });
    expect(first.body.ok).toBe(true);
    const after = { a: purse(t, 'student-1'), b: purse(t, 'student-2') };
    const second = await t.send({ type: 'raidClass', target: id, take: 'gold', push: PUSH }, { requestId: rid });
    expect(second.body).toMatchObject({ ok: true, replayed: true });
    expect({ a: purse(t, 'student-1'), b: purse(t, 'student-2') }).toEqual(after);
    expect(t.log.filter((l) => l.endsWith('raidClass'))).toHaveLength(1);
  });

  it('with two raiders at once, the second redoes its raid on the newer clan and is told about the shield', async () => {
    const t = setup();
    await village(t);
    const id = await selfOf(t, 'ben');
    // Between the second raider's load and save, the first raider's raid gets in.
    const original = t.services.saveRaid;
    let injected = false;
    t.services.saveRaid = async (player, expected, raid, requestId, state, result) => {
      if (!injected) {
        injected = true;
        const attacker = json(t.clans.get('student-1')!.state);
        const defender = json(empireOf(t.clans.get('student-2')!.state.clan));
        defender.shieldUntil = DAY + 1;
        attacker.clan.gold += 40;
        await original('student-1', t.clans.get('student-1')!.version, { targetId: id, targetVersion: t.clans.get('student-2')!.version, empire: defender, gold: 960, news: 'A raider from the Red Banner clan took 40 gold.', note: 'A raider from the Red Banner clan beat your defenders and took 40 gold from your purse.' }, '00000000-0000-4000-8000-0000000000f2', attacker, { type: 'raidClass', take: 'gold', result: {} as never, gold: 40, destroyed: [] });
      }
      return original(player, expected, raid, requestId, state, result);
    };
    const handler = makeHandler(t.services);
    const response = await handler(new Request('http://x/clans', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer cai' },
      body: JSON.stringify({ requestId: '00000000-0000-4000-8000-0000000000f3', action: { type: 'raidClass', target: id, take: 'gold', push: PUSH } }),
    }));
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, why: 'shield' });
    // Only the first raid happened: 40 gold, once.
    expect(purse(t, 'student-2')).toBe(960);
    expect(purse(t, 'student-3')).toBe(1000);
    expect(t.log.filter((l) => l.endsWith('raidClass'))).toHaveLength(1);
  });

  it('refuses a clan that is not in the class, a raid on yourself, and a second raid the same day', async () => {
    const t = setup();
    await village(t);
    const ben = await selfOf(t, 'ben');
    expect((await t.send({ type: 'raidClass', target: 'nobody', take: 'gold', push: PUSH })).body).toMatchObject({ ok: false, why: 'target' });
    expect((await t.send({ type: 'raidClass', target: await selfOf(t, 'ana'), take: 'gold', push: PUSH })).body).toMatchObject({ ok: false, why: 'target' });
    expect((await t.send({ type: 'raidClass', target: ben, take: 'gold', push: PUSH })).body.ok).toBe(true);
    const owls = (await t.send({ type: 'raidTargets' })).body.result.targets.find((x: any) => x.name === 'Brave Owls').id;
    expect((await t.send({ type: 'raidClass', target: owls, take: 'buildings', push: PUSH })).body).toMatchObject({ ok: false, why: 'limit' });
  });

  it('refuses a raid on a clan that is shielded or brand new', async () => {
    const t = setup();
    await village(t);
    const ben = await selfOf(t, 'ben');
    empireOf(t.clans.get('student-2')!.state.clan).shieldUntil = DAY;
    expect((await t.send({ type: 'raidClass', target: ben, take: 'gold', push: PUSH })).body).toMatchObject({ ok: false, why: 'shield' });
    empireOf(t.clans.get('student-2')!.state.clan).shieldUntil = 0;
    t.clans.get('student-2')!.state.createdNzDay = DAY - 1;
    expect((await t.send({ type: 'raidClass', target: ben, take: 'gold', push: PUSH })).body).toMatchObject({ ok: false, why: 'new-defender' });
  });

  it('cannot be asked to raid while a fight is open', async () => {
    const t = setup();
    await village(t);
    const ben = await selfOf(t, 'ben');
    await t.send({ type: 'fightStart', depth: 1, boss: false });
    expect((await t.send({ type: 'raidClass', target: ben, take: 'gold', push: PUSH })).body).toMatchObject({ ok: false, why: 'fight-open' });
  });
});

describe('fame, points, settings and maths records through the server function', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });

  function nextRound(fight: OpenFight, members: ServerState['clan']['members'], answer: 'right' | 'wrong' | 'none' = 'right') {
    const local = replayFight(members, fight.depth, fight.seed, fight.boss, fight.rounds, fight.settings).state;
    const q = nextCryQuestion(local, fight.settings);
    const cry = !q || answer === 'none' ? null : { answer: answer === 'right' ? q.answer : q.answer + 1, reward: 'damage' };
    return { type: 'fightRound', round: fight.rounds.length + 1, orders: botOrders(local), cry };
  }

  /** Plays a whole fight, sending each round twice at the same moment. Returns the last body. */
  async function fightTo(t: ReturnType<typeof setup>, depth: number, boss = false, answer: 'right' | 'wrong' | 'none' = 'right') {
    let state = (await t.send({ type: 'fightStart', depth, boss })).body.state;
    let last: Record<string, any> = {};
    for (let i = 0; i < 20 && state.fight; i++) {
      const action = nextRound(state.fight, state.clan.members, answer);
      const id = t.id();
      const [a, b] = await Promise.all([t.send(action, { requestId: id }), t.send(action, { requestId: id })]);
      last = a.body.state ? a.body : b.body;
      state = last.state;
    }
    return last;
  }

  it('earns a mine win once: fame, a lifetime count, and nothing more when the last round is sent twice at once', async () => {
    const t = setup();
    await t.send(create());
    const end = await fightTo(t, 0);
    expect(end.result.summary.result).toBe('won');
    expect(end.result.earned).toMatchObject({ wins: 1, bosses: 0 });
    expect(t.fame.get('student-1')).toBe(1);
    expect(end.state.fame).toBe(1);
    expect(end.state.achievements).toContain('cq-first-win');
    expect(t.stats.get('student-1')?.mineWins).toBe(1);
    // The same last request again, and a brand-new request for the same round: still 1.
    const again = await t.send({ type: 'fightRound', round: 1, orders: [], cry: null });
    expect(again.body.ok).toBe(false);
    expect(t.fame.get('student-1')).toBe(1);
  });

  it('earns the Battle Cry count only for right answers, and keeps every answered question in the private records', async () => {
    const t = setup();
    await t.send(create());
    let state = (await t.send({ type: 'fightStart', depth: 0, boss: false })).body.state;
    const right = await t.send(nextRound(state.fight, state.clan.members, 'right'));
    expect(right.body.result.earned).toMatchObject({ cries: 1 });
    state = right.body.state;
    if (state.fight) {
      const wrong = await t.send(nextRound(state.fight, state.clan.members, 'wrong'));
      expect(wrong.body.ok).toBe(true);
      expect(wrong.body.result.earned?.cries ?? 0).toBe(0);
      state = wrong.body.state;
    }
    const list = t.answers.flatMap((a) => a.list);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toMatchObject({ correct: true, ms: 60_000 });
    expect(list[0].key).toMatch(/^clan:y5:[a-z-]+$/);
    if (list.length > 1) expect(list[1].correct).toBe(false);
  });

  it('keeps nothing for "No thanks", and a wrong answer is kept but never blocks the round', async () => {
    const t = setup();
    await t.send(create());
    const state = (await t.send({ type: 'fightStart', depth: 0, boss: false })).body.state;
    const skipped = await t.send(nextRound(state.fight, state.clan.members, 'none'));
    expect(skipped.body.ok).toBe(true);
    expect(t.answers).toHaveLength(0);
    const s2 = skipped.body.state;
    if (s2.fight) {
      const wrong = await t.send(nextRound(s2.fight, s2.clan.members, 'wrong'));
      expect(wrong.body.ok).toBe(true);
      expect(t.answers.flatMap((a) => a.list).map((a) => a.correct)).toEqual([false]);
    }
  });

  it('earns nothing from a fight that was not won', async () => {
    const t = setup();
    await t.send(create());
    const end = await fightTo(t, 20);
    expect(end.result.summary.result).not.toBe('won');
    expect(end.result.earned?.wins ?? 0).toBe(0);
    expect(t.fame.get('student-1') ?? 0).toBe(0);
  });

  it('never believes a browser that says what it earned', async () => {
    const t = setup();
    await t.send(create());
    const gift = await t.send({ type: 'upgrade', building: 'trainingHall', earned: { wins: 50, bosses: 50 }, fame: 9999, points: 9999 });
    expect(gift.body.ok).toBe(true);
    expect(gift.body.result.earned).toBeUndefined();
    const state = (await t.send({ type: 'fightStart', depth: 0, boss: false })).body.state;
    const round = await t.send({ ...nextRound(state.fight, state.clan.members, 'none'), earned: { wins: 50, bosses: 50 }, fame: 9999 });
    expect(round.body.ok).toBe(true);
    expect(t.fame.get('student-1') ?? 0).toBeLessThanOrEqual(1);
    expect((t.stats.get('student-1')?.bossWins ?? 0)).toBe(0);
  });

  it('gives a Friendly War win 2 fame and 2 points, and a raid on a kingdom fame but no points', async () => {
    const t = setup();
    await village(t);
    const war = await t.send({ type: 'war', kingdom: 'bunny-hollow', push: PUSH });
    expect(war.body.ok).toBe(true);
    expect(war.body.result.result.outcome).toBe('won');
    expect(war.body.result.earned).toMatchObject({ wars: 1 });
    expect(t.fame.get('student-1')).toBe(2);
    expect(t.points).toEqual([{ player: 'student-1', points: 2 }]);
    const raid = await t.send({ type: 'raid', kingdom: 'bunny-hollow', push: PUSH });
    expect(raid.body.ok).toBe(true);
    expect(raid.body.result.result.outcome).toBe('won');
    expect(raid.body.result.earned).toMatchObject({ kingdomRaids: 1 });
    expect(t.fame.get('student-1')).toBe(4);
    expect(t.points).toEqual([{ player: 'student-1', points: 2 }]);
  });

  it('gives a won raid on a classmate 3 fame and no points', async () => {
    const t = setup();
    await village(t);
    const ben = await selfOf(t, 'ben');
    // A bigger army (still near enough in size to be allowed) and a bold push, so the result does not depend on luck.
    empireOf(t.clans.get('student-1')!.state.clan).troops.footman = 55;
    const out = await t.send({ type: 'raidClass', target: ben, take: 'gold', push: 'bold' });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.result.outcome).toBe('won');
    expect(out.body.result.earned).toMatchObject({ classRaids: 1 });
    expect(t.fame.get('student-1')).toBe(3);
    expect(t.points).toEqual([]);
    // The raided clan earns nothing for being raided.
    expect(t.fame.get('student-2') ?? 0).toBe(0);
  });

  it('tells the browser the fame, the season, the fights a day and the achievements it has', async () => {
    const t = setup();
    const made = await t.send(create());
    expect(made.body.state).toMatchObject({ fame: 0, season: 1, fightsPerDay: 8, achievements: [] });
    t.teacher.season = 3;
    const again = await t.send({ type: 'load' });
    expect(again.body.state.season).toBe(3);
  });

  it('reads the teacher\'s maths settings on every request and sends them with the clan', async () => {
    const t = setup();
    await t.send(create());
    expect((await t.send({ type: 'load' })).body.state.settings).toMatchObject({ yearBand: 5 });
    t.teacher.yearBand = 6;
    t.teacher.enabledTopics = ['area', 'ratios'];
    t.teacher.enabledTables = [3, 4];
    const now = (await t.send({ type: 'load' })).body.state.settings;
    expect(now).toEqual({ yearBand: 6, enabledTopics: ['area', 'ratios'], enabledTables: [3, 4] });
    // A fight started now is made with them.
    const start = await t.send({ type: 'fightStart', depth: 0, boss: false });
    expect(start.body.state.fight.settings).toEqual(now);
  });

  it('does not change an open fight when the teacher changes the settings', async () => {
    const t = setup();
    await t.send(create());
    const start = await t.send({ type: 'fightStart', depth: 3, boss: false });
    const original = start.body.state.fight.settings;
    t.teacher.yearBand = 4;
    t.teacher.enabledTopics = ['times'];
    let state = start.body.state;
    for (let i = 0; i < 20 && state.fight; i++) {
      expect(state.fight.settings).toEqual(original);
      const out = await t.send(nextRound(state.fight, state.clan.members));
      // The round is marked with the OLD questions: a right answer to one of them is right, so the Battle Cry counts.
      expect(out.body.ok).toBe(true);
      expect(out.body.result.earned?.cries ?? 1).toBe(1);
      state = out.body.state;
    }
    expect(state.fight).toBeNull();
    expect(state.settings.yearBand).toBe(4);
    // The next fight uses the new ones.
    const next = await t.send({ type: 'fightStart', depth: 1, boss: false });
    expect(next.body.state.fight.settings.yearBand).toBe(4);
  });

  it('gives a new clan, and a new day, the teacher\'s number of mine fights', async () => {
    let clock = NOW;
    const t = setup({}, () => clock);
    t.teacher.fightsPerDay = 3;
    const made = await t.send(create());
    expect(made.body.state.fightsLeft).toBe(3);
    await t.send({ type: 'fightStart', depth: 0, boss: false });
    expect(t.clans.get('student-1')!.state.fightsLeft).toBe(2);
    t.clans.get('student-1')!.state.fight = null;
    clock += 24 * 3600 * 1000;
    t.teacher.fightsPerDay = 5;
    const next = await t.send({ type: 'load' });
    expect(next.body.state.day).toBe(2);
    expect(next.body.state.fightsLeft).toBe(5);
  });

  it('records a quest puzzle answer, right or wrong, in the private records', async () => {
    const t = setup();
    await t.send(create());
    const row = t.clans.get('student-1')!;
    // Find a day whose story has a choice with a puzzle (not every story has one).
    let found: { day: number; choice: number } | null = null;
    for (let day = 1; day < 40 && !found; day++) {
      const q = todaysQuest(row.state.seed, day, DEFAULT_PRACTICAL_SETTINGS);
      const choice = q ? q.choices.findIndex((c) => c.puzzle) : -1;
      if (choice >= 0) found = { day, choice };
    }
    expect(found).not.toBeNull();
    row.state.day = found!.day;
    row.state.createdNzDay = DAY - (found!.day - 1);
    row.state.clan.members.forEach((m) => (m.stats.charisma = 20));
    const out = await t.send({ type: 'quest', choice: found!.choice, answer: 987654 });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.right).toBe(false);
    const list = t.answers.flatMap((a) => a.list);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ correct: false });
    expect(list[0].key).toMatch(/^clan:y5:quest-[a-z-]+$/);
  });

  it('says so, and does nothing, when the database cannot give the settings', async () => {
    const t = setup({ extras: async () => ({ ok: false, why: 'busy' }) });
    const out = await t.send({ type: 'load' });
    expect(out.status).toBe(503);
    expect(t.log).toEqual([]);
  });
});

describe('ladder fights through the server function', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });
  const stored = (t: ReturnType<typeof setup>) => t.clans.get('student-1')!.state.fight as OpenFight;

  it('loads the child\'s maths only to start a ladder fight, and keeps the questions with the fight', async () => {
    const t = setup();
    await t.send(create());
    await t.send({ type: 'load' });
    expect(t.ladder.loads).toEqual([]);
    const start = await t.send({ type: 'fightStart', depth: 1, boss: false, ladder: true });
    expect(start.body.ok).toBe(true);
    expect(t.ladder.loads).toEqual(['student-1']);
    expect(stored(t).questions).toHaveLength(8);
  });

  it('never shows the browser an answer: only what to show of each question, by its round', async () => {
    const t = setup();
    await t.send(create());
    const start = await t.send({ type: 'fightStart', depth: 1, boss: false, ladder: true });
    const shown = start.body.state.fight;
    expect(shown.questions).toHaveLength(8);
    shown.questions.forEach((q: Record<string, unknown>, i: number) => {
      expect(q.slot).toBe(i);
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('factKey');
      expect(q).not.toHaveProperty('params');
    });
    expect(JSON.stringify(start.body)).not.toMatch(/"answer"|"factKey"|"params"/);
    // A refresh (load) is the same.
    expect(JSON.stringify((await t.send({ type: 'load' })).body)).not.toMatch(/"answer"|"factKey"|"params"/);
  });

  it('marks an answer, keeps it in the child\'s own maths records once, and a resent check counts once too', async () => {
    const t = setup();
    await t.send(create());
    await t.send({ type: 'fightStart', depth: 1, boss: false, ladder: true });
    const q = stored(t).questions![0];
    const requestId = t.id();
    const first = await t.send({ type: 'cryCheck', round: 1, answer: q.answer, ms: 3000 }, { requestId });
    expect(first.body.result).toEqual({ type: 'cryCheck', round: 1, correct: true, answer: q.answer, given: q.answer });
    // The same request again (a dropped connection), then a new one for the same question.
    expect((await t.send({ type: 'cryCheck', round: 1, answer: q.answer, ms: 3000 }, { requestId })).body.result).toEqual(first.body.result);
    expect((await t.send({ type: 'cryCheck', round: 1, answer: 999, ms: 10 })).body.result).toMatchObject({ correct: true });
    expect(t.ladder.kept).toHaveLength(1);
    expect(t.ladder.kept[0].list).toEqual([{ key: q.factKey, correct: true, ms: 3000, at: NOW }]);
    // None of it goes in the old Clan Quest records.
    expect(t.answers).toEqual([]);
  });

  it('starts an old-style fight for an older browser, and when the child\'s maths can\'t be read', async () => {
    const t = setup();
    await t.send(create());
    await t.send({ type: 'fightStart', depth: 1, boss: false });
    expect(t.ladder.loads).toEqual([]);
    expect(stored(t).questions).toBeUndefined();
    const u = setup();
    u.ladder.context = null;
    await u.send(create());
    expect((await u.send({ type: 'fightStart', depth: 1, boss: false, ladder: true })).body.ok).toBe(true);
    expect(stored(u).questions).toBeUndefined();
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

describe('the season clock', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });
  const CLOCK = { number: 2, day: 24, daysLeft: 12, clockOn: true };

  it('sends the clock to the browser, and null when the database has none or sends something odd', async () => {
    const none = setup();
    expect((await none.send(create())).body.state.clock).toBeNull();
    const odd = setup();
    await odd.send(create());
    odd.flags.clock = { number: 'two' };
    expect((await odd.send({ type: 'load' })).body.state.clock).toBeNull();
    const on = setup();
    on.flags.clock = CLOCK;
    expect((await on.send(create())).body.state.clock).toEqual(CLOCK);
  });

  it('stamps an old save with the season without resetting, and saves it', async () => {
    const t = setup();
    await t.send(create());
    t.clans.get('student-1')!.state.clan.gold = 777;
    t.flags.clock = CLOCK;
    const out = await t.send({ type: 'load' });
    expect(out.body.newSeason).toBeUndefined();
    expect(t.clans.get('student-1')!.state.clan).toMatchObject({ season: 2, gold: 777 });
  });

  it('starts a new season on the first load after the clock moves on, and says so', async () => {
    const t = setup();
    t.flags.clock = { ...CLOCK, number: 1, day: 3 };
    await t.send(create());
    await t.send({ type: 'load' });
    expect(t.clans.get('student-1')!.state.clan.season).toBe(1);
    t.clans.get('student-1')!.state.clan.gold = 777;
    t.flags.clock = { number: 2, day: 1, daysLeft: 34, clockOn: true };
    const out = await t.send({ type: 'load' });
    expect(out.body.newSeason).toBe(true);
    expect(out.body.state.clan).toMatchObject({ season: 2, gold: CONFIG.startGold });
    expect(t.clans.get('student-1')!.state.clan).toMatchObject({ season: 2, gold: CONFIG.startGold });
    // Only once.
    expect((await t.send({ type: 'load' })).body.newSeason).toBeUndefined();
  });

  it('rests classmate raids in the last two weeks', async () => {
    const t = setup();
    await t.send(create());
    t.flags.clock = CLOCK;
    t.flags.raidsOn = true;
    const out = await t.send({ type: 'raidTargets' });
    expect(out.body.result).toEqual({ type: 'raidTargets', targets: [], resting: true });
  });
});

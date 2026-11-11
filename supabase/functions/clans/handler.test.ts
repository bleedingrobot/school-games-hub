import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OpenFight, Result, ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { nzDayNumber } from '../../../shared/clans/clock';
import type { Empire, Village } from '../../../shared/clans/types';
import { empireOf } from '../../../shared/clans/empire';
import type { Sketch } from '../../../shared/clans/village';
import { addEarned, fameFor, measures, NO_STATS, pointsFor, reached, type ClanStats, type Earned } from '../../../shared/clans/rewards';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { parseFocus } from '../../../shared/maths/focus';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { CONFIG } from '../../../shared/clans/config';
import { makeHandler, type Extras, type Loaded, type LoadedTarget, type Outcome, type SaveStatus, type Services } from './handler';

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
  it('ignores gold, stats and days the browser puts in a request', async () => {
    const { send, clans } = setup();
    await send(create());
    await send(null, { raw: { requestId: '00000000-0000-4000-8000-0000000000ee', action: { type: 'upgrade', building: 'trainingHall', clan: { gold: 99999 }, state: { day: 99 } }, gold: 99999 } });
    expect(clans.get('student-1')!.state.clan.gold).toBe(CONFIG.startGold - TH_COST);
    expect(clans.get('student-1')!.state.day).toBe(1);
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
const selfOf = async (t: ReturnType<typeof setup>, token: string) => {
  const list = await t.send({ type: 'raidTargets' }, { token: token === 'ana' ? 'ben' : 'ana' });
  return list.body.result.targets.find((x: any) => x.name === (token === 'ana' ? 'Red Banner' : 'Swift Foxes')).id as string;
};

describe('raids on classmates', () => {
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
});

describe('ladder fights through the server function', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });
  const stored = (t: ReturnType<typeof setup>) => t.clans.get('student-1')!.state.fight as OpenFight;

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
});

describe('the deployed file', () => {
  it('is up to date (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('clans');
    expect(readFileSync(resolve('supabase/functions/clans/index.ts'), 'utf8')).toBe(built);
  });
});

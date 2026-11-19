import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OpenFight, Result, ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import type { Village } from '../../../shared/clans/types';
import { empireOf } from '../../../shared/clans/empire';
import type { RivalSketch } from '../../../shared/clans/raids';
import type { DuelRow } from '../../../shared/clans/duelServer';
import { villageOf, type DuelPick } from '../../../shared/clans/duel';
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
 * Stands in for the database the way load_clan(), save_clan() and save_village_raid() behave: copies in and out, versions, remembered requests,
 * the village news every pupil reads, each clan's private notes, and the old group village's levels (used once, to convert an old save).
 */
function fakeDb() {
  const clans = new Map<string, { version: number; state: ServerState; requests: Map<string, Result> }>();
  const seeds = new Map<string, number>();
  const log: string[] = [];
  const flags = { enabled: true, duelsOn: true, raidsOn: false, news: ['One fight was won in the Mines yesterday.'] as string[], clock: undefined as unknown };
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
  // Live duels, the way migration 20261117000400 keeps them: hidden picks, one maths answer per round, prizes to both sides.
  const duels = new Map<number, DuelRow & { used: [number, number] }>();
  const duelPicks = new Map<string, [DuelPick | null, DuelPick | null]>();
  const bump = (d: DuelRow & { used: [number, number] }) => ({ ...json(d), used: d.used, version: d.version + 1 });
  const duelDb: Pick<Services, 'duelLoad' | 'duelChallenge' | 'duelAnswer' | 'duelPick' | 'duelRoundPicks' | 'duelRound' | 'duelEnd'> = {
    async duelLoad(id) {
      const d = duels.get(id);
      return { ok: true, value: d ? { duel: json(d), on: [flags.duelsOn, flags.duelsOn] } : null };
    },
    async duelChallenge(player, other) {
      const them = playerOf(other);
      const a = clans.get(player);
      const b = them ? clans.get(them) : undefined;
      if (!a || !b || !them || them === player) return { ok: true, value: { result: 'away', duel: null } };
      if (!flags.duelsOn) return { ok: true, value: { result: 'off', duel: null } };
      const clanOf = (c: ServerState['clan']) => ({ heroes: c.members.map((m) => ({ race: m.race, cls: m.cls, look: m.look ?? null })), village: villageOf(empireOf(c).levels) });
      const id = duels.size + 1;
      duels.set(id, {
        id, seat_a: player, seat_b: them, name_a: a.state.clan.name, name_b: b.state.clan.name, clans: [clanOf(a.state.clan), clanOf(b.state.clan)],
        status: 'asked', rounds: [], missed: [0, 0], deadline: new Date(NOW + 30_000).toISOString(), winner: null, ending: null, leaver: null,
        gold: [0, 0], banners: [0, 0], cheers: [null, null], version: 0, created_at: new Date(NOW).toISOString(), finished_at: null, used: [0, 0],
      });
      return { ok: true, value: { result: 'ok', duel: id } };
    },
    async duelAnswer(player, id, accept) {
      const d = duels.get(id);
      if (!d || d.seat_b !== player) return { ok: true, value: { result: 'not-yours' } };
      const next = { ...bump(d), status: accept ? 'playing' as const : 'declined' as const, deadline: new Date(NOW + 60_000).toISOString() };
      duels.set(id, next);
      return { ok: true, value: { result: 'ok', duel: json(next) } };
    },
    async duelPick(player, id, round, move, right, askNo) {
      const d = duels.get(id)!;
      const seat = d.seat_a === player ? 0 : 1;
      const key = `${id}:${round}`;
      const picks = duelPicks.get(key) ?? [null, null];
      // Like the database: a maths question already used for an earlier round counts as wrong.
      const fresh = askNo !== null && askNo > d.used[seat];
      if (picks[seat]) return { ok: true, value: { result: 'already', duel: json(d), picks } };
      picks[seat] = { move: move as DuelPick['move'], right: right && fresh };
      if (fresh) d.used[seat] = askNo!;
      duelPicks.set(key, picks);
      return { ok: true, value: { result: 'ok', duel: json(d), picks: json(picks) } };
    },
    async duelRoundPicks(id, round) {
      return { ok: true, value: duelPicks.get(`${id}:${round}`) ?? [null, null] };
    },
    async duelRound(id, version, rounds, missed) {
      const d = duels.get(id)!;
      if (d.version !== version) return { ok: true, value: null };
      const next = { ...bump(d), rounds: json(rounds), missed };
      duels.set(id, next);
      return { ok: true, value: json(next) };
    },
    async duelEnd(id, version, status, ending, winner, leaver, rounds, gold, banners) {
      const d = duels.get(id)!;
      if (d.version !== version) return { ok: true, value: null };
      const next = { ...bump(d), status, ending, winner, leaver, rounds: rounds ? json(rounds) : d.rounds, gold: gold ?? [0, 0] as [number, number], banners: banners ?? [0, 0] as [number, number] };
      ([d.seat_a, d.seat_b] as const).forEach((who, i) => {
        const row = clans.get(who)!;
        row.state.clan.gold += next.gold[i];
        const e = empireOf(row.state.clan);
        e.banners = { week: 1, count: (e.banners?.count ?? 0) + next.banners[i] };
        row.version++;
      });
      duels.set(id, next);
      return { ok: true, value: json(next) };
    },
  };
  const pouch = { amount: 0 };
  const db: Pick<Services, 'load' | 'openPouches' | 'save' | 'mates' | 'target' | 'saveRaid' | 'extras' | 'recordAnswers' | 'mathsContext' | 'recordLadderAnswers'> & { raceOnce?: () => void } = {
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
    async openPouches(player, version) {
      const row = clans.get(player);
      if (!pouch.amount || !row || row.version !== version) return null;
      row.state.clan.gold += pouch.amount;
      row.version++;
      const amount = pouch.amount;
      pouch.amount = 0;
      return { amount, version: row.version };
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
      const list: RivalSketch[] = [];
      for (const [p, row] of clans) {
        if (p === player) continue;
        const e = empireOf(row.state.clan);
        list.push({ id: publicId(p), name: row.state.clan.name, heroLevels: row.state.clan.members.reduce((t, m) => t + m.level, 0), levels: { ...e.levels }, troops: { ...e.troops }, banners: e.banners ?? null });
      }
      return { ok: true, value: list };
    },
    async target(player, id) {
      const p = playerOf(id);
      const row = p && p !== player ? clans.get(p) : undefined;
      if (!p || !row) return { ok: true, value: null };
      return { ok: true, value: { id, name: row.state.clan.name, empire: json(empireOf(row.state.clan)), gold: row.state.clan.gold, members: json(row.state.clan.members), version: row.version } satisfies LoadedTarget };
    },
    async saveRaid(player, expected, raid, requestId, state, result): Promise<Outcome<SaveStatus>> {
      const defender = playerOf(raid.targetId);
      const a = clans.get(player);
      const d = defender ? clans.get(defender) : undefined;
      if (!a || !d || !defender) return { ok: false, why: 'refused' };
      const dup = a.requests.get(requestId);
      if (dup) return { ok: true, value: { status: 'duplicate', result: json(dup) } };
      if (a.version !== expected || d.version !== raid.targetVersion) return { ok: true, value: { status: 'stale' } };
      if (!flags.raidsOn) return { ok: false, why: 'refused' };
      // Like the database: the raided clan can only be given the held reward, never have anything taken.
      if (raid.gold < 0 || raid.gold > 45) return { ok: false, why: 'refused' };
      a.requests.set(requestId, json(result));
      clans.set(player, { version: a.version + 1, state: json(state), requests: a.requests });
      earn(player, result);
      const after = json(d.state);
      Object.assign(empireOf(after.clan), { banners: json(raid.banners), held: json(raid.held) });
      after.clan.gold += raid.gold;
      clans.set(defender, { version: d.version + 1, state: after, requests: d.requests });
      village.news.unshift(raid.news);
      notes.set(defender, [raid.note, ...(notes.get(defender) ?? [])]);
      log.push(`${player}:villageRaid`);
      return { ok: true, value: { status: 'saved', version: a.version + 1 } };
    },
  };
  return { db: { ...db, ...duelDb }, pouch, clans, log, flags, village, group, notes, fame, points, answers, teacher, stats, ladder, duelPicks };
}

function setup(over: Partial<Services> = {}, now = () => NOW) {
  const { db, pouch, clans, log, flags, village, group, notes, fame, points, answers, teacher, stats, ladder, duelPicks } = fakeDb();
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
  return { send, pouch, clans, log, services, id, handler, flags, village, group, notes, fame, points, answers, teacher, stats, ladder, duelPicks };
}

const create = (seed = SEED) => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(seed) });

describe('the clans server function', () => {
  it('needs a signed-in student, and keeps clans of different students apart', async () => {
    const { send } = setup();
    expect((await send({ type: 'load' }, { token: null })).status).toBe(401);
    expect((await send({ type: 'load' }, { token: 'fake' })).status).toBe(401);
    await send(create());
    await send(create(), { token: 'ben' });
    await send({ type: 'upgrade', building: 'trainingHall' });
    const ben = await send({ type: 'load' }, { token: 'ben' });
    expect(ben.body.state.clan.gold).toBe(200);
    expect(ben.body.state.seed).not.toBe(SEED);
    // Quest Game Coins pouch: opened on load.
    {
      const { send, pouch, clans } = setup();
      await send(create());
      const before = clans.get('student-1')!.state.clan.gold;
      const version = clans.get('student-1')!.version;
      pouch.amount = 150;
      const r = await send({ type: 'load' });
      expect(r.body.pouch).toEqual({ amount: 150 });
      expect(r.body.state.clan.gold).toBe(before + 150);
      expect(clans.get('student-1')!.state.clan.gold).toBe(before + 150);
      expect(clans.get('student-1')!.version).toBe(version + 1);
      const again = await send({ type: 'load' });
      expect(again.body.pouch).toBeUndefined();
      expect(again.body.state.clan.gold).toBe(before + 150);
    }
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


/** Three pupils with brand-new clans (raids work from the very first day). */
async function village(t: ReturnType<typeof setup>) {
  for (const [token, name] of [['ana', 'Red Banner'], ['ben', 'Swift Foxes'], ['cai', 'Brave Owls']] as const) await t.send({ ...create(), name }, { token });
  t.flags.raidsOn = true;
}
const idOf = async (t: ReturnType<typeof setup>, name: string, token = 'ana') =>
  (await t.send({ type: 'raidTargets' }, { token })).body.result.targets.find((x: any) => x.name === name)?.id as string;

describe('Village Raids and Live Clan Duels', () => {
  it('raids and live duels: from day one, nothing taken from anyone, both sides paid, and the rules refuse what they should', async () => {
    const t = setup();
    await village(t);
    const ben = await idOf(t, 'Swift Foxes');
    expect((await t.send({ type: 'raidStart', target: 'nobody' })).body).toMatchObject({ ok: false, why: 'target' });
    expect((await t.send({ type: 'raidStart', target: await idOf(t, 'Red Banner', 'ben') })).body).toMatchObject({ ok: false, why: 'target' });
    const before = json(t.clans.get('student-2')!.state.clan);
    const anaGold = t.clans.get('student-1')!.state.clan.gold;
    const start = await t.send({ type: 'raidStart', target: ben });
    expect(start.body).toMatchObject({ ok: true, result: { type: 'raidStart', resumed: false } });
    // The browser sees the defenders by race and class only, never a pupil's hero names.
    const shown = start.body.state.fight;
    expect(shown.raid.defenders.map((m: any) => m.name)).toEqual(before.members.map((m) => `${m.race} ${m.cls}`));
    expect(JSON.stringify(shown)).not.toContain(before.members[0].name);
    let last: Record<string, any> = start.body;
    for (let round = 1; round <= CONFIG.maxRounds && !last.result?.over; round++) {
      last = (await t.send({ type: 'fightRound', round, orders: before.members.map(() => ({ action: 'attack', target: 0 })), cry: null })).body;
      expect(last.ok).toBe(true);
    }
    const raid = last.result.raid;
    expect(raid).toMatchObject({ name: 'Swift Foxes' });
    const after = t.clans.get('student-2')!.state.clan;
    // Nothing taken: the raided clan's heroes, troops and buildings are as they were; its purse only goes up when it held.
    expect(after.members).toEqual(before.members);
    expect(empireOf(after).levels).toEqual(empireOf(before).levels);
    expect(empireOf(after).troops).toEqual(empireOf(before).troops);
    expect(after.gold).toBe(before.gold + (raid.won ? 0 : CONFIG.classRaids.reward.held.gold));
    // The raiders are paid either way, and their own heroes come home unhurt.
    expect(t.clans.get('student-1')!.state.clan.gold).toBe(anaGold + raid.gold);
    expect(raid.gold).toBe(raid.won ? CONFIG.classRaids.reward[raid.light === 'tough' ? 'wonTough' : 'won'].gold : CONFIG.classRaids.reward.lost.gold);
    expect(t.clans.get('student-1')!.state.clan.members.every((m) => !m.knockedOut)).toBe(true);
    expect(t.notes.get('student-2')?.[0]).toMatch(raid.won ? /got past your walls\. Nothing was taken\./ : /held off raiders from the Red Banner clan!/);
    // Same clan twice in a day: no. The Banners board shows the raiders.
    expect((await t.send({ type: 'raidStart', target: ben })).body).toMatchObject({ ok: false, why: 'same' });
    const list = (await t.send({ type: 'raidTargets' })).body.result;
    expect(list.left).toBe(CONFIG.classRaids.perDay - 1);
    expect(list.board.find((r: any) => r.me)).toMatchObject({ name: 'Red Banner', banners: raid.banners });
    // The teacher's switch stops a raid before it starts.
    t.flags.raidsOn = false;
    expect((await t.send({ type: 'raidStart', target: await idOf(t, 'Brave Owls') })).body).toMatchObject({ ok: false, why: 'off' });

    // ---- Live Clan Duels (shared/clans/duelServer.ts): ana duels ben, each round powered by one maths question. ----
    const duelSend = (raw: Record<string, unknown>, token = 'ana') => t.send(null, { token, raw });
    const gold = (who: string) => t.clans.get(who)!.state.clan.gold;
    const before2 = [gold('student-1'), gold('student-2')];
    const asked = await duelSend({ action: 'duel-challenge', other: ben });
    expect(asked.status).toBe(200);
    const duelId = asked.body.duel.id as number;
    expect(asked.body.duel).toMatchObject({ status: 'asked', name_a: 'Red Banner', name_b: 'Swift Foxes' });
    // The defenders are shown by race and class only, never a pupil's hero names.
    expect(JSON.stringify(asked.body.duel.clans)).not.toContain(t.clans.get('student-2')!.state.clan.members[0].name);
    expect((await duelSend({ action: 'duel-answer', duel: duelId, accept: true }, 'ben')).body.duel.status).toBe('playing');
    // One answer, one round: a pick sent with no new question counts as a graze.
    const answer = async (token: string) => {
      const who = token === 'ana' ? 'student-1' : 'student-2';
      await t.send({ type: 'ask', for: 'duel' }, { token });
      const q = t.clans.get(who)!.state.ask!.questions[0];
      await t.send({ type: 'askCheck', slot: 0, answer: q.answer, ms: 2000 }, { token });
    };
    let row: Record<string, any> = {};
    for (let round = 0; round < 8; round++) {
      if (round !== 1) await answer('ana');
      await answer('ben');
      await duelSend({ action: 'duel-pick', duel: duelId, round, move: 'charge' });
      if (round === 1) expect(t.duelPicks.get(`${duelId}:1`)![0]).toEqual({ move: 'charge', right: false });
      row = (await duelSend({ action: 'duel-pick', duel: duelId, round, move: 'volley' }, 'ben')).body.duel;
      if (row.status === 'done') break;
    }
    // Charge rides down Volley every round, so ana's clan wins; both clans are paid, and nobody loses anything.
    expect(row).toMatchObject({ status: 'done', ending: 'finished', winner: 0, gold: [40, 15], banners: [3, 1] });
    expect([gold('student-1'), gold('student-2')]).toEqual([before2[0] + 40, before2[1] + 15]);
    expect((await duelSend({ action: 'duel-pick', duel: duelId, round: 9, move: 'charge' })).status).toBe(409);
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
    expect(t.ladder.kept[0].list).toEqual([{ key: q.factKey, correct: true, ms: 3000, at: NOW, given: q.answer }]);
    // None of it goes in the old Clan Quest records.
    expect(t.answers).toEqual([]);
  });
});

describe('ask through the server function', () => {
  const create = () => ({ type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) });
  const stored = (t: ReturnType<typeof setup>) => t.clans.get('student-1')!.state.ask!;

  it('shows no answers, is null when nothing is waiting, and keeps an askCheck answer in the child\'s own records once', async () => {
    // shows the questions and marks, never an answer, a fact key or params
    {
      const t = setup();
      await t.send(create());
      const asked = await t.send({ type: 'ask', for: 'quest' });
      expect(asked.body.ok).toBe(true);
      expect(asked.body.state.ask.for).toBe('quest');
      expect(asked.body.state.ask.questions).toHaveLength(2);
      expect(JSON.stringify(asked.body)).not.toMatch(/"answer"|"factKey"|"params"/);
      expect((await t.send({ type: 'load' })).body.state.ask.questions).toHaveLength(2);
      expect(JSON.stringify((await t.send({ type: 'load' })).body)).not.toMatch(/"factKey"|"params"/);
      // After a check the mark shows (the answer given), but the right answer is still not in the state.
      const q = stored(t).questions[0];
      const checked = await t.send({ type: 'askCheck', slot: 0, answer: q.answer, ms: 900 });
      expect(checked.body.result).toMatchObject({ type: 'askCheck', slot: 0, correct: true });
      const state = JSON.stringify(checked.body.state);
      expect(state).not.toMatch(/"factKey"|"params"/);
      expect(checked.body.state.ask.marks[0]).toMatchObject({ correct: true });
      expect(checked.body.state.ask.questions.every((x: Record<string, unknown>) => !('answer' in x))).toBe(true);
  
    }
    // is null when nothing is waiting, and needs the child\'s maths
    {
      const t = setup();
      expect((await t.send(create())).body.state.ask).toBeNull();
      t.ladder.context = null;
      expect((await t.send({ type: 'ask', for: 'shop' })).body).toMatchObject({ ok: false, why: 'no-maths' });
  
    }
    // keeps an askCheck answer in the child\'s own records once
    {
      const t = setup();
      await t.send(create());
      await t.send({ type: 'ask', for: 'shop' });
      const q = stored(t).questions[0];
      await t.send({ type: 'askCheck', slot: 0, answer: q.answer, ms: 1200 });
      await t.send({ type: 'askCheck', slot: 0, answer: 0, ms: 5 });
      expect(t.ladder.kept).toHaveLength(1);
      expect(t.ladder.kept[0].once).toBe(`clans:ask:${SEED}:1:0`);
      expect(t.ladder.kept[0].list).toMatchObject([{ key: q.factKey, correct: true, ms: 1200 }]);
      expect(t.answers).toEqual([]);
  
    }
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

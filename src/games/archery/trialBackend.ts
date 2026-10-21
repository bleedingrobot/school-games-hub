/**
 * A pretend Archery server that runs in the browser (docs/ARCHERY-PLAN.md, section 12, stage 4): the real server
 * function's logic (`makeHandler` from supabase/functions/archery/handler.ts) on a pretend database that keeps the
 * same rules as the SQL functions in migrations 20261021000300 and 20261022000100 (coins never below 0, a purchase or
 * fight start sent twice counts once, a question marked once, packed gear taken out and the unused part given back;
 * classmate fights only in the same class, one at a time, saved "only if nothing changed", gear back at the end).
 *
 * Several pretend pupils can share one pretend server (`trialHub`), so the preview's two players can fight each other.
 *
 * Used by the preview (no sign-in, nothing sent anywhere) and by the server function's own tests. It never calls a
 * server: the maths questions come from a fixed pretend pupil with no records (the times-table step).
 */
import { makeHandler, type ArmoryState, type Services, type StoredFight, type StoredRound } from '../../../supabase/functions/archery/handler';
import { HERE_FOR_MS } from '../../../shared/archery/config';
import { duelOpen, type DuelRow } from '../../../shared/archery/duel';
import type { MathsContext } from '../../../shared/archery/speed';
import type { ItemId, PlayerSetup } from '../../../shared/archery/types';

interface Pupil extends ArmoryState {
  rounds: { at: number; earns: boolean }[];
}

/** What the pretend server keeps (so the preview can save it to the device and tests can look inside). */
export interface TrialData {
  pupils: Record<string, Pupil>;
  rounds: Record<string, StoredRound & { player: string }>;
  fights: Record<number, StoredFight & { player: string }>;
  requests: Record<string, unknown>;
  nextFight: number;
  points: { player: string; points: number; once: string }[];
  answers: { player: string; once: string; correct: boolean }[];
  /** Classmate fights (left out of copies saved before Stage 6). */
  duels?: Record<number, DuelRow>;
  nextDuel?: number;
  /** When each pupil last said "I'm here" (ms). */
  here?: Record<string, number>;
}

export const emptyTrialData = (): TrialData => ({ pupils: {}, rounds: {}, fights: {}, requests: {}, nextFight: 1, points: [], answers: [], duels: {}, nextDuel: 1, here: {} });

/** A pretend pupil's profile: their display name, class and school (anyone not listed is in class "c1" at school 1). */
export interface TrialPupil {
  name: string;
  classId: string | null;
  school?: number;
}

/** What "I'm here" gives back (the same shape as the database's archery_here()). */
export interface HereReply {
  off?: true;
  online: { id: string; name: string; avatar: Record<string, unknown>; busy: boolean }[];
  asks: { duel: number; from: string; world: string; deadline: string }[];
  duel: DuelRow | null;
}

export interface TrialOptions {
  now?: () => number;
  random?: () => number;
  /** Is the game switched on for this pupil's class (default yes)? */
  enabled?: (player: string) => boolean;
  maths?: MathsContext;
  data?: TrialData;
  /** The pretend pupils (names, classes, schools). */
  pupils?: Record<string, TrialPupil>;
  /** Told about every change to a classmate fight (the preview's stand-in for Realtime). */
  onDuel?: (duel: DuelRow) => void;
}

const DAY = 24 * 3600 * 1000;

function plusGear(gear: Partial<Record<ItemId, number>>, delta: Partial<Record<ItemId, number>>, sign: 1 | -1) {
  const out: Partial<Record<ItemId, number>> = { ...gear };
  for (const [id, n] of Object.entries(delta) as [ItemId, number][]) {
    const v = (out[id] ?? 0) + sign * n;
    if (v > 0) out[id] = v;
    else delete out[id];
  }
  return out;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const iso = (ms: number) => new Date(ms).toISOString();

const view = (p: Pupil): ArmoryState => ({ coins: p.coins, gear: { ...p.gear }, shields: [...p.shields], bows: [...p.bows], spent: p.spent, best: { ...p.best } });

/** The pretend database, as the handler's Services. */
export function trialServices(opts: TrialOptions = {}) {
  const data = opts.data ?? emptyTrialData();
  const now = opts.now ?? (() => Date.now());
  const random = opts.random ?? Math.random;
  const pupil = (id: string): Pupil => (data.pupils[id] ??= { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] });
  const remember = (player: string, request: string, reply: unknown) => {
    data.requests[`${player}:${request}`] = reply;
    return reply;
  };
  const returnOpen = (player: string, status: StoredFight['status']) => {
    const p = pupil(player);
    for (const f of Object.values(data.fights)) {
      if (f.player !== player || f.status !== 'playing') continue;
      f.status = status;
      p.gear = plusGear(p.gear, f.pack.quiver, 1);
    }
  };

  const profile = (id: string): TrialPupil => opts.pupils?.[id] ?? { name: 'Preview Pupil 1', classId: 'c1', school: 1 };
  const on = (id: string) => (opts.enabled ? opts.enabled(id) : true);
  const duels = () => (data.duels ??= {});
  const busy = (id: string) => Object.values(duels()).some((d) => (d.status === 'packing' || d.status === 'playing') && (d.seat_a === id || d.seat_b === id));
  /** Saves a change to a fight and tells the listeners (Realtime, in the real thing). */
  const changed = (d: DuelRow) => {
    d.version += 1;
    opts.onDuel?.(clone(d));
    return clone(d);
  };
  /** archery_duel_close: gear back to each seat that packed (less what it used), and the fight marked ended. */
  const close = (d: DuelRow, status: DuelRow['status'], ending: DuelRow['ending'], winner: DuelRow['winner'], leaver: DuelRow['leaver'], turns: DuelRow['turns'] | null, used: DuelRow['used'] | null, timeouts: DuelRow['timeouts'] | null) => {
    Object.assign(d, { status, ending, winner, leaver, finished_at: iso(now()) });
    if (turns) d.turns = clone(turns);
    if (used) d.used = clone(used);
    if (timeouts) d.timeouts = [...timeouts] as [number, number];
    for (const i of [0, 1] as const) {
      const pack = d.packs[i];
      if (!pack) continue;
      const p = pupil(i === 0 ? d.seat_a : d.seat_b);
      p.gear = plusGear(p.gear, plusGear(pack.quiver, d.used[i], -1), 1);
    }
    return changed(d);
  };
  /** archery_duel_tidy_for: this pupil's challenges and packing that ran out. */
  const tidyFor = (id: string) => {
    for (const d of Object.values(duels())) {
      if ((d.status === 'asked' || d.status === 'packing') && Date.parse(d.deadline) < now() && (d.seat_a === id || d.seat_b === id)) {
        close(d, d.status === 'asked' ? 'expired' : 'cancelled', null, null, null, null, null, null);
      }
    }
  };

  const services: Services = {
    userIdFor: async (token) => (token ? token : null),
    enabled: async (player) => on(player),
    mathsContext: async () => opts.maths ?? { facts: [], settings: {} },
    now,
    randomHex: (bytes) => Array.from({ length: bytes }, () => Math.floor(random() * 256).toString(16).padStart(2, '0')).join(''),
    async state(player) {
      const p = pupil(player);
      const t = now();
      return { ok: true, value: { ...view(p), roundsToday: p.rounds.filter((r) => r.earns && t - r.at < DAY).length } };
    },
    async shop(player, request, action, kind, item, price, qty, needSpent, carry) {
      const key = `${player}:${request}`;
      if (key in data.requests) return { ok: true, value: data.requests[key] as never };
      const p = pupil(player);
      const id = item as ItemId;
      let result: 'ok' | 'coins' | 'level' | 'full' | 'owned' | 'none' = 'ok';
      if (action === 'buy') {
        if (p.spent < needSpent) result = 'level';
        else if (p.coins < price) result = 'coins';
        else if (kind === 'gear' && (p.gear[id] ?? 0) + qty > carry) result = 'full';
        else if (kind === 'shield' && p.shields.includes(item as never)) result = 'owned';
        else if (kind === 'bow' && p.bows.includes(item as never)) result = 'owned';
        else {
          p.coins -= price;
          p.spent += price;
          if (kind === 'gear') p.gear = plusGear(p.gear, { [id]: qty }, 1);
          else if (kind === 'shield') p.shields.push(item as never);
          else p.bows.push(item as never);
        }
      } else if ((kind === 'gear' && (p.gear[id] ?? 0) < 1) || (kind === 'shield' && !p.shields.includes(item as never)) || (kind === 'bow' && !p.bows.includes(item as never))) {
        result = 'none';
      } else {
        p.coins += price;
        if (kind === 'gear') p.gear = plusGear(p.gear, { [id]: 1 }, -1);
        p.shields = p.shields.filter((s) => s !== item);
        p.bows = p.bows.filter((b) => b !== item);
      }
      return { ok: true, value: remember(player, request, { result, state: view(p) }) as never };
    },
    async roundStart(player, seed, questions, earns, servedMs) {
      data.rounds[seed] = { player, questions, served: { 0: servedMs }, answered: {}, earns };
      pupil(player).rounds.push({ at: now(), earns });
      return true;
    },
    async roundLoad(player, seed) {
      const r = data.rounds[seed];
      return r && r.player === player ? { questions: r.questions, served: { ...r.served }, answered: { ...r.answered }, earns: r.earns } : null;
    },
    async roundAnswer(player, seed, slot, value, right, coins, nextMs) {
      const r = data.rounds[seed];
      if (!r || r.player !== player || r.served[String(slot)] === undefined || r.answered[String(slot)]) return { claimed: false };
      r.answered[String(slot)] = { value, right, coins };
      if (nextMs !== null) r.served[String(slot + 1)] = nextMs;
      const p = pupil(player);
      p.coins += coins;
      return { claimed: true, coins: p.coins };
    },
    async fightStart(player, request, seed, world, opponent, pack) {
      const key = `${player}:${request}`;
      if (key in data.requests) return { ok: true, value: data.requests[key] as never };
      returnOpen(player, 'abandoned');
      const p = pupil(player);
      const has = Object.entries(pack.quiver).every(([id, n]) => (p.gear[id as ItemId] ?? 0) >= (n ?? 0));
      const ownsShield = !pack.shield || p.shields.includes(pack.shield);
      const ownsBow = !pack.bow || pack.bow === 'starter' || p.bows.includes(pack.bow);
      if (!has || !ownsShield || !ownsBow) return { ok: true, value: remember(player, request, { result: 'gear', state: view(p) }) as never };
      p.gear = plusGear(p.gear, pack.quiver, -1);
      const id = data.nextFight++;
      data.fights[id] = { player, seed, world, opponent, pack: JSON.parse(JSON.stringify(pack)) as PlayerSetup, status: 'playing' };
      return { ok: true, value: remember(player, request, { result: 'ok', fight: id, state: view(p) }) as never };
    },
    async fightLoad(player, fight) {
      const f = data.fights[fight];
      return f && f.player === player ? { seed: f.seed, world: f.world, opponent: f.opponent, pack: f.pack, status: f.status } : null;
    },
    async fightEnd(player, fight, status, back, score) {
      const f = data.fights[fight];
      const p = pupil(player);
      if (!f || f.player !== player || f.status !== 'playing') return { ok: true, value: { result: 'duplicate', best: false, state: view(p) } };
      f.status = status;
      p.gear = plusGear(p.gear, back, 1);
      const best = status === 'done' && score > (p.best[f.world] ?? -1);
      if (best) p.best[f.world] = score;
      return { ok: true, value: { result: 'ok', best, state: view(p) } };
    },
    async duelLoad(duel) {
      const d = duels()[duel];
      return d ? { duel: clone(d), on: [on(d.seat_a), on(d.seat_b)] } : null;
    },
    async duelChallenge(player, request, other, world, seed, waitMs) {
      const key = `${player}:${request}`;
      if (key in data.requests) return { ok: true, value: data.requests[key] as never };
      const me = profile(player), them = opts.pupils?.[other];
      const seen = (data.here ??= {})[other];
      let result: 'ok' | 'away' | 'class' | 'busy' | 'off' = 'ok';
      let id: number | null = null;
      if (!them || other === player || seen === undefined || now() - seen > HERE_FOR_MS) result = 'away';
      else if ((them.school ?? 1) !== (me.school ?? 1) || !me.classId || me.classId !== them.classId) result = 'class';
      else if (!on(other)) result = 'off';
      else if (busy(player) || busy(other)) result = 'busy';
      else {
        for (const old of Object.values(duels())) if (old.seat_a === player && old.status === 'asked') close(old, 'cancelled', null, null, null, null, null, null);
        id = data.nextDuel ?? 1;
        data.nextDuel = id + 1;
        const t = now();
        duels()[id] = {
          id, seat_a: player, seat_b: other, name_a: me.name, name_b: them.name, world, seed, status: 'asked', packs: [null, null], turns: [],
          used: [{}, {}], timeouts: [0, 0], deadline: iso(t + waitMs), winner: null, ending: null, leaver: null, version: -1,
          created_at: iso(t), last_action_at: iso(t), finished_at: null,
        };
        changed(duels()[id]);
      }
      return { ok: true, value: remember(player, request, { result, duel: id }) as never };
    },
    async duelAnswer(player, duel, accept, packMs) {
      const d = duels()[duel];
      if (!d || d.seat_b !== player) return { ok: true, value: { result: 'not-yours' } };
      if (d.status !== 'asked' || Date.parse(d.deadline) <= now()) return { ok: true, value: { result: 'late', duel: clone(d) } };
      if (!accept) return { ok: true, value: { result: 'ok', duel: close(d, 'declined', null, null, null, null, null, null) } };
      if (busy(d.seat_a) || busy(d.seat_b)) return { ok: true, value: { result: 'busy', duel: clone(d) } };
      d.status = 'packing';
      d.deadline = iso(now() + packMs);
      return { ok: true, value: { result: 'ok', duel: changed(d) } };
    },
    async duelPack(player, duel, pack, turnMs) {
      const d = duels()[duel];
      const seat: number = d ? (d.seat_a === player ? 0 : d.seat_b === player ? 1 : -1) : -1;
      if (!d || seat < 0) return { ok: true, value: { result: 'not-yours' } };
      const p = pupil(player);
      if (d.packs[seat]) return { ok: true, value: { result: 'already', duel: clone(d), state: view(p) } };
      if (d.status !== 'packing' || Date.parse(d.deadline) <= now()) return { ok: true, value: { result: 'late', duel: clone(d), state: view(p) } };
      returnOpen(player, 'abandoned');
      const has = Object.entries(pack.quiver).every(([id, n]) => (p.gear[id as ItemId] ?? 0) >= (n ?? 0));
      const ownsShield = !pack.shield || p.shields.includes(pack.shield);
      const ownsBow = !pack.bow || pack.bow === 'starter' || p.bows.includes(pack.bow);
      if (!has || !ownsShield || !ownsBow) return { ok: true, value: { result: 'gear', duel: clone(d), state: view(p) } };
      p.gear = plusGear(p.gear, pack.quiver, -1);
      d.packs[seat] = clone(pack);
      d.last_action_at = iso(now());
      if (d.packs[1 - seat]) {
        d.status = 'playing';
        d.deadline = iso(now() + turnMs);
      }
      return { ok: true, value: { result: 'ok', duel: changed(d), state: view(p) } };
    },
    async duelMove(duel, version, turns, used, timeouts, deadlineMs, real) {
      const d = duels()[duel];
      if (!d || d.version !== version || d.status !== 'playing') return null;
      Object.assign(d, { turns: clone(turns), used: clone(used), timeouts: [...timeouts], deadline: iso(deadlineMs) });
      if (real) d.last_action_at = iso(now());
      return changed(d);
    },
    async duelEnd(duel, version, status, ending, winner, leaver, turns, used, timeouts) {
      const d = duels()[duel];
      if (!d || d.version !== version || !duelOpen(d)) return null;
      return close(d, status, ending, winner, leaver, turns, used, timeouts);
    },
    async recordAnswers(player, once, answers) {
      for (const a of answers) data.answers.push({ player, once, correct: a.correct });
    },
    async awardPoints(player, points, once) {
      if (!data.points.some((x) => x.player === player && x.once === once)) data.points.push({ player, points, once });
    },
  };
  /** archery_here(): "I'm here", and who else is, and any challenges (the same rules as the database's). */
  function here(player: string): HereReply {
    if (!on(player)) return { off: true, online: [], asks: [], duel: null };
    (data.here ??= {})[player] = now();
    tidyFor(player);
    const me = profile(player);
    const online = Object.entries(data.here)
      .filter(([id, at]) => id !== player && now() - at <= HERE_FOR_MS && !!me.classId)
      .filter(([id]) => {
        const p = opts.pupils?.[id];
        return !!p && p.classId === me.classId && (p.school ?? 1) === (me.school ?? 1);
      })
      .map(([id]) => ({ id, name: opts.pupils![id].name, avatar: {}, busy: busy(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const all = Object.values(duels());
    const asks = all
      .filter((d) => d.seat_b === player && d.status === 'asked' && Date.parse(d.deadline) > now())
      .map((d) => ({ duel: d.id, from: d.name_a, world: d.world, deadline: d.deadline }));
    const mine = all
      .filter((d) => ((d.status === 'packing' || d.status === 'playing') && (d.seat_a === player || d.seat_b === player)) || (d.status === 'asked' && d.seat_a === player))
      .sort((a, b) => b.id - a.id)[0];
    return { online, asks, duel: mine ? clone(mine) : null };
  }

  /** The fight as its player can read it (the table's rule: only the two players), or null. */
  function readDuel(player: string, id: number): DuelRow | null {
    const d = duels()[id];
    return d && (d.seat_a === player || d.seat_b === player) ? clone(d) : null;
  }

  /** archery_duel_tidy (every 5 minutes in the real thing): run it by hand in the preview and tests. */
  function tidy(idleMs: number) {
    for (const d of Object.values(duels())) {
      if ((d.status === 'asked' || d.status === 'packing') && Date.parse(d.deadline) < now()) close(d, d.status === 'asked' ? 'expired' : 'cancelled', null, null, null, null, null, null);
      else if (d.status === 'playing' && now() - Date.parse(d.last_action_at) > idleMs) close(d, 'done', 'idle', null, null, null, null, null);
    }
  }

  return { services, data, here, readDuel, tidy };
}

/** One pretend server shared by several pretend pupils (the preview's two players, and the tests). */
export function trialHub(opts: TrialOptions = {}) {
  const trial = trialServices(opts);
  const handle = makeHandler(trial.services);
  return {
    ...trial,
    async sendAs<T = Record<string, unknown>>(player: string, body: Record<string, unknown>): Promise<{ status: number; body: T }> {
      const response = await handle(new Request('https://trial.invalid/archery', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player}` }, body: JSON.stringify(body),
      }));
      return { status: response.status, body: (await response.json()) as T };
    },
  };
}

/** A pretend server: send it the same requests the real one takes (`{ action, … }`), as the pupil `player`. */
export function trialBackend(opts: TrialOptions = {}, player = 'preview-pupil') {
  const { services, data } = trialServices(opts);
  const handle = makeHandler(services);
  return {
    data,
    async send<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<{ status: number; body: T }> {
      const response = await handle(new Request('https://trial.invalid/archery', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player}` }, body: JSON.stringify(body),
      }));
      return { status: response.status, body: (await response.json()) as T };
    },
  };
}

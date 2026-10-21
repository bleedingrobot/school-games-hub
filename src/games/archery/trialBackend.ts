/**
 * A pretend Archery server that runs in the browser (docs/ARCHERY-PLAN.md, section 12, stage 4): the real server
 * function's logic (`makeHandler` from supabase/functions/archery/handler.ts) on a pretend database that keeps the
 * same rules as the SQL functions in migration 20261021000300 (coins never below 0, a purchase or fight start sent
 * twice counts once, a question marked once, packed gear taken out and the unused part given back).
 *
 * Used by the preview (no sign-in, nothing sent anywhere) and by the server function's own tests. It never calls a
 * server: the maths questions come from a fixed pretend pupil with no records (the times-table step).
 */
import { makeHandler, type ArmoryState, type Services, type StoredFight, type StoredRound } from '../../../supabase/functions/archery/handler';
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
}

export const emptyTrialData = (): TrialData => ({ pupils: {}, rounds: {}, fights: {}, requests: {}, nextFight: 1, points: [], answers: [] });

export interface TrialOptions {
  now?: () => number;
  random?: () => number;
  /** Is the game switched on (default yes)? */
  enabled?: () => boolean;
  maths?: MathsContext;
  data?: TrialData;
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

const view = (p: Pupil): ArmoryState => ({ coins: p.coins, gear: { ...p.gear }, shields: [...p.shields], bows: [...p.bows], spent: p.spent, best: { ...p.best } });

/** The pretend database, as the handler's Services. */
export function trialServices(opts: TrialOptions = {}): { services: Services; data: TrialData } {
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

  const services: Services = {
    userIdFor: async (token) => (token ? token : null),
    enabled: async () => (opts.enabled ? opts.enabled() : true),
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
    async recordAnswers(player, once, answers) {
      for (const a of answers) data.answers.push({ player, once, correct: a.correct });
    },
    async awardPoints(player, points, once) {
      if (!data.points.some((x) => x.player === player && x.once === once)) data.points.push({ player, points, once });
    },
  };
  return { services, data };
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

/**
 * Fights against classmates (docs/ARCHERY-PLAN.md, section 7, Stage 6): the rules the server function and both
 * screens share. A classmate fight is **one round** (James, 22 Oct 2026). It's kept as a seed, the world, both packed
 * quivers and the list of turns played so far, where a turn the timer used up is `PASS`. Replaying that list with the
 * engine gives the fight exactly as it is now, on the server and on both pupils' screens, so nobody's browser ever
 * decides what a shot did.
 */
import { DUEL_MAX_TIMEOUTS, MAX_SHOTS_PER_ROUND } from './config';
import { startFight, takeShot, type FightRun } from './fight';
import { unused } from './shop';
import type { FightSetup, ItemId, PlayerSetup, Shot, WorldId } from './types';

/** A turn the timer used up. */
export const PASS: Shot = { angle: 0, power: 0, arrow: 'plain', pass: true };

/** The most turns a classmate fight can have (the round's shot cap). */
export const MAX_DUEL_TURNS = MAX_SHOTS_PER_ROUND;

/** A classmate fight's setup: the world, both packs (seat 0 is the left archer: the one who challenged), one round. */
export function duelSetup(world: WorldId, packs: readonly [PlayerSetup, PlayerSetup]): FightSetup {
  return { world, players: [copyPack(packs[0]), copyPack(packs[1])], oneRound: true };
}

const copyPack = (p: PlayerSetup): PlayerSetup => ({ quiver: { ...p.quiver }, shield: p.shield ?? null, bow: p.bow ?? 'starter' });

/**
 * Replays the turns so far. `problem` says if one broke the rules (it never should: the server checked each one when
 * it was played), and the run stops there.
 */
export function replayDuel(seed: number, setup: FightSetup, turns: readonly Shot[], keepPaths = false): { run: FightRun; problem: string | null } {
  const run = startFight(seed, setup);
  for (const turn of turns) {
    const taken = takeShot(run, turn, keepPaths);
    if (taken.problem) return { run, problem: taken.problem };
  }
  return { run, problem: null };
}

/** Reads one shot a pupil sent (null if it isn't one). A pass can't be sent: only the timer makes those. */
export function readShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { angle, power, arrow, apple, pass } = raw as Record<string, unknown>;
  if (pass !== undefined) return null;
  if (typeof arrow !== 'string' || typeof angle !== 'number' || typeof power !== 'number') return null;
  if (apple !== undefined && typeof apple !== 'boolean') return null;
  return { angle, power, arrow: arrow as Shot['arrow'], ...(apple ? { apple: true } : {}) };
}

/** Reads the turn list as the database keeps it (null if it isn't one). */
export function readTurns(raw: unknown): Shot[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_DUEL_TURNS) return null;
  const out: Shot[] = [];
  for (const t of raw) {
    if (t && typeof t === 'object' && (t as Shot).pass === true) out.push({ ...PASS });
    else {
      const shot = readShot(t);
      if (!shot) return null;
      out.push(shot);
    }
  }
  return out;
}

/** Used-up turns in a row for each seat, after `seat`'s turn: a real shot clears theirs, a pass adds one. */
export function timeoutsAfter(timeouts: readonly [number, number], seat: number, timedOut: boolean): [number, number] {
  const next: [number, number] = [timeouts[0], timeouts[1]];
  next[seat] = timedOut ? next[seat] + 1 : 0;
  return next;
}

/** Has someone let the timer use up DUEL_MAX_TIMEOUTS of their turns in a row? */
export const tooManyTimeouts = (t: readonly [number, number]) => t[0] >= DUEL_MAX_TIMEOUTS || t[1] >= DUEL_MAX_TIMEOUTS;

/** What each player gets back when the fight ends: what they packed, less what they used. */
export function duelBack(setup: FightSetup, used: FightRun['used']): [Partial<Record<ItemId, number>>, Partial<Record<ItemId, number>>] {
  return [unused(setup.players[0], used[0]), unused(setup.players[1], used[1])];
}

/** Damage each player did (their score). */
export function duelScores(run: FightRun): [number, number] {
  const s: [number, number] = [0, 0];
  for (const r of run.records) s[r.player] += r.damage[1 - r.player];
  return s;
}

/** Where a classmate fight is up to (the archery_duels table). */
export type DuelStatus = 'asked' | 'packing' | 'playing' | 'done' | 'declined' | 'expired' | 'cancelled';
/** How a fight that started ended. */
export type DuelEnding = 'finished' | 'left' | 'timeouts' | 'switched-off' | 'idle';

/** One classmate fight, as the database keeps it and both players can read it. Seat 0 (`seat_a`) challenged. */
export interface DuelRow {
  id: number;
  seat_a: string;
  seat_b: string;
  name_a: string;
  name_b: string;
  world: WorldId;
  seed: number;
  status: DuelStatus;
  packs: [PlayerSetup | null, PlayerSetup | null];
  turns: Shot[];
  used: [Partial<Record<ItemId, number>>, Partial<Record<ItemId, number>>];
  timeouts: [number, number];
  /** When the challenge or packing runs out, or the turn's time ends (an ISO time, by the server's clock). */
  deadline: string;
  winner: 0 | 1 | null;
  ending: DuelEnding | null;
  leaver: 0 | 1 | null;
  version: number;
  created_at: string;
  last_action_at: string;
  finished_at: string | null;
}

/** Is it still going (or about to)? */
export const duelOpen = (d: Pick<DuelRow, 'status'>) => d.status === 'asked' || d.status === 'packing' || d.status === 'playing';

/** Which seat this player has (0 or 1), or −1 if it isn't their fight. */
export const seatOf = (d: Pick<DuelRow, 'seat_a' | 'seat_b'>, player: string) => (d.seat_a === player ? 0 : d.seat_b === player ? 1 : -1);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Reads a fight row from the database, the server function or Realtime (null if it isn't one, or is missing parts: a
 * Realtime change can leave out big unchanged columns, so then the screen reads the row again).
 */
export function parseDuel(raw: unknown): DuelRow | null {
  if (!isObj(raw)) return null;
  const r = raw;
  const id = Number(r.id);
  const seed = Number(r.seed);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(seed) || typeof r.seat_a !== 'string' || typeof r.seat_b !== 'string') return null;
  if (!Array.isArray(r.packs) || r.packs.length !== 2 || !Array.isArray(r.used) || r.used.length !== 2 || !Array.isArray(r.timeouts)) return null;
  const turns = readTurns(r.turns);
  if (!turns || typeof r.deadline !== 'string' || typeof r.status !== 'string' || typeof r.version !== 'number') return null;
  const pack = (p: unknown): PlayerSetup | null => (isObj(p) ? { quiver: isObj(p.quiver) ? (p.quiver as PlayerSetup['quiver']) : {}, shield: (p.shield as PlayerSetup['shield']) ?? null, bow: (p.bow as PlayerSetup['bow']) ?? 'starter' } : null);
  const seatNum = (v: unknown): 0 | 1 | null => (v === 0 || v === 1 ? v : null);
  return {
    id, seed, seat_a: r.seat_a, seat_b: r.seat_b, name_a: String(r.name_a ?? ''), name_b: String(r.name_b ?? ''),
    world: r.world as WorldId, status: r.status as DuelStatus,
    packs: [pack(r.packs[0]), pack(r.packs[1])], turns,
    used: [isObj(r.used[0]) ? (r.used[0] as DuelRow['used'][0]) : {}, isObj(r.used[1]) ? (r.used[1] as DuelRow['used'][1]) : {}],
    timeouts: [Number(r.timeouts[0]) || 0, Number(r.timeouts[1]) || 0],
    deadline: r.deadline, winner: seatNum(r.winner), ending: (r.ending as DuelEnding | null) ?? null, leaver: seatNum(r.leaver),
    version: r.version, created_at: String(r.created_at ?? ''), last_action_at: String(r.last_action_at ?? ''),
    finished_at: typeof r.finished_at === 'string' ? r.finished_at : null,
  };
}

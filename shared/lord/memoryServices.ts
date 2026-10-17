/**
 * A stand-in for the database that follows the same rules as lord_commit() (in supabase/migrations): a
 * change must be made from the current version, an id is used once, one fight is open at a time and a
 * fight is finished once. The `lord` function's tests use it, and so does the browser-only trial
 * (preview/lord), which keeps it in localStorage so the hero survives a refresh.
 */
import type { FactAnswer } from '../maths/leitner';
import type { Commit, LordRow, OpenFight, Outcome, Services, Settings } from './server';

export interface MemoryDb {
  settings: Settings;
  teacher: boolean;
  row: LordRow | null;
  openFight: OpenFight | null;
  requestIds: string[];
  fights: { id: string; status: 'open' | 'finished' | 'abandoned'; actions: unknown[]; result: unknown }[];
  events: { requestId: string; action: string; summary: object }[];
  refusals: { reason: string; action: string }[];
  /** Answers by batch key, as the maths records would count them. */
  batches: Record<string, { pack: string; answers: FactAnswer[] }>;
}

export const emptyDb = (settings: Partial<Settings> = {}): MemoryDb => ({
  settings: { enabled: true, forestPerDay: 10, seasonStart: null, ...settings },
  teacher: false,
  row: null,
  openFight: null,
  requestIds: [],
  fights: [],
  events: [],
  refusals: [],
  batches: {},
});

const ok = <T,>(value: T): Outcome<T> => ({ ok: true, value });
const copy = <T,>(x: T): T => structuredClone(x);

export interface MemoryOptions {
  /** The clock. */
  now?: () => number;
  /** Called after every change (the trial saves to localStorage here). */
  onChange?: (db: MemoryDb) => void;
  /** Random numbers for seeds; the default is crypto. */
  seed?: () => number;
}

export function memoryServices(db: MemoryDb, options: MemoryOptions = {}): Services {
  const randomSeed = () => {
    if (options.seed) return options.seed() >>> 0;
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  };
  let counter = 0;
  return {
    now: options.now ?? (() => Date.now()),
    seed: randomSeed,
    newId: () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`),
    isTeacher: async () => ok(db.teacher),
    settings: async () => ok(copy(db.settings)),
    load: async (_player, requestId) =>
      ok({ row: db.row ? copy(db.row) : null, openFight: db.openFight ? copy(db.openFight) : null, seen: !!requestId && db.requestIds.includes(requestId) }),
    commit: async (_player: string, c: Commit) => {
      if (db.requestIds.includes(c.event.requestId)) return ok({ status: 'duplicate' as const, version: db.row?.version ?? 0 });
      if ((db.row?.version ?? 0) !== c.expect) return ok({ status: 'stale' as const, version: db.row?.version ?? 0 });
      if (c.closeFight) {
        const fight = db.fights.find((f) => f.id === c.closeFight!.id && f.status === 'open');
        if (!fight) return ok({ status: 'no-fight' as const, version: db.row?.version ?? 0 });
        fight.status = c.closeFight.status;
        fight.actions = c.closeFight.actions;
        fight.result = c.closeFight.result;
        db.openFight = null;
      }
      if (c.openFight) {
        if (db.fights.some((f) => f.status === 'open')) return ok({ status: 'open-fight' as const, version: db.row?.version ?? 0 });
        db.fights.push({ id: c.openFight.id, status: 'open', actions: [], result: null });
        db.openFight = copy(c.openFight);
      }
      db.row = { hero: copy(c.hero), version: c.expect + 1, season: c.season, extra: copy(c.extra) };
      db.requestIds.push(c.event.requestId);
      db.events.push(copy(c.event));
      options.onChange?.(db);
      return ok({ status: 'saved' as const, version: c.expect + 1 });
    },
    recordAnswers: async (_player, pack, batchKey, answers) => {
      if (db.batches[batchKey]) return ok(0);
      db.batches[batchKey] = { pack, answers: copy(answers) };
      options.onChange?.(db);
      return ok(answers.length);
    },
    recordRefusal: async (_player, reason, action) => {
      db.refusals.push({ reason, action });
      return ok(null);
    },
  };
}

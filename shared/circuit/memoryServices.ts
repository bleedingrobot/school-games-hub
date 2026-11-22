/**
 * A pretend database for the `circuit` server function, kept in memory: the preview page runs the real handler on it (so
 * the preview never calls the live site), and handler.test.ts uses it too. `record` follows `record_circuit_finish` in the
 * migration (20261122001300_circuit.sql): change them together.
 */
import { FINISH_POINTS, FINISHES_A_DAY, GOLD_POINTS, MEDAL_RANK, nzDay, type RoadProgress } from './game';

export interface MemoryOptions {
  enabled?: boolean;
  unlimited?: boolean;
  /** Finishes already used today. */
  today?: number;
  roads?: Record<string, RoadProgress>;
  now?: () => number;
}

/** Shaped like the function's `Services` (supabase/functions/circuit/handler.ts), with what was saved to look at. */
export function memoryServices(opts: MemoryOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const roads: Record<string, Record<string, RoadProgress>> = {};
  const today: Record<string, { day: string; n: number }> = {};
  const seeds = new Set<string>();
  const points: { player: string; points: number; once: string }[] = [];
  const switches = { enabled: opts.enabled ?? true, unlimited: opts.unlimited ?? false };
  let counter = 0;

  const mine = (player: string) => (roads[player] ??= structuredClone(opts.roads ?? {}));
  const todayOf = (player: string) => {
    const day = nzDay(now());
    const t = (today[player] ??= { day, n: opts.today ?? 0 });
    if (t.day !== day) Object.assign(t, { day, n: 0 });
    return t;
  };

  return {
    switches,
    points,
    roads,
    async userIdFor(token: string) {
      return token.startsWith('pupil:') ? token.slice(6) : null;
    },
    async stamp(text: string) {
      return `pretend:${text.length}:${text.split(':').slice(2).join(':')}`;
    },
    now,
    randomHex(bytes: number) {
      counter++;
      return counter.toString(16).padStart(bytes * 2, '0').slice(-bytes * 2);
    },
    async settings(_player: string) {
      return { ...switches };
    },
    async load(player: string) {
      return { roads: structuredClone(mine(player)), today: todayOf(player).n };
    },
    async record(player: string, f: { road: string; before: string | null; seed: string; steps: number; medal: RoadProgress['medal']; clean: boolean; charged: boolean; unlimited: boolean }) {
      const t = todayOf(player);
      const mineRoads = mine(player);
      if (seeds.has(`${player}:${f.seed}`)) return { status: 'duplicate' as const, today: t.n };
      if (f.before && !(mineRoads[f.before]?.finishes > 0)) return { status: 'locked' as const, today: t.n };
      if (t.n >= FINISHES_A_DAY && !f.unlimited) return { status: 'done-today' as const, today: t.n };
      seeds.add(`${player}:${f.seed}`);
      const extra = t.n >= FINISHES_A_DAY;
      t.n++;
      const had = mineRoads[f.road];
      const best = !had || f.steps < had.best;
      const firstGold = f.medal === 'gold' && had?.medal !== 'gold';
      mineRoads[f.road] = {
        best: had ? Math.min(had.best, f.steps) : f.steps,
        medal: had && MEDAL_RANK[had.medal] >= MEDAL_RANK[f.medal] ? had.medal : f.medal,
        clean: (had?.clean ?? false) || f.clean,
        charged: (had?.charged ?? false) || f.charged,
        finishes: (had?.finishes ?? 0) + 1,
      };
      if (!extra) points.push({ player, points: FINISH_POINTS + (firstGold ? GOLD_POINTS : 0), once: f.seed });
      return { status: best ? ('best' as const) : ('saved' as const), today: t.n };
    },
  };
}

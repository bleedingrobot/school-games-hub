/**
 * A pretend database for the `circuit` server function, kept in memory: the preview page runs the real handler on it (so
 * the preview never calls the live site), and handler.test.ts uses it too. `record` follows `record_circuit_finish` in the
 * migrations (20261122001300_circuit.sql, 20261123000200_circuit_worlds.sql); the questions follow `circuit_store_questions` and `circuit_claim_answer`
 * (20261123000100_circuit_maths.sql): change them together. The maths uses a fixed pretend focus and records, never a
 * pupil's real ones.
 */
import { parseFocus } from '../maths/focus';
import type { FactAnswer } from '../maths/leitner';
import { seededRandom, type MathsContext } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import type { MathsSwitch } from '../space/mathsSwitch';
import { FINISH_POINTS, FINISHES_A_DAY, GOLD_POINTS, MEDAL_RANK, nzDay, type RacerId, type RoadProgress } from './game';

/** The pretend pupil's focus: tables, fractions, decimals and percentages, so every kind of sign shows in the preview. */
export const PRETEND_FOCUS = {
  source: 'teacher-class', skills: ['tables-7', 'equivalent-fractions', 'decimal-equivalents', 'percent-of'], onlyThese: true, endsAt: null, canChoose: false, own: null,
};

export interface MemoryOptions {
  enabled?: boolean;
  unlimited?: boolean;
  /** Finishes already used today. */
  today?: number;
  roads?: Record<string, RoadProgress>;
  now?: () => number;
  /** The teacher's maths switch (default 'on', as the migration). */
  maths?: MathsSwitch;
  /** The class's multiple-choice switch (preview `?mc=1`). */
  multipleChoice?: boolean;
  /** The maths records can't be read (the go then has no maths). */
  noContext?: boolean;
}

/** Shaped like the function's `Services` (supabase/functions/circuit/handler.ts), with what was saved to look at. */
export function memoryServices(opts: MemoryOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const roads: Record<string, Record<string, RoadProgress>> = {};
  const today: Record<string, { day: string; n: number }> = {};
  const seeds = new Set<string>();
  const points: { player: string; points: number; once: string }[] = [];
  const switches = { enabled: opts.enabled ?? true, unlimited: opts.unlimited ?? false, maths: opts.maths ?? ('on' as MathsSwitch) };
  let counter = 0;
  const random = seededRandom('pretend-circuit');
  const questions: Record<string, { questions: Question[]; answered: Record<string, { value: number; right: boolean }> }> = {};
  const answers: { player: string; once: string; answers: FactAnswer[] }[] = [];
  const racers: Record<string, RacerId> = {};

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
    questions,
    answers,
    random,
    async mathsContext(_player: string): Promise<MathsContext | null> {
      if (opts.noContext) return null;
      return { facts: [], focus: parseFocus(PRETEND_FOCUS), settings: { multipleChoice: opts.multipleChoice ?? false } };
    },
    async storeQuestions(player: string, seed: string, list: Question[]) {
      questions[`${player}:${seed}`] ??= { questions: structuredClone(list), answered: {} };
      return true;
    },
    async loadQuestions(player: string, seed: string) {
      const go = questions[`${player}:${seed}`];
      return go ? structuredClone(go) : null;
    },
    async claimAnswer(player: string, seed: string, slot: number, value: number, right: boolean) {
      const go = questions[`${player}:${seed}`];
      if (!go || String(slot) in go.answered) return false;
      go.answered[String(slot)] = { value, right };
      return true;
    },
    async recordAnswers(player: string, once: string, list: FactAnswer[]) {
      if (!answers.some((a) => a.player === player && a.once === once)) answers.push({ player, once, answers: list });
    },
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
    racers,
    async load(player: string) {
      return { roads: structuredClone(mine(player)), today: todayOf(player).n, ...(racers[player] ? { racer: racers[player] } : {}) };
    },
    async setRacer(player: string, racer: RacerId) {
      racers[player] = racer;
      return true;
    },
    async record(player: string, f: { road: string; needs: { roads: string[]; count: number } | null; seed: string; steps: number; medal: RoadProgress['medal']; clean: boolean; charged: boolean; unlimited: boolean; hard: boolean }) {
      const t = todayOf(player);
      const mineRoads = mine(player);
      if (seeds.has(`${player}:${f.seed}`)) return { status: 'duplicate' as const, today: t.n };
      if (f.needs && f.needs.roads.filter((r) => mineRoads[r]?.finishes > 0).length < f.needs.count) return { status: 'locked' as const, today: t.n };
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
        // Hard mode only counts on a road finished before (as the migration).
        hardFinishes: (had?.hardFinishes ?? 0) + (f.hard && had ? 1 : 0),
        hardBest: f.hard && had ? Math.min(had.hardBest ?? f.steps, f.steps) : (had?.hardBest ?? null),
      };
      if (!extra) points.push({ player, points: FINISH_POINTS + (firstGold ? GOLD_POINTS : 0), once: f.seed });
      return { status: best ? ('best' as const) : ('saved' as const), today: t.n };
    },
  };
}

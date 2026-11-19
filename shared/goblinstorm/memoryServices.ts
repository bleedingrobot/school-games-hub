/**
 * The Goblin Storm server's services kept in memory, for the tests: the same rules as the database functions in
 * supabase/migrations/20261119000900_goblinstorm.sql (a seed used once, a slot marked once, a run finished once).
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import { freshSave, type Answered, type Finished, type GoblinStormServices, type KeptRun, type RunToKeep, type Save } from './server';

export interface MemoryWorld {
  enabled: boolean;
  unlimited: boolean;
  context: MathsContext;
  saves: Map<string, Save>;
  runs: Map<string, KeptRun & { day: string; extra: boolean; finished?: Finished }>;
  recorded: { player: string; once: string; answers: FactAnswer[] }[];
  clock: number;
}

export function memoryServices(options: Partial<Pick<MemoryWorld, 'enabled' | 'unlimited' | 'context' | 'clock'>> & { random?: () => number } = {}) {
  const world: MemoryWorld = {
    enabled: options.enabled ?? true,
    unlimited: options.unlimited ?? false,
    context: options.context ?? { facts: [], settings: {} },
    saves: new Map(),
    runs: new Map(),
    recorded: [],
    clock: options.clock ?? Date.UTC(2026, 10, 19, 0, 0, 0),
  };
  let n = 1;
  const key = (player: string, seed: number) => `${player}:${seed}`;
  const services: GoblinStormServices = {
    enabled: async () => world.enabled,
    unlimited: async () => world.unlimited,
    mathsContext: async () => world.context,
    load: async (player) => structuredClone(world.saves.get(player) ?? freshSave()),
    runsOn: async (player, day) => [...world.runs.entries()].filter(([k, r]) => k.startsWith(`${player}:`) && r.day === day).length,
    async start(player, run: RunToKeep) {
      if (world.runs.has(key(player, run.seed))) return false;
      world.runs.set(key(player, run.seed), { ...run, answers: {}, startedAt: world.clock, open: true });
      return true;
    },
    run: async (player, seed) => {
      const r = world.runs.get(key(player, seed));
      return r ? structuredClone(r) : null;
    },
    async claim(player, seed, slot, answered: Answered) {
      const r = world.runs.get(key(player, seed));
      if (!r || !r.open || r.answers[String(slot)]) return false;
      r.answers[String(slot)] = answered;
      return true;
    },
    async finish(player, seed, finished) {
      const r = world.runs.get(key(player, seed));
      if (!r || !r.open) return false;
      r.open = false;
      r.finished = finished;
      r.summary = finished.summary;
      const save = world.saves.get(player) ?? freshSave();
      save.gold += finished.summary.gold;
      if (finished.summary.bossBeaten && !save.bosses.includes(r.map)) save.bosses.push(r.map);
      world.saves.set(player, save);
      return true;
    },
    async recordAnswers(player, once, answers) {
      world.recorded.push({ player, once, answers });
    },
    random: options.random ?? (() => (n++ * 0.6180339887) % 1),
    now: () => world.clock,
  };
  return { services, world };
}

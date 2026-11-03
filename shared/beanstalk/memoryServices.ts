/**
 * Kiwi's Beanstalk's database jobs kept in memory, doing what the migration's functions do (progress saved only if its
 * version still matches, a seed used once per pupil, a challenge finished once). The preview's trial backend saves this
 * in the browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer } from '../maths/leitner';
import type { Tap } from './round';
import { unplayed, type BeanstalkServices, type Saved, type Settings } from './server';

export interface MemoryRound {
  player: string;
  seed: number;
  open: boolean;
  taps?: Tap[];
  mistakes?: number;
}

export interface MemoryData {
  players: Record<string, Saved>;
  rounds: MemoryRound[];
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the trial backend saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; eggs?: string[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const emptyData = (): MemoryData => ({ players: {}, rounds: [] });

export function memoryServices(options: MemoryOptions = {}): BeanstalkServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: number) => data.rounds.find((r) => r.player === player && r.seed === seed);
  const recorded = new Set<string>();

  return {
    data,
    now: options.now ?? (() => Date.now()),
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true, dots: true }),
    async load(player) {
      return copy(data.players[player] ?? unplayed());
    },
    async choose(player, child) {
      const s = data.players[player] ?? unplayed();
      data.players[player] = { ...s, child, version: s.version + 1 };
      saved();
      return true;
    },
    async start(player, seed) {
      if (find(player, seed)) return false;
      for (const r of data.rounds) if (r.player === player) r.open = false;
      data.rounds.push({ player, seed, open: true });
      saved();
      return true;
    },
    async round(player, seed) {
      const r = find(player, seed);
      return r ? { open: r.open } : null;
    },
    async finish(player, seed, version, progress, ending) {
      const r = find(player, seed);
      if (!r || !r.open || version < 1 || data.players[player]?.version !== version) return false;
      Object.assign(r, { open: false, taps: copy(ending.taps), mistakes: ending.mistakes });
      data.players[player] = { ...copy(progress), version: version + 1 };
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      if (recorded.has(once)) return;
      recorded.add(once);
      options.log?.answers.push({ player, once, answers });
    },
    async progressChanged(player) {
      options.log?.eggs?.push(player);
    },
  };
}

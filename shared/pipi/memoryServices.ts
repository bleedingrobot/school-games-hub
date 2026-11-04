/**
 * Pipi's Hidden Shells' database jobs kept in memory, doing what the migration's functions do (progress saved only if
 * its version still matches, a seed used once per pupil, a challenge finished once), plus the pupil's maths records,
 * changed by recorded answers the way record_fact_answers changes them. The preview's trial backend saves this in the
 * browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import type { Tap } from './play';
import type { Round } from './round';
import { unplayed, withAnswers, type PipiServices, type Saved, type Settings } from './server';

export interface MemoryRound {
  player: string;
  round: Round;
  open: boolean;
  taps?: Tap[];
  mistakes?: number;
}

export interface MemoryData {
  players: Record<string, Saved>;
  rounds: MemoryRound[];
  facts: Record<string, FactStats[]>;
  /** The `once` of every batch of answers recorded, so one sent twice counts once. */
  recorded: string[];
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the trial backend saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; pearls?: string[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const emptyData = (): MemoryData => ({ players: {}, rounds: [], facts: {}, recorded: [] });

export function memoryServices(options: MemoryOptions = {}): PipiServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: number) => data.rounds.find((r) => r.player === player && r.round.seed === seed);

  return {
    data,
    now: options.now ?? (() => Date.now()),
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true, help: true }),
    async load(player) {
      return copy(data.players[player] ?? unplayed());
    },
    async facts(player) {
      return copy(data.facts[player] ?? []);
    },
    async start(player, round) {
      if (find(player, round.seed)) return false;
      for (const r of data.rounds) if (r.player === player) r.open = false;
      data.rounds.push({ player, round: copy(round), open: true });
      // The pupil's beach is made on their first go.
      if (!data.players[player]) data.players[player] = { ...unplayed(), version: 1 };
      saved();
      return true;
    },
    async round(player, seed) {
      const r = find(player, seed);
      return r ? { open: r.open, round: copy(r.round) } : null;
    },
    async finish(player, seed, version, progress, ending) {
      const r = find(player, seed);
      const s = data.players[player];
      if (!r || !r.open || !s || s.version !== version) return false;
      if (progress.daysDone < s.daysDone || progress.daysDone > s.daysDone + 1) return false;
      Object.assign(r, { open: false, taps: copy(ending.taps), mistakes: ending.mistakes });
      data.players[player] = { ...copy(progress), version: version + 1 };
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      if (data.recorded.includes(once)) return;
      data.recorded.push(once);
      data.facts[player] = withAnswers(data.facts[player] ?? [], answers);
      options.log?.answers.push({ player, once, answers });
      saved();
    },
    async progressChanged(player) {
      options.log?.pearls?.push(player);
    },
  };
}

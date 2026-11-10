/**
 * Kiwi's Beanstalk's database jobs kept in memory, doing what the migration's functions do (progress saved only if its
 * version still matches, a seed used once per pupil, a challenge finished once). The preview's trial backend saves this
 * in the browser; the server function's tests use it in place of the database.
 */
import { juniorAfterAnswer } from '../juniorQuick';
import { newStats, type FactAnswer, type FactStats } from '../maths/leitner';
import type { Round, Tap } from './round';
import { mergeSeen } from '../kit/seen';
import { unplayed, type BeanstalkServices, type Saved, type Settings } from './server';

export interface MemoryRound {
  player: string;
  seed: number;
  open: boolean;
  /** The round as it was made at the start (missing on a challenge started before rounds were kept). */
  round?: Round;
  taps?: Tap[];
  mistakes?: number;
}

export interface MemoryData {
  players: Record<string, Saved>;
  rounds: MemoryRound[];
  /** Each pupil's maths records, built from the answers recorded (the preview has no maths records of its own). */
  facts?: Record<string, FactStats[]>;
  /** The kinds of go each pupil has seen (demos). */
  seen?: Record<string, string[]>;
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  /** The pupil's maths records, instead of the ones built from recorded answers (for tests). */
  facts?: (player: string) => FactStats[];
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
    async seen(player) {
      return [...(data.seen?.[player] ?? [])];
    },
    async markSeen(player, kinds) {
      const next = mergeSeen(data.seen?.[player] ?? [], kinds);
      (data.seen ??= {})[player] = next;
      saved();
      return next;
    },
    now: options.now ?? (() => Date.now()),
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true, dots: true }),
    async load(player) {
      // `{ ...unplayed() }` first: a trial pupil saved before the dots followed the child has no help yet.
      return { ...unplayed(), ...copy(data.players[player] ?? unplayed()) };
    },
    async choose(player, child) {
      const s = data.players[player] ?? unplayed();
      data.players[player] = { ...s, child, version: s.version + 1 };
      saved();
      return true;
    },
    async facts(player) {
      return copy(options.facts?.(player) ?? data.facts?.[player] ?? []);
    },
    async start(player, round) {
      if (find(player, round.seed)) return false;
      for (const r of data.rounds) if (r.player === player) r.open = false;
      data.rounds.push({ player, seed: round.seed, open: true, round: copy(round) });
      saved();
      return true;
    },
    async round(player, seed) {
      const r = find(player, seed);
      return r ? { open: r.open, round: r.round ? copy(r.round) : null } : null;
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
      const mine = new Map((data.facts?.[player] ?? []).map((f) => [f.key, f]));
      for (const a of answers) mine.set(a.key, juniorAfterAnswer(mine.get(a.key) ?? newStats(a.key), a.correct, a.ms, a.at));
      data.facts = { ...data.facts, [player]: [...mine.values()] };
      saved();
      options.log?.answers.push({ player, once, answers });
    },
    async progressChanged(player) {
      options.log?.eggs?.push(player);
    },
  };
}

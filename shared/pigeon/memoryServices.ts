/**
 * Pigeon’s Number Line’s database jobs kept in memory, doing what the migration's functions do (progress saved only if
 * its version still matches, a seed used once per pupil, a challenge finished once), plus the pupil's maths records,
 * changed by recorded answers the way record_fact_answers changes them. The preview's trial backend saves this in the
 * browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import type { Tap } from './play';
import type { Round } from './round';
import { newStats } from '../maths/leitner';
import { juniorAfterAnswer } from '../juniorQuick';
import { mergeSeen } from '../kit/seen';
import { unplayed, type PigeonServices, type Saved, type Settings } from './server';

export interface MemoryRound {
  player: string;
  round: Round;
  open: boolean;
  taps?: Tap[];
  mistakes?: number;
  firstRight?: number;
}

export interface MemoryData {
  players: Record<string, Saved>;
  rounds: MemoryRound[];
  facts: Record<string, FactStats[]>;
  /** The `once` of every batch of answers recorded, so one sent twice counts once. */
  recorded: string[];
  /** The kinds of go each pupil has seen (kept here so the preview remembers them). */
  seen?: Record<string, string[]>;
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the trial backend saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; branches?: string[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const emptyData = (): MemoryData => ({ players: {}, rounds: [], facts: {}, recorded: [] });

export function memoryServices(options: MemoryOptions = {}): PigeonServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: number) => data.rounds.find((r) => r.player === player && r.round.seed === seed);

  return {
    data,
    now: options.now ?? (() => Date.now()),
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true, help: 'fade' }),
    async load(player) {
      // A save from before the help of each kind of go has no map.
      return { ...unplayed(), ...copy(data.players[player] ?? {}) };
    },
    async facts(player) {
      return copy(data.facts[player] ?? []);
    },
    async start(player, round) {
      if (find(player, round.seed)) return false;
      for (const r of data.rounds) if (r.player === player) r.open = false;
      data.rounds.push({ player, round: copy(round), open: true });
      // The pupil’s branch is made on their first go, at the round’s step and help level.
      if (!data.players[player]) data.players[player] = { ...unplayed(), step: round.step, level: round.level, version: 1 };
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
      Object.assign(r, { open: false, taps: copy(ending.taps), mistakes: ending.mistakes, firstRight: ending.firstRight });
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
    async seen(player) {
      return [...(data.seen?.[player] ?? [])];
    },
    async markSeen(player, kinds) {
      const next = mergeSeen(data.seen?.[player] ?? [], kinds);
      data.seen = { ...data.seen, [player]: next };
      saved();
      return [...next];
    },
    async progressChanged(player) {
      options.log?.branches?.push(player);
    },
  };
}

/** The records after these answers, the way record_fact_answers will change them (the early facts' quick time). */
export function withAnswers(facts: readonly FactStats[], answers: readonly FactAnswer[]): FactStats[] {
  const byKey = new Map(facts.map((s) => [s.key, s]));
  for (const a of answers) byKey.set(a.key, juniorAfterAnswer(byKey.get(a.key) ?? newStats(a.key), a.correct, a.ms, a.at));
  return [...byKey.values()];
}

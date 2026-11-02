/**
 * Diamond Drop's database jobs kept in memory, doing what the migration's functions do (progress saved only if its
 * version still matches, a seed used once per pupil, a question slot marked once, a level ended once). The preview's
 * trial backend saves this in the browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { LevelResult } from './engine';
import type { Player } from './progress';
import { unplayed, type DiamondServices, type OpenLevel, type Saved } from './server';

export interface MemoryLevel extends OpenLevel {
  player: string;
  drops?: number[];
  finish?: number | null;
  result?: LevelResult;
}

export interface MemoryData {
  players: Record<string, Saved>;
  levels: MemoryLevel[];
  /** Pupils who caught the Heart Diamond, and when (the Hall). */
  finds: { player: string; at: number }[];
}

export interface MemoryOptions {
  data?: MemoryData;
  enabled?: () => boolean;
  /** The pupil's maths (null: it can't be read). */
  maths?: (player: string) => MathsContext | null;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the trial backend saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded or awarded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; points: { player: string; points: number; once: string }[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const emptyData = (): MemoryData => ({ players: {}, levels: [], finds: [] });

export function memoryServices(options: MemoryOptions = {}): DiamondServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const now = options.now ?? (() => Date.now());
  const saved = () => options.changed?.(data);
  const givenPoints = new Set<string>();
  const find = (player: string, seed: number) => data.levels.find((l) => l.player === player && l.seed === seed);
  const versionIs = (player: string, version: number) => (data.players[player]?.version ?? 0) === version;
  const keep = (player: string, version: number, state: Player) => {
    data.players[player] = { player: copy(state), version: version + 1 };
  };

  return {
    data,
    now,
    random: options.random ?? Math.random,
    enabled: async () => options.enabled?.() ?? true,
    mathsContext: async (player) => options.maths?.(player) ?? null,
    async load(player) {
      return copy(data.players[player] ?? unplayed());
    },
    async start(player, version, state, level) {
      if (!versionIs(player, version) || find(player, level.seed)) return false;
      for (const l of data.levels) if (l.player === player) l.open = false;
      keep(player, version, state);
      data.levels.push({ ...copy(level), player, marks: level.questions.map(() => null), open: true });
      saved();
      return true;
    },
    async level(player, seed) {
      const l = find(player, seed);
      return l ? copy({ seed: l.seed, level: l.level, boosts: l.boosts, starter: l.starter, questions: l.questions, marks: l.marks, open: l.open }) : null;
    },
    async answer(player, seed, slot, right) {
      const l = find(player, seed);
      if (!l || !l.open || slot < 0 || slot >= l.questions.length || l.marks[slot] !== null) return false;
      l.marks[slot] = right;
      saved();
      return true;
    },
    async end(player, seed, version, state, ending) {
      const l = find(player, seed);
      if (!l || !l.open || !versionIs(player, version)) return false;
      Object.assign(l, { open: false, drops: [...ending.drops], finish: ending.finish, result: copy(ending.result) });
      keep(player, version, state);
      if (ending.result.diamond && !data.finds.some((f) => f.player === player)) data.finds.push({ player, at: now() });
      saved();
      return true;
    },
    async save(player, version, state) {
      if (!versionIs(player, version)) return false;
      keep(player, version, state);
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      options.log?.answers.push({ player, once, answers });
    },
    async awardPoints(player, points, once) {
      if (givenPoints.has(once)) return;
      givenPoints.add(once);
      options.log?.points.push({ player, points, once });
    },
    async progressChanged() {},
  };
}

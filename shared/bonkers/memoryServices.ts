/**
 * Bonkers Quest's database jobs kept in memory, doing what the migration's functions do (progress saved only if its
 * version still matches, one open adventure, a seed used once, each mark added once and in order, an adventure finished
 * once). The preview's trial backend keeps this in the browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import { unplayed, type BonkersServices, type FinishedAdventure, type KeptAdventure, type Saved, type Settings } from './server';

export interface MemoryAdventure {
  player: string;
  kept: KeptAdventure;
  finished?: FinishedAdventure;
}

export interface MemoryData {
  players: Record<string, Saved>;
  adventures: MemoryAdventure[];
  facts: Record<string, FactStats[]>;
  /** The `once` of every batch of answers or points, so one sent twice counts once. */
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
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; points: { player: string; points: number; once: string }[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const emptyData = (): MemoryData => ({ players: {}, adventures: [], facts: {}, recorded: [] });

export function memoryServices(options: MemoryOptions = {}): BonkersServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const now = options.now ?? (() => Date.now());
  const saved = () => options.changed?.(data);
  const open = (player: string) => data.adventures.find((a) => a.player === player && a.kept.open);

  return {
    data,
    now,
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true }),
    load: async (player) => copy(data.players[player] ?? unplayed()),
    maths: async (player): Promise<MathsContext> => ({ facts: copy(data.facts[player] ?? []), settings: {} }),
    current: async (player) => {
      const a = open(player);
      return a ? copy(a.kept) : null;
    },
    async saveHero(player, version, progress) {
      const had = data.players[player] ?? unplayed();
      if (had.version !== version) return false;
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async start(player, version, progress, kept) {
      const had = data.players[player] ?? unplayed();
      if (had.version !== version || open(player) || data.adventures.some((a) => a.player === player && a.kept.seed === kept.seed)) return false;
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      data.adventures.push({ player, kept: { ...copy(kept), marks: [], open: true } });
      saved();
      return true;
    },
    async mark(player, seed, slot, mark) {
      const a = open(player);
      if (!a || a.kept.seed !== seed || a.kept.marks.length !== slot) return false;
      a.kept.marks.push({ ...mark });
      saved();
      return true;
    },
    async finish(player, seed, version, progress, result) {
      const a = open(player);
      const had = data.players[player] ?? unplayed();
      if (!a || a.kept.seed !== seed || had.version !== version) return false;
      a.kept.open = false;
      a.finished = copy(result);
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      if (data.recorded.includes(once)) return;
      data.recorded.push(once);
      options.log?.answers.push({ player, once, answers: copy(answers) });
      saved();
    },
    async awardPoints(player, points, once) {
      if (data.recorded.includes(once)) return;
      data.recorded.push(once);
      options.log?.points.push({ player, points, once });
      saved();
    },
    progressChanged: async () => undefined,
  };
}

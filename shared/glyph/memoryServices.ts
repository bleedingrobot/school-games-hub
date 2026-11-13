/**
 * Glyph Gates' database jobs kept in memory, doing what the migration's functions do (progress saved only if its version
 * still matches, a seed used once per pupil, a go finished once). The preview keeps this in the browser; the server
 * function's tests use it in place of the database.
 */
import type { FactAnswer } from '../maths/leitner';
import { nzDate } from '../kit/dayArc';
import { WALLS_PER_TEMPLE } from './config';
import type { TempleResult } from './play';
import { unplayed, type GlyphServices, type KeptGo, type Saved, type Settings } from './server';

export interface MemoryGo extends KeptGo {
  player: string;
  seed: string;
  startedAt: number;
  finishedDay?: string;
  result?: TempleResult;
}

export interface MemoryData {
  players: Record<string, Saved>;
  goes: MemoryGo[];
  /** The `once` of every batch of answers or points, so one sent twice counts once. */
  recorded: string[];
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  now?: () => number;
  /** Called after every change (the preview saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; points: { player: string; points: number; once: string }[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const emptyData = (): MemoryData => ({ players: {}, goes: [], recorded: [] });

export function memoryServices(options: MemoryOptions = {}): GlyphServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const now = options.now ?? (() => Date.now());
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: string) => data.goes.find((g) => g.player === player && g.seed === seed);

  return {
    data,
    now,
    settings: async () => (options.settings ? options.settings() : { enabled: true }),
    load: async (player) => copy(data.players[player] ?? unplayed()),
    async start(player, seed, temple, help) {
      if (find(player, seed)) return false;
      for (const g of data.goes) if (g.player === player) g.open = false;
      data.goes.push({ player, seed, temple, help, open: true, startedAt: now() });
      saved();
      return true;
    },
    go: async (player, seed) => {
      const g = find(player, seed);
      return g ? { temple: g.temple, open: g.open, help: g.help } : null;
    },
    finishedToday: async (player, day) => data.goes.filter((g) => g.player === player && g.finishedDay === day && g.result?.walls.length === WALLS_PER_TEMPLE).length,
    async finish(player, seed, version, progress, result) {
      const g = find(player, seed);
      const had = data.players[player] ?? unplayed();
      if (!g || !g.open || had.version !== version) return false;
      g.open = false;
      g.result = copy(result);
      g.finishedDay = nzDate(new Date(now()));
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async saveProgress(player, version, progress) {
      const had = data.players[player] ?? unplayed();
      if (had.version !== version) return false;
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      if (data.recorded.includes(`a:${once}`)) return;
      data.recorded.push(`a:${once}`);
      options.log?.answers.push({ player, once, answers: copy(answers) });
      saved();
    },
    async awardPoints(player, points, once) {
      if (data.recorded.includes(`p:${once}`)) return;
      data.recorded.push(`p:${once}`);
      options.log?.points.push({ player, points, once });
      saved();
    },
    progressChanged: async () => undefined,
  };
}

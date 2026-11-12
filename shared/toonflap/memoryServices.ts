/**
 * Toon Flap's database jobs kept in memory, doing what the migration's functions do (progress saved only if its version
 * still matches, a seed used once per pupil, a check marked once, a run finished once). The preview's trial backend keeps
 * this in the browser; the server function's tests use it in place of the database.
 */
import type { FactAnswer, FactStats } from '../maths/leitner';
import { nzDate } from '../kit/dayArc';
import { DASH_BOARD_SIZE } from './config';
import { unplayed, type BoardRow, type FinishedDash, type FinishedRun, type KeptRun, type MathsContext, type Saved, type Settings, type ToonFlapServices } from './server';

export interface MemoryRun {
  player: string;
  seed: string;
  run: KeptRun;
  day: string;
  finished?: FinishedRun | FinishedDash;
  finishedDay?: string;
}

export interface MemoryData {
  players: Record<string, Saved>;
  runs: MemoryRun[];
  facts: Record<string, FactStats[]>;
  /** The `once` of every batch of answers or points, so one sent twice counts once. */
  recorded: string[];
  /** Sky Dash season bests (everyone here is one class; the preview adds made-up classmates). */
  dashBests?: Record<string, number>;
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
export const emptyData = (): MemoryData => ({ players: {}, runs: [], facts: {}, recorded: [] });

export function memoryServices(options: MemoryOptions = {}): ToonFlapServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const now = options.now ?? (() => Date.now());
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: string) => data.runs.find((r) => r.player === player && r.seed === seed);

  return {
    data,
    now,
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true, maths: true, readTime: true }),
    load: async (player) => copy(data.players[player] ?? unplayed()),
    maths: async (player): Promise<MathsContext> => ({ facts: copy(data.facts[player] ?? []), focus: null, settings: {} }),
    async runsToday(player, day) {
      const mine = data.runs.filter((r) => r.player === player);
      return { started: mine.filter((r) => r.day === day).length, finished: mine.filter((r) => r.finishedDay === day).length };
    },
    async start(player, seed, run) {
      if (find(player, seed)) return false;
      for (const r of data.runs) if (r.player === player) r.run.open = false;
      data.runs.push({ player, seed, day: nzDate(new Date(now())), run: { ...copy(run), marks: {}, open: true, startedAt: now() } });
      saved();
      return true;
    },
    run: async (player, seed) => {
      const r = find(player, seed);
      return r ? copy(r.run) : null;
    },
    async claim(player, seed, slot, right) {
      const r = find(player, seed);
      if (!r || !r.run.open || String(slot) in r.run.marks) return false;
      r.run.marks[String(slot)] = right;
      saved();
      return true;
    },
    async finish(player, seed, version, progress, result) {
      const r = find(player, seed);
      const had = data.players[player] ?? unplayed();
      if (!r || !r.run.open || had.version !== version) return false;
      r.run.open = false;
      r.finished = copy(result);
      r.finishedDay = nzDate(new Date(now()));
      data.players[player] = { ...had, progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async dashFinish(player, seed, version, progress, result) {
      const r = find(player, seed);
      const had = data.players[player] ?? unplayed();
      if (!r || !r.run.open || had.version !== version) return false;
      r.run.open = false;
      r.finished = copy(result);
      r.finishedDay = nzDate(new Date(now()));
      data.players[player] = { ...had, progress: copy(progress), version: had.version + 1 };
      data.dashBests ??= {};
      const before = data.dashBests[player] ?? 0;
      data.dashBests[player] = Math.max(before, result.walls);
      saved();
      return { before };
    },
    async board(player) {
      const all = Object.entries(data.dashBests ?? {}).sort((a, b) => b[1] - a[1]);
      const rows: BoardRow[] = [];
      let place = 0;
      all.forEach(([who, walls], i) => {
        if (i === 0 || walls < all[i - 1][1]) place = i + 1;
        rows.push({ place, name: who === player ? 'You' : who, walls, me: who === player });
      });
      return { rows: rows.slice(0, DASH_BOARD_SIZE), mine: rows.find((x) => x.me) ?? null };
    },
    async savePicks(player, picks) {
      const had = data.players[player] ?? unplayed();
      data.players[player] = { ...had, picks: { ...picks } };
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

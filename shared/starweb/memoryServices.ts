/**
 * Star Web solo's database jobs kept in memory, doing what the migration's functions do (progress and skies saved only if
 * their version still matches, a seed used once per pupil, one open sky, a sky finished once). The preview keeps this in
 * the browser; the server function's tests use it in place of the database.
 */
import type { Anchor } from '../classlive/stars';
import type { FactStats } from '../maths/leitner';
import { nzDate } from '../kit/dayArc';
import type { Medal } from './config';
import type { Progress } from './map';
import { unplayed, type KeptSky, type Mode, type Saved, type Settings, type StarWebServices } from './server';
import type { SoloStar } from './sky';

export interface MemorySky extends KeptSky {
  player: string;
  medal?: Medal;
  points?: number;
  finishedDay?: string;
}

export interface MemoryData {
  players: Record<string, Saved>;
  skies: MemorySky[];
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => Settings | null;
  facts?: () => FactStats[];
  enabledTables?: () => number[] | undefined;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the preview saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded, for tests. */
  log?: { points: { player: string; points: number; once: string }[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const emptyData = (): MemoryData => ({ players: {}, skies: [] });

export function memoryServices(options: MemoryOptions = {}): StarWebServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? emptyData();
  const now = options.now ?? (() => Date.now());
  const saved = () => options.changed?.(data);
  const find = (player: string, seed: string) => data.skies.find((s) => s.player === player && s.seed === seed);
  const kept = (s: MemorySky | undefined): KeptSky | null =>
    s ? copy({ seed: s.seed, mode: s.mode, anchor: s.anchor, stars: s.stars, hints: s.hints, version: s.version, open: s.open, savedAt: s.savedAt }) : null;
  const points = new Set<string>();

  return {
    data,
    now,
    random: options.random ?? Math.random,
    settings: async () => (options.settings ? options.settings() : { enabled: true }),
    load: async (player) => copy(data.players[player] ?? unplayed()),
    openSky: async (player) => kept(data.skies.find((s) => s.player === player && s.open)),
    sky: async (player, seed) => kept(find(player, seed)),
    maths: async () => ({ facts: options.facts?.() ?? [], enabledTables: options.enabledTables?.() }),
    async start(player, seed, mode: Mode, anchor: Anchor) {
      if (find(player, seed)) return false;
      for (const s of data.skies) if (s.player === player) s.open = false;
      data.skies.push({ player, seed, mode, anchor: copy(anchor), stars: [], hints: 0, version: 1, open: true, savedAt: now() });
      // Like the database, only the last 200 skies a pupil played are kept.
      const mine = data.skies.filter((s) => s.player === player);
      if (mine.length > 200) data.skies.splice(data.skies.indexOf(mine[0]), 1);
      saved();
      return true;
    },
    async save(player, seed, version, stars: SoloStar[], hints) {
      const s = find(player, seed);
      if (!s || !s.open || s.version !== version) return false;
      s.stars = copy(stars);
      s.hints = hints;
      s.version++;
      s.savedAt = now();
      saved();
      return true;
    },
    async finish(player, seed, skyVersion, stars, hints, medal, pts, version, progress: Progress) {
      const s = find(player, seed);
      const had = data.players[player] ?? unplayed();
      if (!s || !s.open || s.version !== skyVersion || had.version !== version) return false;
      Object.assign(s, { open: false, stars: copy(stars), hints, medal, points: pts, finishedDay: nzDate(new Date(now())), version: s.version + 1 });
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    pointSkiesToday: async (player, day) => data.skies.filter((s) => s.player === player && s.finishedDay === day && (s.points ?? 0) > 0).length,
    async saveProgress(player, version, progress) {
      const had = data.players[player] ?? unplayed();
      if (had.version !== version) return false;
      data.players[player] = { progress: copy(progress), version: had.version + 1 };
      saved();
      return true;
    },
    async awardPoints(player, pts, once) {
      if (points.has(once)) return;
      points.add(once);
      options.log?.points.push({ player, points: pts, once });
    },
    progressChanged: async () => {},
  };
}

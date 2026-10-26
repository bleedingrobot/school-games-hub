/**
 * Kingdom Keeper's database jobs kept in memory, doing what the migration's functions do (one open reign a pupil, a
 * council slot marked once, a year turned once). The preview's trial backend saves this in the browser; the server
 * function's tests use it in place of the database.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { City, RatingId } from './engine';
import type { Council, KingdomRecord, Look, StoredReign } from './reign';
import type { KingdomServices } from './server';

export interface MemoryReign extends StoredReign {
  player: string;
  status: 'playing' | 'done' | 'ended' | 'left';
  turned: number;
  councilRight: number;
  rating: RatingId | null;
  points: number;
  finishedAt: number | null;
}

export interface MemoryData {
  nextId: number;
  reigns: MemoryReign[];
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

const DAY_MS = 24 * 60 * 60 * 1000;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function memoryServices(options: MemoryOptions = {}): KingdomServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? { nextId: 1, reigns: [] };
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const saved = () => options.changed?.(data);
  const open = (player: string) => data.reigns.find((r) => r.player === player && r.status === 'playing');
  const givenPoints = new Set<string>();

  return {
    data,
    now,
    random,
    randomHex: (bytes) => Array.from({ length: bytes }, () => Math.floor(random() * 256).toString(16).padStart(2, '0')).join(''),
    enabled: async () => options.enabled?.() ?? true,
    mathsContext: async (player) => options.maths?.(player) ?? null,
    async load(player) {
      const mine = data.reigns.filter((r) => r.player === player);
      const o = open(player);
      const record: KingdomRecord = {
        reigns: mine.filter((r) => r.status === 'done').length,
        legendary: mine.filter((r) => r.rating === 'legendary').length,
        best: Math.max(0, ...mine.filter((r) => r.status === 'done').map((r) => r.city.people)),
      };
      const finishedToday = mine.filter((r) => (r.status === 'done' || r.status === 'ended') && r.finishedAt !== null && r.finishedAt > now() - DAY_MS).length;
      return { reign: o ? copy({ id: o.id, seed: o.seed, look: o.look, city: o.city, council: o.council }) : null, record, finishedToday };
    },
    async start(player, seed, look: Look, city: City, council: Council | null) {
      const o = open(player);
      if (o) Object.assign(o, { status: 'left', finishedAt: now() });
      const id = data.nextId++;
      data.reigns.push({ id, player, seed, look, city: copy(city), council: copy(council), status: 'playing', turned: 0, councilRight: 0, rating: null, points: 0, finishedAt: null });
      saved();
      return id;
    },
    async answer(player, reign, year, slot, value, right) {
      const r = open(player);
      const c = r?.council;
      if (!r || r.id !== reign || r.city.year !== year || !c || c.year !== year || slot < 0 || slot >= c.questions.length || c.answered[String(slot)]) return false;
      c.answered[String(slot)] = { value, right };
      if (right) r.councilRight += 1;
      saved();
      return true;
    },
    async turn(player, reign, fromYear, turned, city, council, end) {
      const r = open(player);
      if (!r || r.id !== reign || r.city.year !== fromYear || r.turned !== turned) return false;
      Object.assign(r, { city: copy(city), council: copy(council), turned: r.turned + 1, status: city.status });
      if (end) Object.assign(r, { rating: end.rating, points: end.points, finishedAt: now() });
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

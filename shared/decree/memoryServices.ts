/**
 * Royal Decree's database jobs kept in memory, doing what the migration's functions do (one open reign a pupil, a
 * riddle marked once, a save kept once). The preview's trial backend saves this in the browser; the server tests use
 * it in place of the database.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import type { Move, Reign } from './engine';
import type { Album, DecreeServices, Look, MarkedAnswer, StoredReign } from './server';

export interface MemoryReign extends StoredReign {
  player: string;
  status: 'playing' | 'over' | 'full' | 'left';
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
  maths?: (player: string) => MathsContext | null;
  now?: () => number;
  random?: () => number;
  changed?: (data: MemoryData) => void;
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; points: { player: string; points: number; once: string }[] };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function albumOf(reigns: readonly { status: string; reign: Reign }[]): Album {
  const done = reigns.filter((r) => r.status === 'over' || r.status === 'full');
  return {
    reigns: done.length,
    full: done.filter((r) => r.status === 'full').length,
    best: Math.max(0, ...done.map((r) => r.reign.turn)),
    endings: [...new Set(done.map((r) => r.reign.ending).filter((e) => e !== undefined))],
    met: [...new Set(reigns.flatMap((r) => r.reign.met))],
  };
}

export function memoryServices(options: MemoryOptions = {}): DecreeServices & { data: MemoryData } {
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
      const finishedToday = mine.filter((r) => r.finishedAt !== null && r.status !== 'left' && r.finishedAt > now() - DAY_MS).length;
      return {
        reign: o ? copy({ id: o.id, look: o.look, reign: o.reign, moves: o.moves, questions: o.questions, answered: o.answered }) : null,
        album: albumOf(mine),
        finishedToday,
      };
    },
    async start(player, look: Look, reign: Reign, questions: Question[]) {
      const o = open(player);
      if (o) Object.assign(o, { status: 'left', finishedAt: now() });
      const id = data.nextId++;
      data.reigns.push({ id, player, look, reign: copy(reign), moves: [], questions: copy(questions), answered: {}, status: 'playing', points: 0, finishedAt: null });
      saved();
      return id;
    },
    async answer(player, id, slot, value, right) {
      const r = open(player);
      if (!r || r.id !== id || slot < 0 || slot >= r.questions.length || r.answered[String(slot)]) return false;
      r.answered[String(slot)] = { value, right } satisfies MarkedAnswer;
      saved();
      return true;
    },
    async save(player, id, fromTurn, reign: Reign, moves: Move[], end) {
      const r = open(player);
      if (!r || r.id !== id || r.reign.turn !== fromTurn) return false;
      Object.assign(r, { reign: copy(reign), moves: [...moves] });
      if (end) Object.assign(r, { status: reign.status, points: end.points, finishedAt: now() });
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

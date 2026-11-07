/**
 * The Foundational ideas, one column each on the class grid (R7 plan, section 3.1): which maths-record keys make up each idea,
 * which game teaches it, and the words a teacher reads for a fact. The levels use the skill map's own `LEVELS` and 70% rule
 * (shared/kit/teacherGrid.ts `ideaLevel`), so the two pages never disagree. Nothing in shared/maths is changed: the keys come
 * from the ladder skills by their ids.
 */
import { ideaLevel, type IdeaScore } from '../../../shared/kit/teacherGrid';
import type { FactStats } from '../../../shared/maths/leitner';
import { LADDER } from '../../../shared/maths/ladder';
import { type CellLevel } from '../../../shared/maths/skillMap';
import type { FoundationalGameId, QuickLooksProgress } from '../../data/foundational';
import { QUICK_FLUENT_STAGES, QUICK_LOOKS_ID, QUICK_SECURE_STAGES } from './config';

const skillKeys = (...ids: string[]): string[] => [...new Set(ids.flatMap((id) => LADDER.find((s) => s.id === id)?.keys ?? []))];

/** Weka's twenty facts that cross ten (11 to 18 in all), made from the "facts to 20" skill. */
const crossTen = (): string[] =>
  skillKeys('facts-20').filter((k) => {
    const m = /^add:(\d+)\+(\d+)$/.exec(k);
    return !!m && Number(m[1]) + Number(m[2]) > 10 && Number(m[1]) + Number(m[2]) <= 18;
  });

export interface IdeaPart {
  /** A small label when a column has two cells ("100", "1000"). */
  label?: string;
  keys: string[];
}

export interface Idea {
  id: string;
  /** The column heading, and the words in a reason line. */
  label: string;
  /** Which game teaches it (Quick looks is a Training activity, not a game). */
  game: FoundationalGameId | typeof QUICK_LOOKS_ID;
  /** Empty for Quick looks, which has stages not facts. */
  parts: IdeaPart[];
}

export const IDEAS: readonly Idea[] = [
  { id: 'seeing', label: 'Seeing amounts', game: QUICK_LOOKS_ID, parts: [] },
  { id: 'parts', label: 'Parts of numbers', game: 'pipi', parts: [{ keys: skillKeys('parts-5', 'parts-10') }] },
  { id: 'bonds-10', label: 'Bonds to 10', game: 'beanstalk', parts: [{ keys: skillKeys('facts-10').filter((k) => k.startsWith('bond10:')) }] },
  {
    id: 'bonds-big',
    label: 'Bonds to 100 and 1000',
    game: 'beanstalk',
    parts: [
      { label: '100', keys: skillKeys('bonds-100') },
      { label: '1000', keys: skillKeys('bonds-1000') },
    ],
  },
  { id: 'ten-and', label: 'Ten and some', game: 'tui', parts: [{ keys: skillKeys('ten-and') }] },
  { id: 'make-ten', label: 'Make ten, add through ten', game: 'weka', parts: [{ keys: crossTen() }] },
  { id: 'doubles', label: 'Doubles and halves', game: 'korora', parts: [{ keys: skillKeys('dbl-half-10', 'dbl-half-20', 'odd-even') }] },
  { id: 'steps', label: 'Counting in steps', game: 'hop', parts: [{ keys: skillKeys('skip-10', 'skip-5', 'skip-2') }] },
];

/** All the keys a game's facts come from, for its "Hardest right now". */
export const gameKeys = (game: FoundationalGameId): string[] => IDEAS.filter((i) => i.game === game).flatMap((i) => i.parts.flatMap((p) => p.keys));

export interface IdeaCell {
  idea: Idea;
  level: CellLevel;
  /** One entry for each part (two for Bonds to 100 and 1000). */
  parts: { label?: string; level: CellLevel }[];
  /** All the idea's answers, for the "5 of 12 right" flag. */
  score: Pick<IdeaScore, 'level' | 'attempts' | 'correct'>;
}

const RANK: CellLevel[] = ['off', 'not-started', 'learning', 'secure', 'fluent'];

/** Quick looks is a count of stages finished: 0 not started, 1 to 4 learning, 5 and 6 secure, all 7 fluent (R7 plan, 3.1). */
export function quickLooksLevel(q: QuickLooksProgress | null): CellLevel {
  if (!q || (q.finished === 0 && q.answered === 0 && q.last30 === 0)) return 'not-started';
  if (q.finished >= QUICK_FLUENT_STAGES) return 'fluent';
  if (q.finished >= QUICK_SECURE_STAGES) return 'secure';
  return 'learning';
}

/** One pupil's cell for an idea, from their facts (and their Quick looks for the first column). */
export function ideaCell(idea: Idea, facts: readonly FactStats[], quick: QuickLooksProgress | null): IdeaCell {
  if (idea.game === QUICK_LOOKS_ID) {
    const level = quickLooksLevel(quick);
    return { idea, level, parts: [{ level }], score: { level, attempts: quick?.answered ?? 0, correct: quick?.correct ?? 0 } };
  }
  const scores = idea.parts.map((p) => ideaLevel(p.keys, facts));
  // A column with two parts is as far on as its furthest part, and Not started only when neither has begun.
  const best = scores.reduce<CellLevel>((a, s) => (RANK.indexOf(s.level) > RANK.indexOf(a) ? s.level : a), 'off');
  return {
    idea,
    level: best,
    parts: scores.map((s, i) => ({ label: idea.parts[i].label, level: s.level })),
    score: { level: best, attempts: scores.reduce((n, s) => n + s.attempts, 0), correct: scores.reduce((n, s) => n + s.correct, 0) },
  };
}

/** A fact's key in words a teacher can read: `7 + ? = 10`, `Half of 14`, `10 + 6`. */
export function keyWords(key: string): string {
  let m = /^bond10:(\d+)\+(\d+)$/.exec(key);
  if (m) return `${m[1]} + ? = 10`;
  m = /^bond(100|1000):(\w+)$/.exec(key);
  if (m) return `Pairs that make ${m[1]} (${({ tens: 'tens', fives: 'fives', any: 'any numbers', take: 'taking away', hundreds: 'hundreds', fifties: 'fifties' } as Record<string, string>)[m[2]] ?? m[2]})`;
  m = /^dbl:(\d+)$/.exec(key);
  if (m) return `Double ${m[1]}`;
  m = /^half:(\d+)$/.exec(key);
  if (m) return `Half of ${m[1]}`;
  m = /^tenand:(\d+)$/.exec(key);
  if (m) return `10 + ${m[1]}`;
  m = /^add:(\d+)\+(\d+)$/.exec(key);
  if (m) return `${m[1]} + ${m[2]}`;
  m = /^part(\d+):(\d+)$/.exec(key);
  if (m) return `${m[1]} is ${m[2]} and ?`;
  m = /^skip(\d+):(up|next|back):(\d+)$/.exec(key);
  if (m) return `Counting ${m[2] === 'back' ? 'back ' : ''}in ${m[1]}s: ${m[3]}`;
  m = /^oddeven:(\d+)$/.exec(key);
  if (m) return `Is ${m[1]} odd or even?`;
  return key;
}

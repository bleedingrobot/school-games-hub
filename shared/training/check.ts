/**
 * The basic facts check (docs/FACTS-CHECK-PLAN.md): the same 24 times-table and division facts, every 4 weeks, so we can see
 * whether a pupil's facts are really getting better. Training changes what it asks as a pupil improves, so its own numbers
 * can't show that; this set never changes.
 *
 * Shared, so the website and the server agree on the facts, the marking and the scores. Never change CHECK_FACTS in place:
 * a changed set is a new version (CHECK_VERSION + 1), and checks are only compared within one version.
 */
import { typingCeilingMs } from './speed';
import { digitsOf } from './facts';

/** Version 1: 15 November 2026. */
export const CHECK_VERSION = 1;

export interface CheckFact {
  /** As shown: "6 × 7" or "42 ÷ 6". Always shown this way round, so every check is the same. */
  prompt: string;
  answer: number;
}

const mul = (a: number, b: number): CheckFact => ({ prompt: `${a} × ${b}`, answer: a * b });
const div = (p: number, d: number): CheckFact => ({ prompt: `${p} ÷ ${d}`, answer: p / d });

/**
 * 16 times and 8 division facts, easy to hard across the tables taught in Years 3 to 6 (×2 ×5 ×10, then ×3 ×4 ×8, ×6 ×9, ×7,
 * ×11 ×12). Hard facts are in on purpose: a Year 4 who can't do 7 × 8 yet has room to show growth.
 */
export const CHECK_FACTS: readonly CheckFact[] = [
  mul(2, 8), mul(5, 7), mul(10, 6), mul(5, 9),
  mul(3, 7), mul(4, 6), mul(3, 9), mul(8, 8),
  mul(6, 7), mul(6, 9), mul(9, 9), mul(7, 8),
  mul(7, 7), mul(8, 9), mul(11, 4), mul(12, 6),
  div(20, 5), div(18, 3), div(32, 4), div(42, 6),
  div(56, 7), div(63, 9), div(72, 8), div(48, 12),
];

export const CHECK_CONFIG = {
  /** A pupil is asked again this many days after their last check. */
  everyDays: 28,
  /** Right with less thinking time than this (ms) counts as "quick": the "Quick thinking" line in Training (config.ts BANDS). */
  quickMs: 3500,
  /** A question moves on by itself after this long, as not answered. */
  questionMs: 30_000,
  /** The website says who is due (my_facts_check()); pupils below this school year aren't asked. */
  fromYear: 3,
} as const;

/** One answer, in CHECK_FACTS order. `given` null = "Not sure yet" or ran out of time. */
export interface CheckAnswer {
  given: number | null;
  /** From the question showing to the answer going in. */
  ms: number;
  /** Typing time taken off (Training's typingMsFor for the answer's length). */
  typingMs: number;
}

/** The check as the browser sends it (in the training queue). */
export interface CheckItem {
  type: 'check';
  /** Made by the browser (a UUID), so a check sent twice is saved once. */
  id: string;
  version: number;
  /** When it finished on the device, ms since 1970. */
  at: number;
  answers: CheckAnswer[];
}

/** What the server saves: the answers marked, and the three numbers. */
export interface CheckScore {
  right: number;
  quick: number;
  /** Middle thinking time of the right answers, ms. Null if none were right. */
  middleMs: number | null;
  /** Per fact: 0 not right, 1 right, 2 right and quick. */
  marks: number[];
}

export function thinkMsOf(a: CheckAnswer): number {
  return Math.max(0, a.ms - a.typingMs);
}

/** Marks a check against CHECK_FACTS. What the browser thinks was right is never used. */
export function scoreCheck(answers: readonly CheckAnswer[]): CheckScore {
  const marks = CHECK_FACTS.map((f, i) => {
    const a = answers[i];
    if (!a || a.given !== f.answer) return 0;
    return thinkMsOf(a) < CHECK_CONFIG.quickMs ? 2 : 1;
  });
  const times = answers.filter((_, i) => marks[i] > 0).map(thinkMsOf).sort((x, y) => x - y);
  return {
    right: marks.filter((m) => m > 0).length,
    quick: marks.filter((m) => m === 2).length,
    middleMs: times.length ? times[Math.floor(times.length / 2)] : null,
    marks,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Checks a check item from the queue. A bad one is dropped for good, so the problem is a short word for the logs. */
export function checkCheckItem(raw: Record<string, unknown>, now: number): { ok: true; item: CheckItem } | { ok: false; problem: string } {
  if (typeof raw.id !== 'string' || !UUID.test(raw.id)) return { ok: false, problem: 'check-id' };
  if (raw.version !== CHECK_VERSION) return { ok: false, problem: 'check-version' };
  // A week back covers a queue that waited for the Wi-Fi; a little ahead allows for clocks.
  if (!isInt(raw.at, now - 7 * DAY_MS, now + 10 * 60_000)) return { ok: false, problem: 'when' };
  if (!Array.isArray(raw.answers) || raw.answers.length !== CHECK_FACTS.length) return { ok: false, problem: 'answers' };
  const answers: CheckAnswer[] = [];
  for (let i = 0; i < raw.answers.length; i++) {
    const a = raw.answers[i] as Record<string, unknown> | null;
    if (typeof a !== 'object' || a === null) return { ok: false, problem: 'answer-shape' };
    if (a.given !== null && !isInt(a.given, 0, 999)) return { ok: false, problem: 'given' };
    if (!isInt(a.ms, 0, CHECK_CONFIG.questionMs + 5000)) return { ok: false, problem: 'time' };
    // Never more typing time than Training would ever take off for that answer's length.
    if (!isInt(a.typingMs, 0, typingCeilingMs(digitsOf(CHECK_FACTS[i].answer)))) return { ok: false, problem: 'typing' };
    answers.push({ given: a.given as number | null, ms: a.ms, typingMs: a.typingMs });
  }
  return { ok: true, item: { type: 'check', id: raw.id.toLowerCase(), version: CHECK_VERSION, at: raw.at, answers } };
}

/** Shuffled order for showing the facts (the facts and how each is shown stay the same). */
export function checkOrder(seed: number): number[] {
  const order = CHECK_FACTS.map((_, i) => i);
  let s = seed >>> 0 || 1;
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** A finished check as the pupil and teacher see it. */
export interface CheckSummary {
  at: string;
  right: number;
  quick: number;
  middleMs: number | null;
  /** Per fact, as in CheckScore. */
  marks: number[];
}

/** The pupil's line at the end: only ever good news or a kind word. */
export function checkDoneLine(now: Pick<CheckSummary, 'right' | 'quick'>, before: Pick<CheckSummary, 'right' | 'quick'> | null): string {
  if (before && now.quick > before.quick) return `${now.quick - before.quick} more quick facts than last time!`;
  if (before && now.right > before.right) return `${now.right - before.right} more right than last time!`;
  return before ? 'Keep training and watch your facts grow.' : 'Next time we’ll see how much your facts have grown.';
}

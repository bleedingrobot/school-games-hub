/**
 * Saving training: what the website sends the training server function, and the checks the
 * function makes before saving any of it. Shared, so the website and the server agree.
 *
 * The browser keeps a queue of things to save and sends it whenever it can, so a dropped
 * Wi-Fi connection never loses a session. Every item can safely be sent twice: a batch of
 * answers carries an id made by the browser (the database counts it once), and the student's
 * settings are simply replaced by the newest.
 *
 * Training sessions are not replayed on the server (a student's records depend on every earlier
 * session, which may still be waiting in the queue on another device). The checks keep rubbish
 * out instead: the fact must be real, the answer is marked here from the real fact (what the
 * browser says is right doesn't matter), and the times and dates must be possible.
 */
import { TRAINING_CONFIG } from './config';
import { FACT_BY_KEY } from './facts';

/** One answer, as the browser sends it. `at` is ms since 1970; `day` is the student's own date. */
export interface AnswerInput {
  key: string;
  /** What the student typed (the server marks it). */
  given: number;
  ms: number;
  typingMs: number;
  at: number;
  day: string;
}

/** Answers since the last send, oldest first, all from one session (the `seed` rebuilds it). */
export interface AnswersItem {
  type: 'answers';
  /** Made by the browser (a UUID), so the same answers are only counted once. */
  batchId: string;
  seed: number;
  answers: AnswerInput[];
}

/** The student's typing check times and settings. Newest replaces older. */
export interface StudentItem {
  type: 'student';
  typing: Record<number, number[]>;
  autoSubmit: boolean;
  sessionsDone: number;
}

export type SaveItem = AnswersItem | StudentItem;

export type ItemResult =
  | { type: 'answers'; added: number }
  | { type: 'student' }
  | { type: 'invalid'; problem: string };

export interface SaveResponse {
  /** How many items from the front of the list are dealt with. */
  handled: number;
  results: ItemResult[];
}

/** What the database function takes for each answer: the same, plus whether it was right. */
export interface CheckedAnswer extends AnswerInput {
  correct: boolean;
}

export type CheckedItem =
  | { type: 'answers'; batchId: string; seed: number; answers: CheckedAnswer[] }
  | { type: 'student'; typing: Record<string, number[]>; autoSubmit: boolean; sessionsDone: number };

/** Items per request, and answers per batch (a session is 20 to 30). */
export const MAX_ITEMS = 40;
export const MAX_ANSWERS_PER_BATCH = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** "YYYY-MM-DD" as a day number, or null if it isn't a real date. */
function dayNumber(day: unknown): number | null {
  if (typeof day !== 'string' || !DAY.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return null;
  return Math.round(t / DAY_MS);
}

type Checked<T> = { ok: true; item: T } | { ok: false; problem: string };

function checkAnswer(raw: unknown, now: number): Checked<CheckedAnswer> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, problem: 'answer-shape' };
  const a = raw as Record<string, unknown>;
  const { storage } = TRAINING_CONFIG;
  if (typeof a.key !== 'string') return { ok: false, problem: 'fact' };
  const fact = FACT_BY_KEY.get(a.key);
  if (!fact) return { ok: false, problem: 'fact' };
  if (!isInt(a.given, 0, 999_999)) return { ok: false, problem: 'given' };
  if (!isInt(a.ms, 0, storage.rejectAnswerMs)) return { ok: false, problem: 'time' };
  if (!isInt(a.typingMs, 0, storage.longestTypingMs)) return { ok: false, problem: 'typing' };
  // About a month back is plenty for a queue that waited for the Wi-Fi; a little ahead allows for clocks.
  if (!isInt(a.at, now - 30 * DAY_MS, now + 10 * 60_000)) return { ok: false, problem: 'when' };
  const day = dayNumber(a.day);
  // The student's date may differ from the UTC date by a day (New Zealand is ahead).
  if (day === null || Math.abs(day - Math.floor((a.at as number) / DAY_MS)) > 1) return { ok: false, problem: 'day' };
  return {
    ok: true,
    item: { key: a.key, given: a.given, ms: a.ms, typingMs: a.typingMs, at: a.at as number, day: a.day as string, correct: a.given === fact.answer },
  };
}

function checkTyping(raw: unknown): Record<string, number[]> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, number[]> = {};
  for (const [digits, samples] of Object.entries(raw)) {
    if (!['1', '2', '3'].includes(digits) || !Array.isArray(samples) || samples.length > TRAINING_CONFIG.typing.keep * 2) return null;
    if (!samples.every((ms) => isInt(ms, 1, TRAINING_CONFIG.storage.longestTypingMs))) return null;
    out[digits] = samples;
  }
  return out;
}

/** Checks one queue item. A bad one is dropped for good, so the problem is a short word for the logs. */
export function checkItem(raw: unknown, now: number): Checked<CheckedItem> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, problem: 'shape' };
  const item = raw as Record<string, unknown>;
  if (item.type === 'answers') {
    if (typeof item.batchId !== 'string' || !UUID.test(item.batchId)) return { ok: false, problem: 'batch-id' };
    if (!isInt(item.seed, 0, 2_147_483_647)) return { ok: false, problem: 'seed' };
    if (!Array.isArray(item.answers) || item.answers.length === 0 || item.answers.length > MAX_ANSWERS_PER_BATCH) {
      return { ok: false, problem: 'answers' };
    }
    const answers: CheckedAnswer[] = [];
    for (const a of item.answers) {
      const checked = checkAnswer(a, now);
      if (!checked.ok) return checked;
      answers.push(checked.item);
    }
    return { ok: true, item: { type: 'answers', batchId: item.batchId.toLowerCase(), seed: item.seed, answers } };
  }
  if (item.type === 'student') {
    const typing = checkTyping(item.typing);
    if (!typing) return { ok: false, problem: 'typing' };
    if (typeof item.autoSubmit !== 'boolean') return { ok: false, problem: 'auto-submit' };
    if (!isInt(item.sessionsDone, 0, 100_000)) return { ok: false, problem: 'sessions' };
    return { ok: true, item: { type: 'student', typing, autoSubmit: item.autoSubmit, sessionsDone: item.sessionsDone } };
  }
  return { ok: false, problem: 'type' };
}

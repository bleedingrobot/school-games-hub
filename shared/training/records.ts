/** A student's training records: pure functions, so the preview, the tests and (later) a server share them. */
import { TRAINING_CONFIG, type TrainingConfig } from './config';
import { isQuickKey } from '../subitising/keys';
import type { QuickSettings } from '../subitising/saved';
import { digitsOf } from './facts';
import { factBandIndex, thinkingMs, typingMsFor, type Answer, type BandIndex } from './speed';

export interface FactRecord {
  /** Latest answers, oldest first. */
  answers: Answer[];
  /** Days on which the fact's colour was bright green after answering. "Known" needs two. */
  greenDays: string[];
  lastDay: string;
}

export interface TrainingState {
  records: Record<string, FactRecord>;
  /** Typing check times in ms by answer length (1 to 3 digits), oldest first. */
  typing: Record<number, number[]>;
  /** The latest answers across all facts (true = right), for spotting a student who is struggling. */
  recent: boolean[];
  sessionsDone: number;
  autoSubmit: boolean;
}

export const emptyState = (): TrainingState => ({ records: {}, typing: {}, recent: [], sessionsDone: 0, autoSubmit: true });

/** "YYYY-MM-DD" for a Date, in the device's own time zone. */
export function dayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from one "YYYY-MM-DD" to another (b minus a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export const isKnown = (r: FactRecord | undefined, config: TrainingConfig = TRAINING_CONFIG) =>
  !!r && r.greenDays.length >= config.knownGreenDays;

export const recordBand = (r: FactRecord | undefined): BandIndex | null => (r ? factBandIndex(r.answers) : null);

export const secureBandIndex = (config: TrainingConfig = TRAINING_CONFIG) => {
  const i = ['bright', 'light', 'yellow', 'orange', 'blue', 'grey'].indexOf(config.secureBand);
  return i < 0 ? 1 : i;
};

/** Light green or faster: secure enough to keep moving to the next set of facts. */
export function isSecure(r: FactRecord | undefined, config: TrainingConfig = TRAINING_CONFIG): boolean {
  const band = recordBand(r);
  return band !== null && band <= secureBandIndex(config);
}

/** Days until this fact is due again, from how many green days it has. */
export function reviewInterval(r: FactRecord, config: TrainingConfig = TRAINING_CONFIG): number {
  const days = config.reviewDays;
  return days[Math.min(r.greenDays.length, days.length - 1)];
}

/** Whole days a fact is past due (0 when it is due today, negative when it is not due yet). */
export function overdueDays(r: FactRecord, today: string, config: TrainingConfig = TRAINING_CONFIG): number {
  return daysBetween(r.lastDay, today) - reviewInterval(r, config);
}

export const isDue = (r: FactRecord, today: string, config: TrainingConfig = TRAINING_CONFIG) => overdueDays(r, today, config) >= 0;

export function isStruggling(state: TrainingState, config: TrainingConfig = TRAINING_CONFIG): boolean {
  const { window, minAnswers, belowCorrect } = config.struggling;
  const recent = state.recent.slice(-window);
  if (recent.length < minAnswers) return false;
  return recent.filter(Boolean).length / recent.length < belowCorrect;
}

/**
 * The one place an answer changes a fact's record. `typedMs` is the typing time that was taken off
 * for this answer; it is passed in (not looked up) so that answers rebuilt from the database give
 * the same records as answers given live.
 */
function applyAnswer(
  state: TrainingState,
  factKey: string,
  correct: boolean,
  answerMs: number,
  typedMs: number,
  day: string,
  config: TrainingConfig,
): { state: TrainingState; answer: Answer } {
  const entry: Answer = { correct, thinkMs: correct ? thinkingMs(answerMs, typedMs) : null, day };
  const old = state.records[factKey];
  const answers = [...(old?.answers ?? []), entry].slice(-config.historyLength);
  const greenDays = [...(old?.greenDays ?? [])];
  if (factBandIndex(answers, config) === 0 && !greenDays.includes(day)) greenDays.push(day);
  return {
    answer: entry,
    state: {
      ...state,
      records: { ...state.records, [factKey]: { answers, greenDays, lastDay: day } },
      recent: [...state.recent, correct].slice(-config.struggling.window),
    },
  };
}

/**
 * Records one answer and returns the new state (the old one is not changed).
 * `answerMs` is the time from the question being fully shown to the answer going in.
 * `typedMs` is the typing time that was taken off, so it can be saved with the answer.
 * Fix-it answers must NOT be passed in here: they don't count.
 */
export function recordAnswer(
  state: TrainingState,
  factKey: string,
  answer: number,
  correctAnswer: number,
  answerMs: number,
  day: string,
  config: TrainingConfig = TRAINING_CONFIG,
): { state: TrainingState; answer: Answer; correct: boolean; typedMs: number } {
  const correct = answer === correctAnswer;
  const typedMs = typingMsFor(digitsOf(correctAnswer), state.typing, config);
  return { ...applyAnswer(state, factKey, correct, answerMs, typedMs, day, config), correct, typedMs };
}

// ---------------------------------------------------------------------------
// Saved answers (stage T.2): what the database keeps, and getting the records back from it.
// ---------------------------------------------------------------------------

/** One answer as saved. `at` is milliseconds since 1970; `day` is the student's own date, "YYYY-MM-DD". */
export interface SavedAnswer {
  key: string;
  correct: boolean;
  ms: number;
  typingMs: number;
  day: string;
  at: number;
}

/** A student's saved settings: typing check times, auto-submit and how many sessions they have done. */
export interface SavedStudent {
  typing: Record<number, number[]>;
  autoSubmit: boolean;
  sessionsDone: number;
  /** Quick looks settings that follow the student (null until they have used it). */
  quick?: QuickSettings | null;
}

/** The same answer, whichever copy it came from. */
export const savedAnswerId = (a: Pick<SavedAnswer, 'key' | 'at'>) => `${a.at}|${a.key}`;

/**
 * Saved answers followed by answers not yet saved, without any answer counted twice (a batch can
 * reach the database and the reply get lost, so it is still in the queue when the page loads).
 */
export function withUnsaved(saved: readonly SavedAnswer[], unsaved: readonly SavedAnswer[]): SavedAnswer[] {
  const seen = new Set(saved.map(savedAnswerId));
  const out = [...saved];
  for (const a of unsaved) {
    if (seen.has(savedAnswerId(a))) continue;
    seen.add(savedAnswerId(a));
    out.push(a);
  }
  return out;
}

/** Rebuilds a student's records by giving every saved answer again, oldest first. Same result as answering live. */
export function rebuildState(
  answers: readonly SavedAnswer[],
  student: Partial<SavedStudent> | null = null,
  config: TrainingConfig = TRAINING_CONFIG,
): TrainingState {
  let state: TrainingState = {
    ...emptyState(),
    typing: { ...(student?.typing ?? {}) },
    autoSubmit: student?.autoSubmit ?? true,
    sessionsDone: student?.sessionsDone ?? 0,
  };
  // Quick looks answers are saved with these but belong to Quick looks (shared/subitising): they never touch the facts map.
  const ordered = answers.map((a, i) => ({ a, i })).filter(({ a }) => !isQuickKey(a.key)).sort((p, q) => p.a.at - q.a.at || p.i - q.i);
  for (const { a } of ordered) state = applyAnswer(state, a.key, a.correct, a.ms, a.typingMs, a.day, config).state;
  return state;
}

/** Adds a typing check time for an answer length. */
export function recordTyping(state: TrainingState, digits: number, ms: number, config: TrainingConfig = TRAINING_CONFIG): TrainingState {
  const d = Math.min(Math.max(digits, 1), 3);
  // Whole milliseconds within what the database accepts, so the same number is saved and used.
  const whole = Math.min(Math.max(Math.round(ms), 1), config.storage.longestTypingMs);
  return { ...state, typing: { ...state.typing, [d]: [...(state.typing[d] ?? []), whole].slice(-config.typing.keep * 2) } };
}

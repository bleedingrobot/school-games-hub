/**
 * Basic facts training: saving and loading.
 *
 * Every answer goes into a queue kept in this browser (one per student), and the queue is sent to
 * the training server function whenever it can be: every few answers, at the end of a session,
 * when the student leaves, when the Wi-Fi comes back, and when Training opens again. A dropped
 * connection just means it goes later. Sending a batch twice is safe: each batch has an id made
 * here, and the database counts it once.
 *
 * Answers wait in a "pending" list until a send; then they are sealed into batches (each with its
 * own id) that stay in the queue unchanged until the server confirms them, so a retry after a lost
 * reply sends the very same batch.
 *
 * The records on screen are always the saved answers plus anything not saved yet, played back
 * through shared/training/records.ts, so a session done offline shows up straight away.
 */
import { finishedInARow, quickAnswersFrom, splitTyping, type QuickSettings } from '../../shared/subitising/saved';
import { progressFrom, type SubAnswer } from '../../shared/subitising/engine';
import {
  emptyState,
  rebuildState,
  withUnsaved,
  type SavedAnswer,
  type SavedStudent,
  type TrainingState,
} from '../../shared/training/records';
import { correctAnswerFor, MAX_ANSWERS_PER_BATCH, MAX_ITEMS, type AnswerEvent, type AnswerInput, type SaveItem, type SaveResponse, type StudentItem } from '../../shared/training/save';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';

/** An answer waiting for its first send. */
export type PendingAnswer = AnswerEvent;

/** What my_training() returns. */
export interface TrainingData {
  answers: SavedAnswer[];
  student: SavedStudent | null;
}

// ---------------------------------------------------------------------------
// Browser storage (each read and write can fail: private windows, blocked storage)
// ---------------------------------------------------------------------------

const queueKey = (player: string) => `sgh-training-queue:${player}`;
const pendingKey = (player: string) => `sgh-training-pending:${player}`;
const copyKey = (player: string) => `sgh-training-copy:${player}`;

function read<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: it lasts until the page closes.
  }
}

/** Kept in memory as well, in case storage is blocked. */
const memory = new Map<string, unknown>();

function get<T>(key: string, fallback: T): T {
  return (memory.get(key) as T | undefined) ?? read<T>(key) ?? fallback;
}

function set(key: string, value: unknown[] | null) {
  if (value === null || value.length === 0) memory.delete(key);
  else memory.set(key, value);
  write(key, value && value.length ? value : null);
}

export const queuedItems = (player: string): SaveItem[] => get<SaveItem[]>(queueKey(player), []);
export const pendingAnswers = (player: string): PendingAnswer[] => get<PendingAnswer[]>(pendingKey(player), []);

/** The most that may wait: a few weeks of daily practice offline is far more than anyone will do. */
const MAX_QUEUE = 200;
const MAX_PENDING = 2000;

/** Adds an answer to be saved. */
export function addAnswer(player: string, answer: PendingAnswer) {
  set(pendingKey(player), [...pendingAnswers(player), answer].slice(-MAX_PENDING));
}

/** The newest typing times and settings replace any older ones still waiting. */
export function enqueueStudent(player: string, item: StudentItem) {
  const items = queuedItems(player).filter((i) => i.type !== 'student');
  set(queueKey(player), [...items, item].slice(-MAX_QUEUE));
}

/** Turns the pending answers into batches with ids and puts them at the end of the queue. */
export function sealPending(player: string) {
  const pending = pendingAnswers(player);
  if (pending.length === 0) return;
  const batches: SaveItem[] = [];
  for (const a of pending) {
    const last = batches[batches.length - 1];
    const { seed, ...answer } = a;
    if (last?.type === 'answers' && last.seed === seed && last.answers.length < MAX_ANSWERS_PER_BATCH) last.answers.push(answer);
    else batches.push({ type: 'answers', batchId: crypto.randomUUID(), seed, answers: [answer] });
  }
  // Sealed first, then forgotten as pending, so a failure in between can't lose answers (a batch seen twice is counted once).
  set(queueKey(player), [...queuedItems(player), ...batches].slice(-MAX_QUEUE));
  set(pendingKey(player), null);
}

const toSaved = (a: AnswerInput): SavedAnswer => ({
  key: a.key,
  correct: a.given === correctAnswerFor(a.key),
  ms: a.ms,
  typingMs: a.typingMs,
  day: a.day,
  at: a.at,
});

/** Answers that haven't been confirmed saved yet, as the records need them. */
export function unsavedAnswers(player: string): SavedAnswer[] {
  const queued = queuedItems(player).flatMap((i) => (i.type === 'answers' ? i.answers.map(toSaved) : []));
  return [...queued, ...pendingAnswers(player).map(toSaved)];
}

/** Typing times and settings still waiting to be saved (newer than the server's). */
export function unsavedStudent(player: string): SavedStudent | null {
  const item = queuedItems(player).find((i): i is StudentItem => i.type === 'student');
  return item ? { typing: item.typing, autoSubmit: item.autoSubmit, sessionsDone: item.sessionsDone, quick: item.quick ?? null } : null;
}

/**
 * Items the server has confirmed also go into the copy kept for opening offline, so what was
 * just saved is not missing from it (the copy is otherwise only replaced when Training opens).
 */
function keepInCopy(player: string, done: SaveItem[]) {
  const copy = read<TrainingData>(copyKey(player)) ?? { answers: [], student: null };
  const answers = done.flatMap((i) => (i.type === 'answers' ? i.answers.map(toSaved) : []));
  const student = [...done].reverse().find((i): i is StudentItem => i.type === 'student');
  write(copyKey(player), {
    answers: withUnsaved(copy.answers, answers),
    student: student
      ? { typing: student.typing, autoSubmit: student.autoSubmit, sessionsDone: student.sessionsDone, quick: student.quick ?? copy.student?.quick ?? null }
      : copy.student,
  });
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** One send at a time, so two saves can't race each other. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Sends the queue. Items the server has dealt with leave it; the rest wait for next time.
 * Never throws: says whether everything got through.
 */
export function flushQueue(player: string, keepalive = false): Promise<boolean> {
  const next = chain.then(() => sendQueue(player, keepalive));
  chain = next.catch(() => false);
  return next;
}

async function sendQueue(player: string, keepalive: boolean): Promise<boolean> {
  sealPending(player);
  // Send up to MAX_ITEMS at a time until it is empty or something stops.
  for (let round = 0; round < 20; round++) {
    const items = queuedItems(player);
    if (items.length === 0) return true;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return false;
      const batch = items.slice(0, MAX_ITEMS);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/training`, {
        method: 'POST',
        keepalive,
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as SaveResponse;
      const handled = Math.max(0, Math.min(batch.length, body.handled ?? 0));
      if (handled === 0) return false;
      // Take out what was dealt with. Anything added (or replaced) while sending stays.
      const done = batch.slice(0, handled);
      const gone = new Set(done.map((i) => JSON.stringify(i)));
      set(queueKey(player), queuedItems(player).filter((i) => !gone.has(JSON.stringify(i))));
      keepInCopy(player, done);
    } catch {
      // Offline: it goes next time.
      return false;
    }
  }
  return queuedItems(player).length === 0;
}

/**
 * The records to show: what the server has (or the last copy we kept) with anything unsaved
 * played on top, and the typing times and settings, newest first.
 */
export function stateFrom(player: string, data: TrainingData | null): TrainingState {
  const answers = withUnsaved(data?.answers ?? [], unsavedAnswers(player));
  const student = unsavedStudent(player) ?? data?.student ?? null;
  return answers.length === 0 && !student ? emptyState() : rebuildState(answers, student);
}

/**
 * Everything Training needs to open: the server's copy if it can be reached (after sending
 * anything still queued), else the copy kept in this browser, else a fresh start.
 * `offline` says the server couldn't be reached.
 */
export async function loadTraining(player: string): Promise<{ state: TrainingState; offline: boolean; quick: QuickLoad }> {
  await flushQueue(player);
  try {
    const { data, error } = await supabase.rpc('my_training');
    if (error || !data) throw error ?? new Error('no data');
    const loaded = data as TrainingData;
    // The database keeps Quick looks settings inside the typing column: pull them out so Training only sees typing times.
    const split = splitTyping(loaded.student?.typing as Record<string, unknown> | undefined);
    const kept: TrainingData = {
      answers: loaded.answers ?? [],
      student: loaded.student ? { ...loaded.student, typing: split.typing, quick: split.quick } : null,
    };
    write(copyKey(player), kept);
    return { state: stateFrom(player, kept), offline: false, quick: quickFrom(player, kept) };
  } catch {
    const kept = read<TrainingData>(copyKey(player));
    return { state: stateFrom(player, kept), offline: true, quick: quickFrom(player, kept) };
  }
}

/** Everything Quick looks needs to open: the student's Quick looks answers (saved and not yet saved) and settings. */
export interface QuickLoad {
  answers: SubAnswer[];
  settings: QuickSettings | null;
}

/**
 * Quick looks answers come out of the same saved answers as the facts map, but never go into it
 * (rebuildState leaves them out). The stage reached is kept with the student, so a stage finished
 * long ago stays finished even after its oldest answers have been trimmed from the database.
 */
export function quickFrom(player: string, data: TrainingData | null): QuickLoad {
  const answers = quickAnswersFrom(withUnsaved(data?.answers ?? [], unsavedAnswers(player)));
  const settings = unsavedStudent(player)?.quick ?? data?.student?.quick ?? null;
  if (!settings) return { answers, settings: null };
  // Never behind what the answers themselves show.
  const shown = finishedInARow(progressFrom(answers, settings.startStage, undefined, settings.finished));
  return { answers, settings: { ...settings, finished: Math.max(settings.finished, shown) as QuickSettings['finished'] } };
}

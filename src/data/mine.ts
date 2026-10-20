/**
 * Mine Runner's saving and loading (docs/MINE-PLAN.md, section 8).
 *
 * Before a counted run the mine server function hands out a stamped seed (and, with maths, the run's questions). Each
 * question door or pad is answered by sending the answer to the server before anything opens. When the run is finished,
 * the recorded inputs are put in a small queue kept in this browser (one per pupil) and sent to the server, which replays
 * them itself and keeps the time it works out. A dropped Wi-Fi connection just means the queue is sent later; sending a
 * run twice is safe (the seed saves once).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { parseMathsSwitch, type MathsSwitch } from '../../shared/space/mathsSwitch';
import type { PublicQuestion } from '../../shared/maths/serverQuestions';
import type { StartReply } from '../../shared/mine/maths';
import type { FlightMode, MineRunReport } from '../../shared/mine/save';
import { readSettings } from './classSettings';
import { forgetSettings } from './settingsMemory';
import { FriendlyError } from './profile';

export type { StartReply, MineRunReport };

const queueKey = (player: string) => `sgh-mine-queue:${player}`;
/** The most runs waiting to be sent (the newest are kept). */
const MAX_QUEUE = 8;

/** How long a run waits for the server to start before it is played without it. */
const START_TIMEOUT_MS = 6000;

const memoryQueues = new Map<string, MineRunReport[]>();

function readQueue(player: string): MineRunReport[] {
  const mem = memoryQueues.get(player);
  if (mem) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(queueKey(player)) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as MineRunReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(player: string, items: MineRunReport[]) {
  memoryQueues.set(player, items);
  try {
    if (items.length) localStorage.setItem(queueKey(player), JSON.stringify(items));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked: the queue lasts until the page closes.
  }
}

export const queuedRuns = readQueue;

export function enqueueRun(player: string, report: MineRunReport) {
  const items = readQueue(player).filter((r) => r.seed !== report.seed);
  writeQueue(player, [...items, report].slice(-MAX_QUEUE));
}

async function post(body: unknown, keepalive = false, timeoutMs = 0): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${SUPABASE_URL}/functions/v1/mine`, {
      method: 'POST',
      // A keep-alive request has a smaller size limit in browsers, so it is only used for small sends.
      keepalive: keepalive && JSON.stringify(body).length < 60_000,
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

async function readError(response: Response): Promise<{ message: string; code: string }> {
  try {
    const body = (await response.json()) as { error?: unknown; code?: unknown };
    return { message: typeof body.error === 'string' ? body.error : '', code: typeof body.code === 'string' ? body.code : '' };
  } catch {
    return { message: '', code: '' };
  }
}

export type StartResult =
  | { ok: true; run: StartReply }
  /** `offline`: the server could not be reached or could not make the run (the mine can still be played as practice). */
  | { ok: false; reason: 'offline' | 'maths-off' | 'maths-on' | 'too-many'; message: string };

/**
 * Starts a counted run: a stamped seed, and with maths the run's questions. If the server can't be reached the mine can
 * still be flown as practice, it just won't be saved.
 */
export async function startRun(level: string, mode: FlightMode, maths: boolean): Promise<StartResult> {
  const offline: StartResult = { ok: false, reason: 'offline', message: 'The school server could not be reached, so this dive won’t count.' };
  const response = await post({ action: 'start', level, mode, maths }, false, START_TIMEOUT_MS);
  if (!response) return offline;
  if (!response.ok) {
    const { message, code } = await readError(response);
    if (code === 'maths-off' || code === 'maths-on' || code === 'too-many') return { ok: false, reason: code, message };
    return offline;
  }
  try {
    const body = (await response.json()) as Partial<StartReply>;
    if (typeof body.seed !== 'string' || typeof body.stamp !== 'string' || !Array.isArray(body.questions)) return offline;
    return { ok: true, run: { seed: body.seed, stamp: body.stamp, maths: body.maths === true, questions: body.questions as PublicQuestion[] } };
  } catch {
    return offline;
  }
}

/** The server's mark for an answer. */
export interface MarkedByServer {
  correct: boolean;
  answer: number;
}

/**
 * Sends one answer to be marked. Throws a friendly error if the server can't be reached: the question box then lets the
 * pupil try again, and an answer sent again is answered the same way and counted once.
 */
export async function answerQuestion(
  started: { seed: string; stamp: string },
  level: string,
  mode: FlightMode,
  slot: number,
  value: number,
  ms: number,
): Promise<MarkedByServer> {
  const response = await post({ action: 'answer', seed: started.seed, stamp: started.stamp, level, mode, slot, value, ms });
  if (!response?.ok) throw new FriendlyError('We couldn’t reach the school’s server. Check your Wi-Fi and try that one again.');
  try {
    const body = (await response.json()) as { correct?: unknown; answer?: unknown };
    if (typeof body.correct === 'boolean' && typeof body.answer === 'number') return { correct: body.correct, answer: body.answer };
  } catch {
    // Falls through to the same message.
  }
  throw new FriendlyError('We couldn’t check that one. Try it again.');
}

let chain: Promise<unknown> = Promise.resolve();

/** Sends the queue one run at a time. Never throws: says whether everything got through. */
export function flushRuns(player: string, keepalive = false): Promise<boolean> {
  const next = chain.then(() => sendRuns(player, keepalive));
  chain = next.catch(() => false);
  return next;
}

export type SendOutcome = 'saved' | 'waiting' | 'refused' | 'break';
let lastOutcomes = new Map<string, SendOutcome>();

/** How the last send of this seed went (for the finish screen). */
export const outcomeOf = (seed: string): SendOutcome | undefined => lastOutcomes.get(seed);

async function sendRuns(player: string, keepalive: boolean): Promise<boolean> {
  for (let round = 0; round < MAX_QUEUE + 1; round++) {
    const first = readQueue(player)[0];
    if (!first) return true;
    const response = await post({ action: 'finish', ...first }, keepalive);
    if (!response) {
      lastOutcomes.set(first.seed, 'waiting');
      return false;
    }
    // 200 = saved (or saved before). 400 = the server will never take this run, so drop it.
    // 429 (a break is needed), 503 and the rest: keep it for later.
    if (response.ok || response.status === 400) {
      lastOutcomes.set(first.seed, response.ok ? 'saved' : 'refused');
      writeQueue(player, readQueue(player).filter((r) => r.seed !== first.seed));
    } else {
      lastOutcomes.set(first.seed, response.status === 429 ? 'break' : 'waiting');
      return false;
    }
  }
  return readQueue(player).length === 0;
}

/** Forgets what the last sends said (tests). */
export function forgetOutcomes() {
  lastOutcomes = new Map();
}

/** The pupil's saved bests: `${level}|${maths}` → steps. Null if the server can't be reached. */
export type ServerBests = Record<string, number>;
export const bestKey = (level: string, maths: boolean) => `${level}|${maths ? 'maths' : 'plain'}`;

export async function loadServerBests(): Promise<ServerBests | null> {
  try {
    const { data, error } = await supabase.rpc('my_mine');
    if (error || !Array.isArray(data)) return null;
    const out: ServerBests = {};
    for (const b of data as { level: string; maths: boolean; steps: number }[]) {
      if (typeof b.level === 'string' && typeof b.steps === 'number') out[bestKey(b.level, b.maths === true)] = b.steps;
    }
    return out;
  } catch {
    return null;
  }
}

export interface Board {
  top: { rank: number; name: string; avatar: unknown; steps: number; me: boolean }[];
  me: { rank: number; steps: number } | null;
  total: number;
}

/** The school board for a level (`l3` or `l3:hard`) with or without maths, or null if it can't be loaded. */
export async function loadBoard(level: string, maths: boolean): Promise<Board | null> {
  try {
    const { data, error } = await supabase.rpc('mine_board', { in_level: level, in_maths: maths });
    if (error || !data || typeof data !== 'object' || !Array.isArray((data as Board).top)) return null;
    return data as Board;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the teacher's maths switch

/** What the teacher allows for Mine Runner maths in a class. If it can't be read, maths stays off. */
export async function fetchMineMaths(classId?: string | null): Promise<MathsSwitch> {
  const row = await readSettings(['mine_maths'], classId);
  return parseMathsSwitch(row?.mine_maths);
}

export async function saveMineMaths(mode: MathsSwitch, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_mine_maths', { mode, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

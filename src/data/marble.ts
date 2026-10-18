/**
 * Marble Rush's saving and loading (stage M.4).
 *
 * Before a run the marble server function hands out a stamped seed. When the run is finished, the
 * recorded inputs are put in a small queue kept in this browser (one per student) and sent to the
 * server, which replays them itself and keeps the time it works out. A dropped Wi-Fi connection just
 * means the queue is sent later; sending a run twice is safe (the seed saves once).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { parseMathsSwitch, type MathsSwitch } from '../../shared/space/mathsSwitch';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import type { ClockMode } from '../../shared/marble/engine';
import { doorsFromMask, type StartReply } from '../../shared/marble/maths';
import type { MarbleRunReport } from '../../shared/marble/save';
import type { Bests } from '../games/marble/bests';

const queueKey = (player: string) => `sgh-marble-queue:${player}`;
/** The most runs waiting to be sent (the newest are kept). */
const MAX_QUEUE = 12;

/** How long a run waits for the server to start before it is played without it. */
const START_TIMEOUT_MS = 6000;

const memoryQueues = new Map<string, MarbleRunReport[]>();

function readQueue(player: string): MarbleRunReport[] {
  const mem = memoryQueues.get(player);
  if (mem) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(queueKey(player)) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as MarbleRunReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(player: string, items: MarbleRunReport[]) {
  memoryQueues.set(player, items);
  try {
    if (items.length) localStorage.setItem(queueKey(player), JSON.stringify(items));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked: the queue lasts until the page closes.
  }
}

export const queuedRuns = readQueue;

export function enqueueRun(player: string, report: MarbleRunReport) {
  const items = readQueue(player).filter((r) => r.seed !== report.seed);
  writeQueue(player, [...items, report].slice(-MAX_QUEUE));
}

async function post(body: unknown, keepalive = false, timeoutMs = 0): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${SUPABASE_URL}/functions/v1/marble`, {
      method: 'POST',
      keepalive,
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/**
 * Starts a run: a stamped seed, and (if the teacher allows maths and the student wants it) the run's questions and open doors.
 * Null if the server can't be reached; the run can still be played without maths, it just won't be saved.
 */
export async function startRun(course: string, mode: ClockMode, maths = false): Promise<StartReply | null> {
  const response = await post({ action: 'start', course, mode, maths }, false, START_TIMEOUT_MS);
  if (!response?.ok) return null;
  try {
    const body = (await response.json()) as Partial<StartReply>;
    if (typeof body.seed !== 'string' || typeof body.stamp !== 'string' || !Array.isArray(body.doors) || !Array.isArray(body.gates)) return null;
    return {
      seed: body.seed,
      stamp: body.stamp,
      maths: body.maths === true,
      rescue: body.rescue === true,
      doors: body.doors.filter((d): d is number => Number.isInteger(d)),
      gates: body.gates as StartReply['gates'],
      pits: Array.isArray(body.pits) ? body.pits : [],
      rescues: Array.isArray(body.rescues) ? body.rescues : [],
    };
  } catch {
    return null;
  }
}

/** The server's mark for a pit-stop or rescue answer: null if it could not be reached (the question is then just skipped). */
export async function answerQuestion(
  started: { seed: string; stamp: string },
  course: string,
  mode: ClockMode,
  slot: number,
  answer: number,
  ms: number,
): Promise<{ right: boolean; answer: number } | null> {
  const response = await post({ action: 'answer', seed: started.seed, stamp: started.stamp, course, mode, slot, answer, ms });
  if (!response?.ok) return null;
  try {
    const body = (await response.json()) as { right?: unknown; answer?: unknown };
    return typeof body.right === 'boolean' && typeof body.answer === 'number' ? { right: body.right, answer: body.answer } : null;
  } catch {
    return null;
  }
}

let chain: Promise<unknown> = Promise.resolve();

/** Sends the queue one run at a time. Never throws: says whether everything got through. */
export function flushRuns(player: string, keepalive = false): Promise<boolean> {
  const next = chain.then(() => sendRuns(player, keepalive));
  chain = next.catch(() => false);
  return next;
}

async function sendRuns(player: string, keepalive: boolean): Promise<boolean> {
  for (let round = 0; round < MAX_QUEUE + 1; round++) {
    const first = readQueue(player)[0];
    if (!first) return true;
    const response = await post({ action: 'save', ...first }, keepalive);
    if (!response) return false;
    // 200 = saved (or saved before). 400 = the server will never take this run, so drop it.
    // 429 (a break is needed), 503 and the rest: keep it for later.
    if (response.ok || response.status === 400) {
      writeQueue(player, readQueue(player).filter((r) => r.seed !== first.seed));
    } else {
      return false;
    }
  }
  return readQueue(player).length === 0;
}

interface ServerBest {
  course: string;
  mode: ClockMode;
  maths: boolean;
  steps: number;
  falls: number;
}

/** The student's saved bests (without questions), or null if the server can't be reached. */
export async function loadServerBests(maths = false): Promise<Bests | null> {
  try {
    const { data, error } = await supabase.rpc('my_marble');
    if (error || !Array.isArray(data)) return null;
    const out: Bests = {};
    for (const b of data as ServerBest[]) {
      if (b.maths !== maths) continue;
      out[b.course] = { ...out[b.course], [b.mode]: b.steps };
    }
    return out;
  } catch {
    return null;
  }
}

export type GhostKind = 'mine' | 'next' | 'top';

export interface Ghost {
  name: string;
  steps: number;
  /** The recorded inputs, as text (decode with decodeInputs). */
  inputs: string;
  /** The shortcut doors that were open for that run (a run can only be played back with the same doors). */
  doors: number[];
}

/** A recorded run to race against, or null (none yet, or the server can't be reached). */
export async function loadGhost(course: string, mode: ClockMode, which: GhostKind, maths = false): Promise<Ghost | null> {
  try {
    const { data, error } = await supabase.rpc('marble_ghost', { in_course: course, in_mode: mode, in_maths: maths, which });
    if (error || !data || typeof data !== 'object') return null;
    const g = data as Partial<Ghost> & { doors?: unknown };
    if (typeof g.name !== 'string' || typeof g.steps !== 'number' || typeof g.inputs !== 'string') return null;
    return { name: g.name, steps: g.steps, inputs: g.inputs, doors: doorsFromMask(typeof g.doors === 'number' ? g.doors : 0) };
  } catch {
    return null;
  }
}

export interface Board {
  top: { rank: number; name: string; avatar: unknown; steps: number; me: boolean }[];
  me: { rank: number; steps: number } | null;
  total: number;
}

/** The class board for a course and mode (with or without maths), or null if it can't be loaded. */
export async function loadBoard(course: string, mode: ClockMode, maths = false): Promise<Board | null> {
  try {
    const { data, error } = await supabase.rpc('marble_board', { in_course: course, in_mode: mode, in_maths: maths });
    if (error || !data || typeof data !== 'object' || !Array.isArray((data as Board).top)) return null;
    return data as Board;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- maths (stage M.6)

/** What the teacher allows for Marble Rush maths in a class. If it can't be read, maths stays off. */
export async function fetchMarbleSwitches(classId?: string | null): Promise<{ maths: MathsSwitch; rescue: boolean }> {
  const row = await readSettings(['marble_maths', 'marble_rescue'], classId);
  return { maths: parseMathsSwitch(row?.marble_maths), rescue: row ? row.marble_rescue !== false : true };
}

export async function saveMarbleMaths(mode: MathsSwitch, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_marble_maths', { mode, target_class: classId ?? null });
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export async function saveMarbleRescue(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_marble_rescue', { enabled, target_class: classId ?? null });
  if (error) throw new FriendlyError('We couldn’t change that.');
}

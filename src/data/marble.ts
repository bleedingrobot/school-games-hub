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
import type { ClockMode } from '../../shared/marble/engine';
import type { MarbleRunReport } from '../../shared/marble/save';
import type { Bests } from '../games/marble/bests';

const queueKey = (player: string) => `sgh-marble-queue:${player}`;
/** The most runs waiting to be sent (the newest are kept). */
const MAX_QUEUE = 12;

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

async function post(body: unknown, keepalive = false): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${SUPABASE_URL}/functions/v1/marble`, {
      method: 'POST',
      keepalive,
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** A stamped seed for a run, or null if the server can't be reached (the run can still be played, it just won't be saved). */
export async function startRun(course: string, mode: ClockMode): Promise<{ seed: string; stamp: string } | null> {
  const response = await post({ action: 'start', course, mode });
  if (!response?.ok) return null;
  try {
    const body = (await response.json()) as { seed?: unknown; stamp?: unknown };
    return typeof body.seed === 'string' && typeof body.stamp === 'string' ? { seed: body.seed, stamp: body.stamp } : null;
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
export async function loadServerBests(): Promise<Bests | null> {
  try {
    const { data, error } = await supabase.rpc('my_marble');
    if (error || !Array.isArray(data)) return null;
    const out: Bests = {};
    for (const b of data as ServerBest[]) {
      if (b.maths) continue;
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
}

/** A recorded run to race against, or null (none yet, or the server can't be reached). */
export async function loadGhost(course: string, mode: ClockMode, which: GhostKind): Promise<Ghost | null> {
  try {
    const { data, error } = await supabase.rpc('marble_ghost', { in_course: course, in_mode: mode, in_maths: false, which });
    if (error || !data || typeof data !== 'object') return null;
    const g = data as Partial<Ghost>;
    return typeof g.name === 'string' && typeof g.steps === 'number' && typeof g.inputs === 'string' ? { name: g.name, steps: g.steps, inputs: g.inputs } : null;
  } catch {
    return null;
  }
}

export interface Board {
  top: { rank: number; name: string; avatar: unknown; steps: number; me: boolean }[];
  me: { rank: number; steps: number } | null;
  total: number;
}

/** The class board for a course and mode (without maths), or null if it can't be loaded. */
export async function loadBoard(course: string, mode: ClockMode): Promise<Board | null> {
  try {
    const { data, error } = await supabase.rpc('marble_board', { in_course: course, in_mode: mode, in_maths: false });
    if (error || !data || typeof data !== 'object' || !Array.isArray((data as Board).top)) return null;
    return data as Board;
  } catch {
    return null;
  }
}

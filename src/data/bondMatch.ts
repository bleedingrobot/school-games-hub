/**
 * Bond Match's saving and loading.
 *
 * A finished game goes into a queue kept in this browser (one per student), and the queue is sent
 * to the bond-match server function straight away and again later if it can't be: when the game
 * opens, and after the next finished game. A dropped Wi-Fi connection just means it goes later.
 * Sending a game twice is safe: each has its own run id, and the server keeps it once.
 *
 * Bond Match never writes to a student's fact records: only the game, its bests, stars and points.
 */
import { MAX_ITEMS, type BondMatchItem, type SaveResponse, type SaveResult } from '../../shared/bond-match/save';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

const queueKey = (player: string) => `sgh-bond-match-queue:${player}`;
/** The longest the queue may grow. */
const MAX_QUEUE = 100;

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
    // Storage blocked: the queue lasts until the page closes.
  }
}

/** Kept in memory as well, in case storage is blocked. */
const memoryQueues = new Map<string, BondMatchItem[]>();

export function queuedGames(player: string): BondMatchItem[] {
  return memoryQueues.get(player) ?? read<BondMatchItem[]>(queueKey(player)) ?? [];
}

function setQueue(player: string, items: BondMatchItem[]) {
  memoryQueues.set(player, items);
  write(queueKey(player), items.length ? items : null);
}

export function enqueue(player: string, item: BondMatchItem) {
  const items = queuedGames(player);
  if (items.some((i) => i.runId === item.runId)) return;
  setQueue(player, [...items, item].slice(-MAX_QUEUE));
}

/** One send at a time, so two saves can't race each other. */
let chain: Promise<unknown> = Promise.resolve();

/** What the server said about each run id this time. */
export type Answers = Map<string, SaveResult>;

/**
 * Sends the queue. Games the server has dealt with leave it; the rest wait for next time.
 * Never throws. Says what the server answered for each game it dealt with.
 */
export function flushGames(player: string, keepalive = false): Promise<Answers> {
  const next = chain.then(() => sendQueue(player, keepalive));
  chain = next.catch(() => undefined);
  return next;
}

async function sendQueue(player: string, keepalive: boolean): Promise<Answers> {
  const answers: Answers = new Map();
  try {
    // A request can only carry so many; keep going while the server keeps taking them.
    for (;;) {
      const items = queuedGames(player);
      if (items.length === 0) return answers;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return answers;
      const batch = items.slice(0, MAX_ITEMS);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/bond-match`, {
        method: 'POST',
        keepalive,
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      });
      if (!response.ok) return answers;
      const body = (await response.json()) as SaveResponse;
      const handled = Math.max(0, Math.min(batch.length, body.handled ?? 0));
      if (handled === 0) return answers;
      batch.slice(0, handled).forEach((item, i) => body.results[i] && answers.set(item.runId, body.results[i]));
      // Take out what was dealt with. Anything added while sending stays.
      const gone = new Set(batch.slice(0, handled).map((i) => i.runId));
      setQueue(player, queuedGames(player).filter((i) => !gone.has(i.runId)));
      if (handled < batch.length) return answers;
    }
  } catch {
    // Offline: it goes next time.
    return answers;
  }
}

// ---------------------------------------------------------------------------
// What Bond Match's screens use (passed in as a prop, so the preview and the tests can use a stand-in)
// ---------------------------------------------------------------------------

export interface ServerBest {
  bondId: string;
  size: string;
  flips: number;
  seconds: number;
  stars: number;
  plays: number;
}

export interface BondMatchSaver {
  /**
   * Saves a finished game. Resolves with the server's answer, or null when it could not be reached
   * (the game is kept and goes later).
   */
  save(item: BondMatchItem): Promise<SaveResult | null>;
  /** The student's bests from the server (after sending anything still waiting), or null if it can't be reached. */
  loadBests(): Promise<ServerBest[] | null>;
}

export function makeSaver(player: string): BondMatchSaver {
  return {
    async save(item) {
      enqueue(player, item);
      const answers = await flushGames(player);
      return answers.get(item.runId) ?? null;
    },
    async loadBests() {
      await flushGames(player);
      try {
        const { data, error } = await supabase.rpc('my_bond_match');
        if (error || !data) return null;
        return (data as { bests: ServerBest[] }).bests;
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export interface StudentBondMatch {
  bests: ServerBest[];
  games: number;
  lastPlayed: string | null;
}

export async function fetchStudentBondMatch(student: string): Promise<StudentBondMatch> {
  const { data, error } = await supabase.rpc('teacher_bond_match_student', { student });
  if (error || !data) throw new Error('We couldn’t load their Bond Match.');
  return data as StudentBondMatch;
}

// ---------------------------------------------------------------------------
// The switch (per class, off to start; the server refuses to save while it is off)
// ---------------------------------------------------------------------------

/** Is Bond Match switched on for this class (or, with no class given, for the signed-in person's own)? */
export async function fetchBondMatchEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['bond_match_enabled'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Bond Match setting.');
  return data.bond_match_enabled === true;
}

export async function saveBondMatchEnabled(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_bond_match', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (!error) return;
  // Messages we wrote in the database ("You don't teach a class yet…") are safe to show; anything else gets the fallback.
  if ((error.code === '22023' || error.code === '42501') && error.message) throw new FriendlyError(error.message);
  throw new FriendlyError('We couldn’t save the Bond Match setting.');
}
